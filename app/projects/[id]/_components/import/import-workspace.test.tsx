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
vi.mock("@/lib/api/import", () => ({ downloadGapReport: vi.fn(), getImportSource: vi.fn(async () => ({ notModified: false, etag: null, data: { import_id: "i1", sections: [] } })), getImport: vi.fn(async () => ({ data: { import: { structure_changes: [] } } })) }));
vi.mock("@/lib/api/export", () => ({ downloadWordExport: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }), usePathname: () => "/projects/p1", useSearchParams: () => new URLSearchParams() }));

const doc = (over: Partial<ImportedDocument>): ImportedDocument =>
  ({ id: "i1", project_id: "p1", original_name: "SRS.docx", status: "extracting", preflight: { status: "accepted", issues: [], document_kind: null }, paused: null, extract_cursor: null, reread: null, ...over }) as ImportedDocument;
const data = (over: Partial<GetImportResponse>): GetImportResponse =>
  ({ import: null, profile: null, extraction: { sections: [], review_fields: [], review_guidance: [], review_content_mismatch: [] }, blocks_count: 0, ...over }) as GetImportResponse;
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
    confirmReview: vi.fn(),
    continueFlow2: vi.fn(async () => ({ project_mode: "fpt" })),
    runReview: vi.fn(async () => ({ project_mode: "fpt" })),
    runSectionReview: vi.fn(async () => ({ reviewed: true })),
    stopReview: vi.fn(async () => ({ import: { status: "reviewing", paused: { reason: "user" } } })),
    ...over,
  };
};

beforeEach(() => setImport({}));

