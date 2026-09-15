"use client";

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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

    render(<ExportPanel projectId="p1" projectName="FlintFlow" onClose={vi.fn()} />);
    fireEvent.click(await screen.findByRole("button", { name: /Tải bản nháp/ }));

    await waitFor(() => expect(downloadWordExport).toHaveBeenCalledWith("p1", "draft", undefined));
    await waitFor(() => expect(clickSpy).toHaveBeenCalledTimes(1), { timeout: 3000 });
    expect(createObjectURL).toHaveBeenCalledTimes(1);

    clickSpy.mockRestore();
    vi.unstubAllGlobals();
  });

  it("409 NO_WORKING_DRAFT (chưa ghép): hiện lý do tiếng Việt + nút 'Đi tới S-8.2', bấm gọi onGoToStep và đóng panel", async () => {
    getDocument.mockRejectedValue(
      new ApiClientError(409, "NO_WORKING_DRAFT", "Chưa ghép tài liệu — chạy POST /assemble trước (S-8.2).")
    );
    const onGoToStep = vi.fn();
    const onClose = vi.fn();

    render(<ExportPanel projectId="p1" onClose={onClose} onGoToStep={onGoToStep} />);

    expect(await screen.findByText(/Chưa ghép tài liệu/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Đi tới S-8.2/ }));

    expect(onGoToStep).toHaveBeenCalledWith("S-8.2");
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("bấm tải khi đã ghép nhưng export/word trả 409 NO_WORKING_DRAFT: hiện lý do tiếng Việt (không phải message thô)", async () => {
    getDocument.mockResolvedValue({ data: fixture, error: null, meta: { assembled_at_version: 3, spine_version: 3, stale: false } });
    downloadWordExport.mockRejectedValue(new ApiClientError(409, "NO_WORKING_DRAFT", "Chưa ghép — chạy S-8.2 (thông điệp thô từ BE)"));

    render(<ExportPanel projectId="p1" onClose={vi.fn()} />);
    fireEvent.click(await screen.findByRole("button", { name: /Tải bản nháp/ }));

    expect(await screen.findByText("Chưa ghép tài liệu — chạy S-8.2 trước.")).toBeInTheDocument();
    expect(screen.queryByText(/thông điệp thô từ BE/)).not.toBeInTheDocument();
  });

  it("kiểm tra baseline lỗi hiện lỗi nhỏ thay vì nuốt lặng lẽ", async () => {
    getDocument.mockResolvedValue({ data: fixture, error: null, meta: { assembled_at_version: 3, spine_version: 3, stale: false } });
    listBaselines.mockRejectedValue(new Error("Không kết nối được máy chủ"));

    render(<ExportPanel projectId="p1" onClose={vi.fn()} />);

    expect(await screen.findByText(/Không kiểm tra được baseline/)).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Word baseline" })).toBeDisabled();
  });

  it("hiện số cờ đỏ sẽ in vào §I từ flagsAppendix", async () => {
    getDocument.mockResolvedValue({ data: fixture, error: null, meta: { assembled_at_version: 3, spine_version: 3, stale: false } });

    render(<ExportPanel projectId="p1" onClose={vi.fn()} />);

    expect(await screen.findByText("Số cờ đỏ sẽ in vào §I")).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument();
  });
});
