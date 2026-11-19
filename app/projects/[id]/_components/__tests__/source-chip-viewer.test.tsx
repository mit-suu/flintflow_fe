import { fireEvent, screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { renderWithIntl } from "@/test/intl";
import { mockServer } from "@/mocks/server";
import { API_BASE_URL } from "@/lib/api/client";
import type { Block } from "@/types/document";
import type { RequirementSourceRef } from "@/types/sources";
import { BlockView } from "../DocumentPane";
import SourceChip, { sectionEntityPath, sourcesByPath } from "../SourceChip";
import { ReferenceViewerProvider } from "../reference-viewer/ReferenceViewerProvider";
import ReferenceDocumentsPanel from "../mode1/ReferenceDocumentsPanel";
import { saveBlob } from "@/lib/api/files";

// Chỉ thay saveBlob (jsdom không tải file); fetchFile giữ nguyên để đi qua msw
vi.mock("@/lib/api/files", async (importOriginal) => ({ ...(await importOriginal<object>()), saveBlob: vi.fn() }));

const P = "p1";
const ref = (over: Partial<RequirementSourceRef> = {}): RequirementSourceRef => ({
  para_id: "D1-P02",
  document_id: "doc1",
  document_name: "bien-ban.docx",
  quote: "Bệnh nhân đặt lịch qua điện thoại.",
  ...over,
});

const textHandler = () =>
  http.get(`${API_BASE_URL}/projects/${P}/documents/doc1/text`, () =>
    HttpResponse.json({
      data: {
        id: "doc1",
        name: "bien-ban.docx",
        paragraphs: [
          { para_id: "D1-P01", text: "Mở đầu biên bản." },
          { para_id: "D1-P02", text: "Bệnh nhân đặt lịch qua điện thoại." },
        ],
      },
      error: null,
    })
  );

beforeAll(() => mockServer.listen({ onUnhandledRequest: "error" }));
afterEach(() => mockServer.resetHandlers());
afterAll(() => mockServer.close());

const withViewer = (ui: React.ReactElement) => renderWithIntl(<ReferenceViewerProvider projectId={P}>{ui}</ReferenceViewerProvider>);

describe("SourceChip + trình xem tài liệu tham khảo", () => {
  it("bấm chip ⇒ câu trích; Mở tài liệu ⇒ dialog cuộn tới và tô đúng đoạn", async () => {
    mockServer.use(textHandler());
    withViewer(<SourceChip refs={[ref()]} />);

    fireEvent.click(screen.getByRole("button", { name: /Nguồn tài liệu của mục này \(1 đoạn\)/ }));
    expect(screen.getByText("Bệnh nhân đặt lịch qua điện thoại.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Mở tài liệu" }));

    const dialog = await screen.findByRole("dialog", { name: "bien-ban.docx" });
    await waitFor(() => expect(dialog.querySelector('[data-para-id="D1-P02"]')).toHaveAttribute("aria-current", "true"));
    expect(dialog.querySelector('[data-para-id="D1-P01"]')).not.toHaveAttribute("aria-current");
  });

  it("tài liệu đã xoá ⇒ vẫn có câu trích, không có Mở tài liệu", () => {
    withViewer(<SourceChip refs={[ref({ document_name: null })]} />);
    fireEvent.click(screen.getByRole("button", { name: /Nguồn tài liệu của mục này/ }));
    expect(screen.getByText(/Tài liệu đã xoá/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Mở tài liệu" })).toBeNull();
  });

  it("đoạn không còn trong bản hiện tại ⇒ mở đầu tài liệu kèm dòng báo", async () => {
    mockServer.use(textHandler());
    withViewer(<SourceChip refs={[ref({ para_id: "D1-P09" })]} />);
    fireEvent.click(screen.getByRole("button", { name: /Nguồn tài liệu của mục này/ }));
    fireEvent.click(screen.getByRole("button", { name: "Mở tài liệu" }));
    expect(await screen.findByText("Đoạn này không còn trong bản hiện tại.")).toBeInTheDocument();
  });

  it("Tải về trong trình xem ⇒ lưu file với tên BE gửi (giữ tiếng Việt)", async () => {
    mockServer.use(
      textHandler(),
      http.get(`${API_BASE_URL}/projects/${P}/documents/doc1/download`, () =>
        new HttpResponse("abc", { headers: { "Content-Disposition": "attachment; filename*=UTF-8''bi%C3%AAn-b%E1%BA%A3n.docx" } })
      )
    );
    withViewer(<SourceChip refs={[ref()]} />);
    fireEvent.click(screen.getByRole("button", { name: /Nguồn tài liệu của mục này/ }));
    fireEvent.click(screen.getByRole("button", { name: "Mở tài liệu" }));
    fireEvent.click(await screen.findByRole("button", { name: "Tải về" }));
    await waitFor(() => expect(saveBlob).toHaveBeenCalledWith(expect.anything(), "biên-bản.docx"));
  });
});

describe("chip Nguồn trên block tài liệu", () => {
  const sources = sourcesByPath([
    { path: "functions[id=FN1]", step_id: "S-5.2@S01", updated_at: "", refs: [ref()] },
    { path: "nfrs[id=N01]", step_id: "S-6.1", updated_at: "", refs: [ref(), ref({ para_id: "D1-P03" })] },
    { path: "actors[id=A01]", step_id: "S-3.1", updated_at: "", refs: [ref()] },
  ]);
  const chip = (path: string | null | undefined) => {
    const refs = path ? sources.get(path) : undefined;
    return refs ? <SourceChip refs={refs} /> : null;
  };

  it("đoạn, mục list và dòng bảng có nguồn thì có chip; phần tử không có nguồn thì không", () => {
    const blocks: Block[] = [
      { type: "paragraph", runs: [{ text: "Uptime 99%" }], entity_path: "nfrs[id=N01]" },
      { type: "bullet_list", items: [[{ text: "Nurse" }], [{ text: "Doctor" }]], item_entity_paths: ["actors[id=A01]", "actors[id=A02]"] },
      { type: "table", header: [[{ text: "Id" }]], rows: [[[{ text: "N01" }]], [[{ text: "N02" }]]], row_entity_paths: ["nfrs[id=N01]", null] },
    ];
    renderWithIntl(<>{blocks.map((b, i) => <BlockView key={i} block={b} projectId={P} sourceChip={chip} />)}</>);
    expect(screen.getAllByRole("button", { name: /\(2 đoạn\)/ })).toHaveLength(2);
    expect(screen.getAllByRole("button", { name: /\(1 đoạn\)/ })).toHaveLength(1);
  });

  it("BlockView không truyền sourceChip (trang /view) ⇒ không có chip dù block có đường dẫn", () => {
    renderWithIntl(<BlockView block={{ type: "paragraph", runs: [{ text: "Uptime 99%" }], entity_path: "nfrs[id=N01]" }} projectId={P} />);
    expect(screen.queryByRole("button", { name: /Nguồn/ })).toBeNull();
  });

  it("mục chi tiết function / feature dùng id section làm đường dẫn", () => {
    expect(sectionEntityPath("function:FN1")).toBe("functions[id=FN1]");
    expect(sectionEntityPath("feature:F2")).toBe("features[id=F2]");
    expect(sectionEntityPath("fixed:3.1.1")).toBeNull();
  });
});

describe("popup Tài liệu: Xem + Tải về", () => {
  it("mỗi tài liệu đọc được có Xem (mở trình xem) và Tải về; tài liệu chưa đọc được chữ chỉ có Tải về", async () => {
    mockServer.use(textHandler());
    const doc = (id: string, parseStatus: "success" | "failed") =>
      ({ _id: id, projectId: P, uploadedBy: "u1", originalName: `${id}.docx`, mimeType: "x", size: 1, parseStatus, summaryStatus: "success", createdAt: "", updatedAt: "" }) as never;
    withViewer(<ReferenceDocumentsPanel projectId={P} docs={[doc("doc1", "success"), doc("doc2", "failed")]} onRemove={vi.fn()} onCrsCreated={vi.fn()} canExtract={false} />);
    expect(screen.getAllByRole("button", { name: "Xem" })).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: "Tải về" })).toHaveLength(2);
    fireEvent.click(screen.getByRole("button", { name: "Xem" }));
    expect(await screen.findByText("Mở đầu biên bản.")).toBeInTheDocument();
  });
});