describe("ImportWorkspace - upload SRS trong layout workspace", () => {
  // FLF-456: ô ngôn ngữ tài liệu chỉ hiện khi BE báo file chỉ còn khung; chọn ngôn ngữ ⇒ gọi lưu lựa chọn
  it("file chỉ còn khung ⇒ hiện ô ngôn ngữ, chọn Tiếng Việt gọi setSkeletonLanguage; còn mục giữ nội dung ⇒ không có ô", () => {
    const d = doc({});
    const preview = { summary: { present: 0, missing: 3, out_of_scope: 0, kind: "template" as const }, sections: [{ section_id: "fixed:1", title: "1 Overview", status: "missing" as const, order: 0 }], resolved_mode: 3 as const, intent: "fixed" as const, computed_at: "2026-11-08T00:00:00.000Z" };
    const setSkeletonLanguage = vi.fn();
    setImport({ awaitingStart: true, doc: d, setSkeletonLanguage, data: data({ import: d, structure_preview: preview, skeleton_language: { visible: true, file: "en", selected: "en" } }) });
    const first = renderWithIntl(<ImportWorkspace projectId="p1" onProjectChanged={() => {}} />);
    expect(screen.getByRole("heading", { name: "Ngôn ngữ tài liệu" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("radio", { name: "Tiếng Việt" }));
    expect(setSkeletonLanguage).toHaveBeenCalledWith("vi");
    first.unmount();
    setImport({ awaitingStart: true, doc: d, data: data({ import: d, structure_preview: preview, skeleton_language: { visible: false, file: "en", selected: "en" } }) });
    renderWithIntl(<ImportWorkspace projectId="p1" onProjectChanged={() => {}} />);
    expect(screen.queryByRole("heading", { name: "Ngôn ngữ tài liệu" })).not.toBeInTheDocument();
  });

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
    // UC-85: lưu cấu trúc thành mẫu tổ chức đi qua đề xuất sau baseline, không còn ở màn đọc khung
    expect(screen.queryByRole("button", { name: "Lưu làm mẫu của tổ chức" })).not.toBeInTheDocument();
  });

  it("chưa có file ⇒ nói rõ bước đang ở (tải file → xem khung và credit → đọc), ô thả file; không có Xem & comment / Export", () => {
    renderWithIntl(<ImportWorkspace projectId="p1" onProjectChanged={() => {}} />);
    expect(screen.getByRole("heading", { name: "Tải file SRS của dự án" })).toBeInTheDocument();
    expect(screen.getByText(/báo số credit trước khi đọc nội dung/)).toBeInTheDocument();
    const steps = screen.getByRole("list", { name: "Các bước bắt đầu" });
    expect(steps).toHaveTextContent("Tải file");
    expect(steps).toHaveTextContent("Xem khung và credit");
    expect(steps).toHaveTextContent("Đọc nội dung");
    expect(screen.getByRole("button", { name: "Kéo thả hoặc chọn file .docx" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Export" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Xem & comment" })).not.toBeInTheDocument();
  });

  it("file bị từ chối ⇒ lý do + ô chọn file khác ngay tại màn", () => {
    const d = doc({ status: "preflight_rejected", preflight: { status: "rejected", issues: [{ code: "EMPTY_DOCUMENT", message: "Tài liệu không có nội dung chữ", location: null }], document_kind: null } });
    setImport({ doc: d, data: data({ import: d }) });
    renderWithIntl(<ImportWorkspace projectId="p1" onProjectChanged={() => {}} />);
    expect(screen.getByText(/SRS.docx” chưa nhập được/)).toBeInTheDocument();
    expect(screen.getByText("File chưa nhập được")).toBeInTheDocument();
    expect(screen.getByText("Tải file đã sửa")).toBeInTheDocument();
  });

  it("FLF-416 bản ghi cũ bổ sung theo mẫu chuẩn (chế độ 4) còn dừng ở incomplete ⇒ nút Soạn phần còn thiếu, không còn ngõ cụt chỉ tải DRAFT", async () => {
    const onProjectChanged = vi.fn();
    const d = doc({ status: "incomplete" });
    setImport({ doc: d, data: data({ import: d, target_structure: { target: "fpt", intent: "free", resolved_mode: 4, sections: [], missing: ["fixed:2.1", "fixed:5.1"], compared_at: "x" } }) });
    renderWithIntl(<ImportWorkspace projectId="p1" onProjectChanged={onProjectChanged} />);
    expect(screen.getByRole("heading", { name: "File còn thiếu 2 mục so với mẫu chuẩn FlintFlow" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Tải bản DRAFT/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Soạn phần còn thiếu/ }));
    expect(imp.current.continueFlow2).toHaveBeenCalled();
    await vi.waitFor(() => expect(onProjectChanged).toHaveBeenCalled());
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

  it("FLF-453 còn mục cần rà ⇒ dừng ở reviewing, báo credit trước khi xác nhận", async () => {
    const onProjectChanged = vi.fn();
    const d = doc({ status: "reviewing" });
    setImport({ doc: d, data: data({ import: d, review: { section_ids: ["fixed:1"], calls: 1, credits: 3 } }) });
    renderWithIntl(<ImportWorkspace projectId="p1" onProjectChanged={onProjectChanged} />);
    expect(screen.getByRole("heading", { name: /Rà soát 1 mục/ })).toBeInTheDocument();
    expect(screen.getByText(/~3 credit/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Rà soát và tiếp tục" }));
    expect(imp.current.runReview).toHaveBeenCalled();
    await vi.waitFor(() => expect(onProjectChanged).toHaveBeenCalled());
  });

  it("FLF-453 nút Rà soát bằng AI cho mục chỉ được Code kiểm: hiện credit riêng, xác nhận mới gọi, không sang Luồng 2", async () => {
    const onProjectChanged = vi.fn();
    const d = doc({ status: "reviewing" });
    const review = { section_ids: ["fixed:1"], calls: 1, credits: 3, optional_sections: [{ section_id: "fixed:2.1", title: "2.1 Product Perspective", calls: 2, credits: 6 }] };
    setImport({ doc: d, data: data({ import: d, review }) });
    renderWithIntl(<ImportWorkspace projectId="p1" onProjectChanged={onProjectChanged} />);
    expect(screen.getByText("2.1 Product Perspective")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Rà soát bằng AI" }));
    // Báo credit riêng của mục, chưa gọi gì
    expect(screen.getByText(/~6 credit/)).toBeInTheDocument();
    expect(imp.current.runSectionReview).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Xác nhận rà soát" }));
    expect(imp.current.runSectionReview).toHaveBeenCalledWith("fixed:2.1");
    await vi.waitFor(() => expect(screen.queryByText(/~6 credit/)).not.toBeInTheDocument());
    expect(onProjectChanged).not.toHaveBeenCalled();
  });

  it("FLF-453 Huỷ ở thẻ credit của mục ⇒ không gọi rà soát; không có mục nào chỉ-Code ⇒ không hiện khối", () => {
    const d = doc({ status: "reviewing" });
    const review = { section_ids: ["fixed:1"], calls: 1, credits: 3, optional_sections: [{ section_id: "fixed:2.1", title: "2.1 Product Perspective", calls: 2, credits: 6 }] };
    setImport({ doc: d, data: data({ import: d, review }) });
    const { unmount } = renderWithIntl(<ImportWorkspace projectId="p1" onProjectChanged={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Rà soát bằng AI" }));
    fireEvent.click(screen.getByRole("button", { name: "Huỷ" }));
    expect(imp.current.runSectionReview).not.toHaveBeenCalled();
    unmount();
    setImport({ doc: d, data: data({ import: d, review: { section_ids: ["fixed:1"], calls: 1, credits: 3 } }) });
    renderWithIntl(<ImportWorkspace projectId="p1" onProjectChanged={() => {}} />);
    expect(screen.queryByTestId("review-optional")).not.toBeInTheDocument();
  });

  it("FLF-453 bấm Dừng khi đang rà soát ⇒ gọi stopReview, không sang Luồng 2, không gọi AI thêm", () => {
    const onProjectChanged = vi.fn();
    const d = doc({ status: "reviewing" });
    setImport({ doc: d, data: data({ import: d, review: { section_ids: ["fixed:1"], calls: 1, credits: 3 } }) });
    renderWithIntl(<ImportWorkspace projectId="p1" onProjectChanged={onProjectChanged} />);
    fireEvent.click(screen.getByRole("button", { name: "Dừng" }));
    expect(imp.current.stopReview).toHaveBeenCalled();
    expect(imp.current.runReview).not.toHaveBeenCalled();
    expect(onProjectChanged).not.toHaveBeenCalled();
  });

  it("FLF-453 không mục nào cần rà (rỗng) ⇒ vẫn báo không tốn credit khi credits = 0", () => {
    const onProjectChanged = vi.fn();
    const d = doc({ status: "reviewing" });
    setImport({ doc: d, data: data({ import: d, review: { section_ids: ["fixed:1"], calls: 0, credits: 0 } }) });
    renderWithIntl(<ImportWorkspace projectId="p1" onProjectChanged={onProjectChanged} />);
    expect(screen.getByText("Rà soát các mục này không tốn credit")).toBeInTheDocument();
  });

  it("FLF-453 vòng rà soát dừng vì hết credit (gọi Rà soát rồi BE trả paused: credits) ⇒ báo cần nạp thêm, giữ reviewing", async () => {
    const onProjectChanged = vi.fn();
    const d = doc({ status: "reviewing", paused: { reason: "credits", at: "2026-11-26T00:00:00.000Z" } });
    setImport({ doc: d, data: data({ import: d, review: { section_ids: ["fixed:1"], calls: 1, credits: 3 } }) });
    renderWithIntl(<ImportWorkspace projectId="p1" onProjectChanged={onProjectChanged} />);
    expect(screen.getByText(/Vòng rà soát tạm dừng vì hết credit/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tiếp tục rà soát" })).toBeInTheDocument();
    expect(onProjectChanged).not.toHaveBeenCalled();
  });

  it("FLF-453 lượt AI rà soát lỗi (paused: resume_later) ⇒ báo gián đoạn, bấm lại để tiếp tục", () => {
    const d = doc({ status: "reviewing", paused: { reason: "resume_later", at: "2026-11-26T00:00:00.000Z" } });
    setImport({ doc: d, data: data({ import: d, review: { section_ids: ["fixed:1"], calls: 1, credits: 3 } }) });
    renderWithIntl(<ImportWorkspace projectId="p1" onProjectChanged={() => {}} />);
    expect(screen.getByText(/Vòng rà soát bị gián đoạn/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Tiếp tục rà soát" }));
    expect(imp.current.runReview).toHaveBeenCalled();
  });

  it("đang đọc ⇒ tiến trình 3 pha", () => {
    const d = doc({ status: "checking" });
    setImport({ doc: d, data: data({ import: d }) });
    renderWithIntl(<ImportWorkspace projectId="p1" onProjectChanged={() => {}} />);
    expect(screen.getByRole("listitem", { current: "step" })).toHaveTextContent("Kiểm tra");
  });

  it("FLF-462 bước 1.6: đoạn lớp 4 chữ hướng dẫn + mục tên đúng nội dung sai ⇒ màn xác nhận, mỗi nút gọi đúng confirmReview", () => {
    const d = doc({ status: "fields_review" });
    setImport({
      doc: d,
      data: data({
        import: d,
        extraction: {
          sections: [],
          review_fields: [],
          review_guidance: [{ section_id: "fixed:3.4", block_id: "B0042", text: "Mục này mô tả yêu cầu bảo mật.", is_guidance: true, confidence: 0.5, confirmed: false }],
          review_content_mismatch: [{ section_id: "fixed:2.2.2", by_heading: ["use_cases"], by_content: ["verifications"], note: "test cases", confirmed: false }],
        },
      }),
    });
    renderWithIntl(<ImportWorkspace projectId="p1" onProjectChanged={() => {}} />);
    expect(screen.getByText("Mục này mô tả yêu cầu bảo mật.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Là chữ hướng dẫn" }));
    expect(imp.current.confirmReview).toHaveBeenCalledWith({ guidance: [{ section_id: "fixed:3.4", block_id: "B0042", is_guidance: true }] });
    fireEvent.click(screen.getByRole("button", { name: "Đã xem" }));
    expect(imp.current.confirmReview).toHaveBeenCalledWith({ content_mismatch: [{ section_id: "fixed:2.2.2" }] });
    fireEvent.click(screen.getByRole("button", { name: "Xác nhận tất cả theo gợi ý của FlintFlow" }));
    expect(imp.current.confirmReview).toHaveBeenCalledWith({ confirm_all: true });
  });

  it("FLF-462 bước 1.6: chỉ còn phần tử I-4 độ tin thấp ⇒ liệt kê tên / giá trị gợi ý, Giữ / Bỏ gọi đúng confirmReview với fields[]", () => {
    const d = doc({ status: "fields_review" });
    setImport({
      doc: d,
      data: data({
        import: d,
        extraction: {
          sections: [],
          review_fields: [
            { section_id: "fixed:2.2.1", path: "use_cases[id=UC-02].name", value: "Đăng nhập hệ thống", confidence: 0.5, source_block_ids: ["B0010"], origin: "ai", confirmed: false },
          ],
          review_guidance: [],
          review_content_mismatch: [],
        },
      }),
    });
    renderWithIntl(<ImportWorkspace projectId="p1" onProjectChanged={() => {}} />);
    expect(screen.getByText("Đăng nhập hệ thống")).toBeInTheDocument();
    expect(screen.queryByText(/Còn vài chỗ FlintFlow đọc được/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Giữ giá trị này" }));
    expect(imp.current.confirmReview).toHaveBeenCalledWith({ fields: [{ section_id: "fixed:2.2.1", path: "use_cases[id=UC-02].name", confirmed: true }] });
    fireEvent.click(screen.getByRole("button", { name: "Bỏ" }));
    expect(imp.current.confirmReview).toHaveBeenCalledWith({ fields: [{ section_id: "fixed:2.2.1", path: "use_cases[id=UC-02].name", confirmed: false }] });
    fireEvent.click(screen.getByRole("button", { name: "Xác nhận tất cả theo gợi ý của FlintFlow" }));
    expect(imp.current.confirmReview).toHaveBeenCalledWith({ confirm_all: true });
  });

  it("FLF-462 bước 1.6: chỉ còn field độ tin thấp (không có đoạn lớp 4 / mục lệch cụ thể) ⇒ nút Tiếp tục xác nhận tất cả", () => {
    const d = doc({ status: "fields_review" });
    setImport({ doc: d, data: data({ import: d }) });
    renderWithIntl(<ImportWorkspace projectId="p1" onProjectChanged={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Tiếp tục" }));
    expect(imp.current.confirmReview).toHaveBeenCalledWith({ confirm_all: true });
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
