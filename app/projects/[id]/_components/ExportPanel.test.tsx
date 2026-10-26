"use client";

import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { renderWithIntl } from "@/test/intl";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ExportPanel from "./ExportPanel";
import * as exportApi from "@/lib/api/export";
import { ApiClientError } from "@/lib/api/client";
import type { RenderedDocument } from "@/types/document";
import type { Baseline } from "@/types/spine";

vi.mock("@/lib/api/export", () => ({
  getDocument: vi.fn(),
  downloadWordExport: vi.fn(),
  downloadPdfExport: vi.fn(),
  listBaselines: vi.fn(),
}));

const fixture: RenderedDocument = {
  projectId: "p1",
  projectName: "FlintFlow",
  version: "v0.3",
  source: "draft",
  watermark: "DRAFT",
  generatedAt: "2026-09-15T00:00:00.000Z",
  sections: [],
  recordOfChanges: [],
  flagsAppendix: {
    redOpen: [{ id: "FL01", rule_id: "array_empty", section: "2.1 Actors", message: "Actors rỗng" }],
    staleCount: 0,
    waived: [],
  },
};

describe("ExportPanel", () => {
  const getDocument = vi.mocked(exportApi.getDocument);
  const downloadWordExport = vi.mocked(exportApi.downloadWordExport);
  const listBaselines = vi.mocked(exportApi.listBaselines);

  beforeEach(() => {
    getDocument.mockReset();
    downloadWordExport.mockReset();
    listBaselines.mockReset();
    listBaselines.mockResolvedValue({ data: [], error: null });
  });

  it("tải blob thành công: tạo <a> với blob URL rồi gọi click() (triggerDownload)", async () => {
    getDocument.mockResolvedValue({ data: fixture, error: null, meta: { assembled_at_version: 3, spine_version: 3, stale: false } });
    downloadWordExport.mockResolvedValue({ blob: new Blob(["x"]), filename: "FlintFlow-v0.3-draft.docx" });
    const createObjectURL = vi.fn(() => "blob:mock-url");
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("URL", { ...URL, createObjectURL, revokeObjectURL });
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    renderWithIntl(<ExportPanel projectId="p1" projectName="FlintFlow" onClose={vi.fn()} />);
    fireEvent.click(await screen.findByRole("button", { name: /Tải bản nháp/ }));

    await waitFor(() => expect(downloadWordExport).toHaveBeenCalledWith("p1", "draft", undefined));
    await waitFor(() => expect(clickSpy).toHaveBeenCalledTimes(1), { timeout: 3000 });
    expect(createObjectURL).toHaveBeenCalledTimes(1);

    clickSpy.mockRestore();
    vi.unstubAllGlobals();
  });

  it("FLF-318: có nhiều baseline (1.0 rồi release 2.0) ⇒ tab Bản baseline tải bản MỚI NHẤT, nút ghi rõ số version", async () => {
    const baseline = (id: string, version: string, type: Baseline["type"]): Baseline =>
      ({ id, version, type, doc_version: type === "release" ? version : null, at: "2026-10-26T00:00:00.000Z", snapshot_ref: id, checked_at_version: 1, waived_count: 0 }) as Baseline;
    listBaselines.mockResolvedValue({ data: [baseline("BL001", "v1.0", "generated"), baseline("BL002", "2.0", "release")], error: null });
    getDocument.mockResolvedValue({ data: { ...fixture, source: "baseline", version: "2.0" }, error: null, meta: {} });
    downloadWordExport.mockResolvedValue({ blob: new Blob(["x"]), filename: "FlintFlow-v2.0.docx" });
    vi.stubGlobal("URL", { ...URL, createObjectURL: vi.fn(() => "blob:mock-url"), revokeObjectURL: vi.fn() });
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    renderWithIntl(<ExportPanel projectId="p1" projectName="FlintFlow" onClose={vi.fn()} />);
    const tab = await screen.findByRole("tab", { name: "Bản baseline" });
    await waitFor(() => expect(tab).not.toBeDisabled());
    fireEvent.click(tab);
    fireEvent.click(await screen.findByRole("button", { name: /Tải bản baseline 2\.0/ }));
    await waitFor(() => expect(downloadWordExport).toHaveBeenCalledWith("p1", "baseline", "BL002"));

    clickSpy.mockRestore();
    vi.unstubAllGlobals();
  });

  it("dự án chưa có nội dung: báo lý do, không mời bấm sang bước nào", async () => {
    getDocument.mockResolvedValue({ data: null, error: null, meta: { state: "not_assembled" } });

    renderWithIntl(<ExportPanel projectId="p1" onClose={vi.fn()} />);

    expect(await screen.findByText(/chưa có nội dung nào để xuất/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Ghép/ })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Tải bản nháp/ })).toBeDisabled();
  });

  it("export/word trả 409 NO_WORKING_DRAFT: hiện lý do tiếng Việt (không phải message thô)", async () => {
    getDocument.mockResolvedValue({ data: fixture, error: null, meta: { assembled_at_version: 3, spine_version: 3, stale: false } });
    downloadWordExport.mockRejectedValue(new ApiClientError(409, "NO_WORKING_DRAFT", "thông điệp thô từ BE"));

    renderWithIntl(<ExportPanel projectId="p1" onClose={vi.fn()} />);
    fireEvent.click(await screen.findByRole("button", { name: /Tải bản nháp/ }));

    expect(await screen.findByText("Dự án chưa có nội dung nào để xuất ra tài liệu.")).toBeInTheDocument();
    expect(screen.queryByText(/thông điệp thô từ BE/)).not.toBeInTheDocument();
  });

  it("kiểm tra baseline lỗi hiện lỗi nhỏ thay vì nuốt lặng lẽ", async () => {
    getDocument.mockResolvedValue({ data: fixture, error: null, meta: { assembled_at_version: 3, spine_version: 3, stale: false } });
    listBaselines.mockRejectedValue(new Error("Không kết nối được máy chủ"));

    renderWithIntl(<ExportPanel projectId="p1" onClose={vi.fn()} />);

    expect(await screen.findByText(/Không kiểm tra được baseline/)).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Bản baseline" })).toBeDisabled();
  });

  it("hiện số cờ đỏ sẽ in vào §I từ flagsAppendix", async () => {
    getDocument.mockResolvedValue({ data: fixture, error: null, meta: { assembled_at_version: 3, spine_version: 3, stale: false } });

    renderWithIntl(<ExportPanel projectId="p1" onClose={vi.fn()} />);

    expect(await screen.findByText("Số cờ đỏ sẽ in vào §I")).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument();
  });
});

