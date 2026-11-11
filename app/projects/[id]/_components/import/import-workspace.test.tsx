import { fireEvent, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithIntl } from "@/test/intl";
import type { GetImportResponse, ImportedDocument } from "@/types/import";
import ImportWorkspace from "./import-workspace";

const imp = vi.hoisted(() => ({ current: {} as Record<string, unknown> }));
vi.mock("../../hooks/mode1/useImport", () => ({ useImport: () => imp.current }));
vi.mock("../../hooks/mode1/useMode1Project", () => ({
  useMode1Project: () => ({ project: { _id: "p1", name: "Lumen", template_intent: "fixed" }, credits: 100, error: null, reload: vi.fn() }),
}));
vi.mock("@/lib/api/users", () => ({ fetchMe: vi.fn(async () => ({ _id: "u1", name: "BA", email: "ba@x.io" })) }));
vi.mock("@/lib/api/import", () => ({ downloadGapReport: vi.fn(), getImport: vi.fn(async () => ({ data: { import: { structure_changes: [] } } })) }));
vi.mock("@/lib/api/export", () => ({ downloadWordExport: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }), usePathname: () => "/projects/p1", useSearchParams: () => new URLSearchParams() }));

const doc = (over: Partial<ImportedDocument>): ImportedDocument =>
  ({ id: "i1", project_id: "p1", original_name: "SRS.docx", status: "extracting", preflight: { status: "accepted", issues: [], document_kind: null }, paused: null, extract_cursor: null, reread: null, ...over }) as ImportedDocument;
const data = (over: Partial<GetImportResponse>): GetImportResponse =>
  ({ import: null, profile: null, extraction: { sections: [], review_fields: [] }, blocks_count: 0, ...over }) as GetImportResponse;
const setImport = (over: Record<string, unknown>) => {
  imp.current = {
    loading: false,
    error: null,
    busy: null,
    awaitingStart: false,
    data: null,
    doc: null,
    clearError: vi.fn(),
    upload: vi.fn(async () => null),
    start: vi.fn(),
    resume: vi.fn(),
    continueFlow2: vi.fn(async () => ({ project_mode: "fpt" })),
    ...over,
  };
};

beforeEach(() => setImport({}));

describe("ImportWorkspace - upload SRS trong layout workspace", () => {
  it("chờ Bắt đầu ⇒ màn đọc khung; Bắt đầu gửi kèm xác nhận bản mới nhất (không hỏi thêm câu nào)", () => {
    const d = doc({});
    setImport({
      awaitingStart: true,
      doc: d,
      data: data({
        import: d,
        structure_preview: { summary: { present: 3, missing: 0, out_of_scope: 0, kind: "written" }, sections: [{ section_id: "fixed:1", title: "1 Overview", status: "present", order: 0 }], resolved_mode: 1, intent: "fixed", computed_at: "2026-11-08T00:00:00.000Z" },
        credit_estimate: { text_batches: 1, diagram_images: 0, ai_calls: 1, credits: 2, available_credits: 100 },
      }),
    });
    renderWithIntl(<ImportWorkspace projectId="p1" onProjectChanged={() => {}} />);
    expect(screen.getByRole("heading", { name: /SRS đã viết · đủ khung/ })).toBeInTheDocument();
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /^Bắt đầu/ }));
    expect(imp.current.start).toHaveBeenCalledWith(true);
    // File giữ khung ⇒ lưu làm mẫu tổ chức ngay tại màn này
    expect(screen.getByRole("button", { name: "Lưu làm mẫu của tổ chức" })).toBeInTheDocument();
  });

  it("file bị từ chối ⇒ lý do + ô chọn file khác ngay tại màn", () => {
    const d = doc({ status: "preflight_rejected", preflight: { status: "rejected", issues: [{ code: "EMPTY_DOCUMENT", message: "Tài liệu không có nội dung chữ", location: null }], document_kind: null } });
    setImport({ doc: d, data: data({ import: d }) });
    renderWithIntl(<ImportWorkspace projectId="p1" onProjectChanged={() => {}} />);
    expect(screen.getByText(/SRS.docx” chưa nhập được/)).toBeInTheDocument();
    expect(screen.getByText("File chưa nhập được")).toBeInTheDocument();
    expect(screen.getByText("Tải file đã sửa")).toBeInTheDocument();
  });

  it("bổ sung theo mẫu chuẩn còn thiếu (chế độ 4) ⇒ thông báo + tải DRAFT và báo cáo thiếu sót", () => {
    const d = doc({ status: "incomplete" });
    setImport({ doc: d, data: data({ import: d, target_structure: { target: "fpt", intent: "free", resolved_mode: 4, sections: [], missing: ["fixed:2.1", "fixed:5.1"], compared_at: "x" } }) });
    renderWithIntl(<ImportWorkspace projectId="p1" onProjectChanged={() => {}} />);
    expect(screen.getByRole("heading", { name: "File còn thiếu 2 mục so với mẫu chuẩn FlintFlow" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Tải bản DRAFT/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Tải báo cáo thiếu sót/ })).toBeInTheDocument();
  });

  it("bản ghi cũ giữ khung còn dừng ở incomplete ⇒ nút Soạn phần còn thiếu", async () => {
    const onProjectChanged = vi.fn();
    const d = doc({ status: "incomplete" });
    setImport({ doc: d, data: data({ import: d, target_structure: { target: "template", intent: "fixed", resolved_mode: 3, sections: [], missing: ["fixed:2.1"], compared_at: "x" } }) });
    renderWithIntl(<ImportWorkspace projectId="p1" onProjectChanged={onProjectChanged} />);
    fireEvent.click(screen.getByRole("button", { name: /Soạn phần còn thiếu/ }));
    expect(imp.current.continueFlow2).toHaveBeenCalled();
    await vi.waitFor(() => expect(onProjectChanged).toHaveBeenCalled());
  });

  it("đang đọc ⇒ tiến trình 3 pha", () => {
    const d = doc({ status: "checking" });
    setImport({ doc: d, data: data({ import: d }) });
    renderWithIntl(<ImportWorkspace projectId="p1" onProjectChanged={() => {}} />);
    expect(screen.getByRole("listitem", { current: "step" })).toHaveTextContent("Kiểm tra");
  });

  it("đọc xong mà trang chưa kịp chuyển (project chưa đổi) ⇒ thử đọc lại project tới khi chuyển", () => {
    vi.useFakeTimers();
    const onProjectChanged = vi.fn();
    const d = doc({ status: "gap_review" });
    setImport({ doc: d, data: data({ import: d }), reload: vi.fn() });
    renderWithIntl(<ImportWorkspace projectId="p1" onProjectChanged={onProjectChanged} />);
    vi.advanceTimersByTime(5100);
    expect(onProjectChanged.mock.calls.length).toBeGreaterThanOrEqual(2);
    vi.useRealTimers();
  });
});
