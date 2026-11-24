import { fireEvent, screen, waitFor } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithIntl } from "@/test/intl";
import { mockServer } from "@/mocks/server";
import { mode1Handlers, resetMode1Extraction, MODE1_DOC_ID } from "@/mocks/mode1/handlers";
import { resetMode1MockState, MODE1_PROJECT_ID } from "@/mocks/mode1/state";
import { useProjectDocuments } from "../../hooks/useProjectDocuments";
import type { ProjectDocument } from "@/types/document";
import ReferenceDocumentsPanel from "./ReferenceDocumentsPanel";

/** Danh sách lấy qua hook thật (như nút Tài liệu ở đầu khung chat). */
function Harness({ onCrsCreated, canExtract = true }: { onCrsCreated: () => void; canExtract?: boolean }) {
  const { docs, remove } = useProjectDocuments(MODE1_PROJECT_ID);
  return docs ? <ReferenceDocumentsPanel projectId={MODE1_PROJECT_ID} docs={docs} onRemove={remove} onCrsCreated={onCrsCreated} canExtract={canExtract} /> : null;
}

beforeAll(() => mockServer.listen({ onUnhandledRequest: "error" }));
beforeEach(() => {
  resetMode1MockState();
  resetMode1Extraction();
  mockServer.use(...mode1Handlers);
});
afterEach(() => mockServer.resetHandlers());
afterAll(() => mockServer.close());

describe("ReferenceDocumentsPanel (FLF-338 - tài liệu tham khảo ⇒ rút yêu cầu)", () => {
  it("liệt kê tài liệu; Rút yêu cầu ⇒ hỏi credit trước (cổng cứng §3.6); Chạy ⇒ danh sách rút hiện ra; duyệt ⇒ onCrsCreated", async () => {
    const onCrsCreated = vi.fn();
    renderWithIntl(<Harness onCrsCreated={onCrsCreated} />);
    expect(await screen.findByText("minutes.txt")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Rút yêu cầu" }));
    const dialog = await screen.findByRole("dialog", { name: "Xác nhận credit trước khi rút yêu cầu" });
    expect(dialog).toHaveTextContent(/tốn ~1 credit/);
    fireEvent.click(screen.getByRole("button", { name: "Chạy" }));

    expect(await screen.findByRole("heading", { name: /minutes.txt - 3 yêu cầu/ })).toBeInTheDocument();
    expect(screen.getByText("3 yêu cầu chờ duyệt")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Rút lại" })).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText(/Ai đưa ra yêu cầu/), { target: { value: "PM Lan" } });
    fireEvent.click(screen.getByRole("button", { name: "Under 2 seconds" }));
    fireEvent.click(screen.getByRole("button", { name: "Tạo 2 change request" }));
    await waitFor(() => expect(onCrsCreated).toHaveBeenCalledTimes(1));
    expect(screen.getByText("đã duyệt")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "CR-001" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Rút lại" })).toBeNull();
  });

  it("Huỷ ở thẻ credit ⇒ không gọi AI; Xoá tài liệu ⇒ biến mất", async () => {
    renderWithIntl(<Harness onCrsCreated={vi.fn()} />);
    await screen.findByText("minutes.txt");
    fireEvent.click(screen.getByRole("button", { name: "Rút yêu cầu" }));
    fireEvent.click(await screen.findByRole("button", { name: "Huỷ" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.queryByText(/yêu cầu chờ duyệt/)).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Xoá" }));
    await waitFor(() => expect(screen.queryByText("minutes.txt")).toBeNull());
    expect(MODE1_DOC_ID).toBeTruthy();
  });

  it("dự án AI soạn (canExtract = false) ⇒ không có Rút yêu cầu, vẫn Xoá được", async () => {
    renderWithIntl(<Harness onCrsCreated={vi.fn()} canExtract={false} />);
    await screen.findByText("minutes.txt");
    expect(screen.queryByRole("button", { name: "Rút yêu cầu" })).toBeNull();
    expect(screen.getByRole("button", { name: "Xoá" })).toBeInTheDocument();
  });
});

describe("ReferenceDocumentsPanel - cảnh báo sau khi tải (FLF-449 việc 27)", () => {
  const doc = (id: string, name: string, extra: Partial<ProjectDocument> = {}): ProjectDocument => ({
    _id: id,
    projectId: MODE1_PROJECT_ID,
    uploadedBy: "u1",
    originalName: name,
    mimeType: "x",
    size: 1,
    extension: name.slice(name.lastIndexOf(".")),
    parseStatus: "success",
    summaryStatus: "success",
    createdAt: "",
    updatedAt: "",
    ...extra,
  });

  it("ảnh trong .docx bị bỏ / PDF không có chữ / .doc cũ ⇒ nhãn riêng từng dòng; BE cũ không có parseWarnings ⇒ không nhãn", () => {
    const docs = [
      doc("d1", "email.docx", { parseWarnings: ["images_skipped"] }),
      doc("d2", "ban-scan.pdf", { parseStatus: "failed", parseWarnings: ["pdf_no_text"] }),
      doc("d3", "yeu-cau-cu.doc", { parseStatus: "failed", parseWarnings: [] }),
      doc("d4", "minutes.txt"),
    ];
    renderWithIntl(<ReferenceDocumentsPanel projectId={MODE1_PROJECT_ID} docs={docs} onRemove={vi.fn()} onCrsCreated={vi.fn()} canExtract={false} />);
    const row = (name: string) => screen.getByText(name).closest("li") as HTMLElement;
    expect(row("email.docx")).toHaveTextContent("Hình / sơ đồ trong file không được đọc");
    expect(row("ban-scan.pdf")).toHaveTextContent("Không đọc được chữ trong file");
    expect(row("ban-scan.pdf")).not.toHaveTextContent("chưa đọc được chữ");
    expect(row("yeu-cau-cu.doc")).toHaveTextContent("Chưa đọc được file .doc, hãy lưu lại thành .docx");
    expect(row("minutes.txt")).not.toHaveTextContent(/không được đọc|Không đọc được|chưa đọc được/);
  });

  it("bản tiếng Anh", () => {
    renderWithIntl(
      <ReferenceDocumentsPanel
        projectId={MODE1_PROJECT_ID}
        docs={[doc("d1", "email.docx", { parseWarnings: ["images_skipped"] }), doc("d2", "scan.pdf", { parseStatus: "failed", parseWarnings: ["pdf_no_text"] })]}
        onRemove={vi.fn()}
        onCrsCreated={vi.fn()}
        canExtract={false}
      />,
      "en",
    );
    expect(screen.getByText("Images / diagrams in the file are not read")).toBeInTheDocument();
    expect(screen.getByText("No readable text in the file")).toBeInTheDocument();
  });
});