describe("ExportPanel — chọn định dạng Word / PDF (FLF-316)", () => {
  const getDocument = vi.mocked(exportApi.getDocument);
  const downloadWordExport = vi.mocked(exportApi.downloadWordExport);
  const downloadPdfExport = vi.mocked(exportApi.downloadPdfExport);
  const listBaselines = vi.mocked(exportApi.listBaselines);
  const draftMeta = { assembled_at_version: 3, spine_version: 3, stale: false };

  beforeEach(() => {
    getDocument.mockReset().mockResolvedValue({ data: fixture, error: null, meta: draftMeta });
    downloadWordExport.mockReset();
    downloadPdfExport.mockReset();
    listBaselines.mockReset();
    listBaselines.mockResolvedValue({ data: [], error: null });
  });

  it("mặc định Word; chọn PDF ⇒ nút đổi đuôi và tải qua downloadPdfExport, giữ nguồn đang chọn", async () => {
    listBaselines.mockResolvedValue({ data: [{ id: "BL001" } as Baseline], error: null });
    downloadPdfExport.mockResolvedValue({ blob: new Blob(["%PDF"]), filename: "FlintFlow-v1.0.pdf" });
    const createObjectURL = vi.fn(() => "blob:mock-url");
    vi.stubGlobal("URL", { ...URL, createObjectURL, revokeObjectURL: vi.fn() });
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    renderWithIntl(<ExportPanel projectId="p1" projectName="FlintFlow" onClose={vi.fn()} />);

    expect(await screen.findByRole("radio", { name: /Word/ })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("button", { name: "Tải bản nháp (.docx)" })).toBeInTheDocument();

    const baselineTab = screen.getByRole("tab", { name: "Bản baseline" });
    await waitFor(() => expect(baselineTab).toBeEnabled());
    fireEvent.click(baselineTab);
    fireEvent.click(screen.getByRole("radio", { name: /PDF/ }));
    expect(screen.getByRole("radio", { name: /PDF/ })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("tab", { name: "Bản baseline" })).toHaveAttribute("aria-selected", "true");

    fireEvent.click(await screen.findByRole("button", { name: "Tải bản baseline (.pdf)" }));

    await waitFor(() => expect(downloadPdfExport).toHaveBeenCalledWith("p1", "baseline", "BL001"));
    expect(downloadWordExport).not.toHaveBeenCalled();
    await waitFor(() => expect(clickSpy).toHaveBeenCalledTimes(1));

    clickSpy.mockRestore();
    vi.unstubAllGlobals();
  });

  it("503 PDF_EXPORT_UNAVAILABLE ⇒ câu cho user, gợi ý tải Word", async () => {
    downloadPdfExport.mockRejectedValue(
      new ApiClientError(503, "PDF_EXPORT_UNAVAILABLE", "Chưa xuất được PDF lúc này. Bạn hãy thử lại sau ít phút, hoặc tải bản Word.")
    );

    renderWithIntl(<ExportPanel projectId="p1" onClose={vi.fn()} />);
    fireEvent.click(await screen.findByRole("radio", { name: /PDF/ }));
    fireEvent.click(screen.getByRole("button", { name: "Tải bản nháp (.pdf)" }));

    expect(await screen.findByText(/Chưa xuất được PDF lúc này/)).toBeInTheDocument();
    expect(screen.queryByText(/PDF_EXPORT_UNAVAILABLE/)).not.toBeInTheDocument();
  });

  it("đổi định dạng xoá lỗi tải của lượt trước", async () => {
    downloadPdfExport.mockRejectedValue(new ApiClientError(503, "PDF_EXPORT_UNAVAILABLE", "Chưa xuất được PDF lúc này."));

    renderWithIntl(<ExportPanel projectId="p1" onClose={vi.fn()} />);
    fireEvent.click(await screen.findByRole("radio", { name: /PDF/ }));
    fireEvent.click(screen.getByRole("button", { name: "Tải bản nháp (.pdf)" }));
    expect(await screen.findByText(/Chưa xuất được PDF lúc này/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("radio", { name: /Word/ }));
    expect(screen.queryByText(/Chưa xuất được PDF lúc này/)).not.toBeInTheDocument();
  });
});

describe("ExportPanel — ngôn ngữ tài liệu (FLF-265)", () => {
  const getDocument = vi.mocked(exportApi.getDocument);
  const downloadWordExport = vi.mocked(exportApi.downloadWordExport);
  const listBaselines = vi.mocked(exportApi.listBaselines);
  const draftMeta = { assembled_at_version: 3, spine_version: 3, stale: false };
  /** Giá trị của dòng "Ngôn ngữ" trong khung thông tin bản xuất. */
  const languageRow = () => screen.getByText("Ngôn ngữ").nextElementSibling;

  beforeEach(() => {
    getDocument.mockReset();
    downloadWordExport.mockReset();
    listBaselines.mockReset();
    listBaselines.mockResolvedValue({ data: [], error: null });
  });

  it("còn mục chưa dịch ⇒ dòng Ngôn ngữ + cảnh báo vàng, nhưng KHÔNG chặn tải", async () => {
    getDocument.mockResolvedValue({ data: fixture, error: null, meta: { ...draftMeta, translation: { locale: "vi", source_locale: "en", missing: 5 } } });
    downloadWordExport.mockResolvedValue({ blob: new Blob(["x"]), filename: "FlintFlow-v0.3-draft.docx" });
    vi.stubGlobal("URL", { ...URL, createObjectURL: vi.fn(() => "blob:mock-url"), revokeObjectURL: vi.fn() });
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    renderWithIntl(<ExportPanel projectId="p1" onClose={vi.fn()} documentLanguage="vi" />);

    const warning = await screen.findByRole("status");
    expect(warning).toHaveTextContent("Còn 5 mục chưa dịch");
    // Không truyền onTranslate (Viewer) ⇒ chỉ báo, không có lối dịch
    expect(within(warning).queryByRole("button")).toBeNull();
    expect(languageRow()).toHaveTextContent("Tiếng Việt");
    const download = screen.getByRole("button", { name: /Tải bản nháp/ });
    expect(download).toBeEnabled();
    fireEvent.click(download);
    await waitFor(() => expect(downloadWordExport).toHaveBeenCalledWith("p1", "draft", undefined));
    await waitFor(() => expect(clickSpy).toHaveBeenCalledTimes(1));

    clickSpy.mockRestore();
    vi.unstubAllGlobals();
  });

  it("Lead/Analyst (có onTranslate) ⇒ cảnh báo kèm “Dịch tài liệu trước”", async () => {
    getDocument.mockResolvedValue({ data: fixture, error: null, meta: { ...draftMeta, translation: { locale: "vi", source_locale: "en", missing: 5 } } });
    const onTranslate = vi.fn();

    renderWithIntl(<ExportPanel projectId="p1" onClose={vi.fn()} documentLanguage="vi" onTranslate={onTranslate} />);

    fireEvent.click(within(await screen.findByRole("status")).getByRole("button", { name: "Dịch tài liệu trước" }));
    expect(onTranslate).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: /Tải bản nháp/ })).toBeEnabled();
  });

  it("tài liệu ở ngôn ngữ gốc ⇒ dòng Ngôn ngữ theo dự án, không cảnh báo", async () => {
    getDocument.mockResolvedValue({ data: fixture, error: null, meta: draftMeta });

    renderWithIntl(<ExportPanel projectId="p1" onClose={vi.fn()} documentLanguage="en" />);

    await screen.findByText("Ngôn ngữ");
    expect(languageRow()).toHaveTextContent("English");
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("mode 1 chưa biết ngôn ngữ file (null, không meta.translation) ⇒ không có dòng Ngôn ngữ", async () => {
    getDocument.mockResolvedValue({ data: fixture, error: null, meta: draftMeta });

    renderWithIntl(<ExportPanel projectId="p1" onClose={vi.fn()} documentLanguage={null} />);

    await screen.findByText("Số cờ đỏ sẽ in vào §I");
    expect(screen.queryByText("Ngôn ngữ")).toBeNull();
  });
});
