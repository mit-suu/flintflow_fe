import { fireEvent, screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { renderWithIntl } from "@/test/intl";
import { API_BASE_URL } from "@/lib/api/client";
import { mockServer } from "@/mocks/server";
import type { TargetStructure } from "@/types/import";
import ReadingResultScreen from "./ReadingResultScreen";

const P = "650000000000000000000002";

beforeAll(() => mockServer.listen({ onUnhandledRequest: "error" }));
afterEach(() => mockServer.resetHandlers());
afterAll(() => mockServer.close());

const structure = (over: Partial<TargetStructure> = {}): TargetStructure => ({
  target: "fpt",
  intent: "free",
  resolved_mode: 4,
  compared_at: "2026-10-27T01:00:00.000Z",
  missing: ["fixed:2.1", "fixed:2.2.2"],
  sections: [
    { section_id: "fixed:1", title: "1. Product Overview", status: "present", owner_steps: ["S-1.2"] },
    { section_id: "fixed:2.1", title: "2.1 Actors", status: "missing", owner_steps: ["S-2.1"] },
    { section_id: "fixed:2.2.2", title: "2.2.2 Use Case Descriptions", status: "missing", owner_steps: ["S-3.1", "S-3.2"] },
    { section_id: "custom:CS01", title: "Phụ lục Dự toán", status: "out_of_scope", owner_steps: [] },
  ],
  ...over,
});

describe("ReadingResultScreen (FLF-336 — điểm dừng Kết quả đọc file)", () => {
  it("chế độ 4: nói số mục thiếu / đã có, bản đồ mục có / sẽ soạn / ngoài phạm vi kèm bước soạn; Hoàn thiện gọi onComplete", () => {
    const onComplete = vi.fn();
    renderWithIntl(<ReadingResultScreen projectId={P} structure={structure()} onComplete={onComplete} />);
    expect(screen.getByText(/còn thiếu 2 mục của mẫu chuẩn FlintFlow \(1 mục đã có\)/)).toBeInTheDocument();
    const map = screen.getByRole("list", { name: "Bản đồ mục so với cấu trúc đích" });
    expect(map).toHaveTextContent("Có1. Product Overview");
    expect(map).toHaveTextContent("Sẽ soạn2.1 Actorsbước S-2.1");
    expect(map).toHaveTextContent("Ngoài phạm viPhụ lục Dự toán");
    expect(screen.getByText(/1 mục ngoài phạm vi giữ nguyên văn/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Hoàn thiện" }));
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it("chế độ 4 (luồng A): giữ Dừng / Hoàn thiện, câu tóm tắt cũ, không ước tính credit", () => {
    renderWithIntl(<ReadingResultScreen projectId={P} structure={structure()} onComplete={vi.fn()} gapFillCredits={12} />);
    expect(screen.getAllByRole("button").map((b) => b.textContent)).toEqual(["Dừng, tải gap report", "Hoàn thiện"]);
    expect(screen.getByText(/Dừng ở đây thì dự án ở trạng thái chưa hoàn thiện/)).toBeInTheDocument();
    expect(screen.queryByText(/credit/)).toBeNull();
  });

  it("đang chốt ⇒ hai nút khoá", () => {
    renderWithIntl(<ReadingResultScreen projectId={P} structure={structure()} onComplete={vi.fn()} busy />);
    expect(screen.getByRole("button", { name: "Đang chốt bản gốc…" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Dừng, tải gap report" })).toBeDisabled();
  });
});

describe("ReadingResultScreen — dự án mới theo mẫu bắt buộc (FLF-278)", () => {
  it("có onDraftMissing (không onComplete) ⇒ lời 'đọc mẫu', một lối đi duy nhất Viết với FlintFlow — không Hoàn thiện, không gap report", () => {
    const onDraftMissing = vi.fn();
    const fixed = structure({ resolved_mode: 3, target: "template", intent: "fixed", sections: structure().sections.filter((s) => s.status !== "out_of_scope") });
    renderWithIntl(<ReadingResultScreen projectId={P} structure={fixed} onDraftMissing={onDraftMissing} />);
    expect(screen.getByRole("heading", { name: "Kết quả đọc mẫu" })).toBeInTheDocument();
    // FLF-378: FlintFlow soạn toàn bộ mục của mẫu — không còn "mục đã có / còn trống", "điền dở", "chỉ soạn mục còn trống"
    expect(screen.getByText(/Mẫu có 3 mục — FlintFlow soạn toàn bộ, dùng hướng dẫn và ví dụ của mẫu làm gợi ý/)).toBeInTheDocument();
    expect(screen.getByText(/soạn 3 mục của mẫu để bạn duyệt/)).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/điền dở|còn trống/);
    expect(screen.getAllByRole("button").map((b) => b.textContent)).toEqual(["Viết với FlintFlow"]);
    fireEvent.click(screen.getByRole("button", { name: "Viết với FlintFlow" }));
    expect(onDraftMissing).toHaveBeenCalledTimes(1);
  });

  it("dự án có sẵn · tự do (chỉ onComplete, chế độ 4) ⇒ Dừng / Hoàn thiện, không có Viết với FlintFlow", () => {
    renderWithIntl(<ReadingResultScreen projectId={P} structure={structure()} onComplete={vi.fn()} />);
    expect(screen.getAllByRole("button").map((b) => b.textContent)).toEqual(["Dừng, tải gap report", "Hoàn thiện"]);
    expect(screen.getByRole("heading", { name: "Kết quả đọc file" })).toBeInTheDocument();
  });
});

describe("ReadingResultScreen — luồng B: dự án có sẵn theo mẫu cố định (FLF-382)", () => {
  const fixedExisting = () => structure({ resolved_mode: 3, target: "template", intent: "fixed", sections: structure().sections.filter((s) => s.status !== "out_of_scope") });

  it("một nút chính Hoàn thiện + ước tính credit cạnh nút + câu tóm tắt mới; gap report chỉ là liên kết phụ", () => {
    const onComplete = vi.fn();
    renderWithIntl(<ReadingResultScreen projectId={P} structure={fixedExisting()} onComplete={onComplete} gapFillCredits={18} />);
    expect(screen.getByRole("heading", { name: "Kết quả đọc file" })).toBeInTheDocument();
    expect(
      screen.getByText(
        "File theo mẫu của bạn có 1 mục đã viết và 2 mục còn trống. Bấm Hoàn thiện: FlintFlow chốt bản gốc 0.1 đúng phần bạn đã viết, rồi hỏi bạn vài điều để soạn 2 mục còn trống."
      )
    ).toBeInTheDocument();
    // Một nút chính duy nhất; "Dừng, tải gap report" không còn — chỉ còn liên kết phụ "Tải gap report"
    const primary = screen.getAllByRole("button").filter((b) => b.className.includes("btn-gradient-primary"));
    expect(primary.map((b) => b.textContent)).toEqual(["Hoàn thiện"]);
    expect(screen.queryByRole("button", { name: "Dừng, tải gap report" })).toBeNull();
    expect(screen.getByRole("button", { name: "Tải gap report" }).className).toContain("underline");
    expect(screen.getByText("~18 credit")).toBeInTheDocument();
    expect(screen.queryByText(/Dừng ở đây/)).toBeNull();
    expect(screen.queryByRole("button", { name: "Viết với FlintFlow" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Hoàn thiện" }));
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it("không có ước tính (null) ⇒ không hiện credit", () => {
    renderWithIntl(<ReadingResultScreen projectId={P} structure={fixedExisting()} onComplete={vi.fn()} gapFillCredits={null} />);
    expect(screen.queryByText(/credit/)).toBeNull();
  });

  it("liên kết phụ vẫn tải gap report docx", async () => {
    let downloaded = 0;
    mockServer.use(
      http.get(`${API_BASE_URL}/projects/:projectId/gap-report`, () => {
        downloaded += 1;
        return new HttpResponse(new Blob(["PK"]), { headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "Content-Disposition": 'attachment; filename="gap.docx"' } });
      })
    );
    const urlSpy = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:x");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
    renderWithIntl(<ReadingResultScreen projectId={P} structure={fixedExisting()} onComplete={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Tải gap report" }));
    await waitFor(() => expect(downloaded).toBe(1));
    await waitFor(() => expect(screen.getByRole("button", { name: "Tải gap report" })).toBeEnabled());
    urlSpy.mockRestore();
  });

  it("đang chốt ⇒ Hoàn thiện và liên kết gap report đều khoá", () => {
    renderWithIntl(<ReadingResultScreen projectId={P} structure={fixedExisting()} onComplete={vi.fn()} gapFillCredits={18} busy />);
    expect(screen.getByRole("button", { name: "Đang chốt bản gốc…" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Tải gap report" })).toBeDisabled();
  });
});
