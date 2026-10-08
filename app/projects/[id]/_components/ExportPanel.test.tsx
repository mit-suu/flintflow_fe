"use client";

import { fireEvent, screen, waitFor } from "@testing-library/react";
import { renderWithIntl } from "@/test/intl";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ExportPanel from "./ExportPanel";
import * as exportApi from "@/lib/api/export";
import { ApiClientError } from "@/lib/api/client";
import type { RenderedDocument } from "@/types/document";

vi.mock("@/lib/api/export", () => ({
  getDocument: vi.fn(),
  downloadWordExport: vi.fn(),
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
    expect(screen.getByRole("tab", { name: "Word baseline" })).toBeDisabled();
  });

  it("hiện số cờ đỏ sẽ in vào §I từ flagsAppendix", async () => {
    getDocument.mockResolvedValue({ data: fixture, error: null, meta: { assembled_at_version: 3, spine_version: 3, stale: false } });

    renderWithIntl(<ExportPanel projectId="p1" onClose={vi.fn()} />);

    expect(await screen.findByText("Số cờ đỏ sẽ in vào §I")).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument();
  });
});
