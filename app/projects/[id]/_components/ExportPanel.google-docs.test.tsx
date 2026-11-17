/**
 * ExportPanel + Google Docs: lựa chọn chỉ có khi FE có client id Google; chọn nó thì nút tải file được thay bằng phần
 * xuất Google Docs (truyền đúng nguồn + baseline + ngôn ngữ).
 */
import { fireEvent, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithIntl } from "@/test/intl";
import type { RenderedDocument } from "@/types/document";

const h = vi.hoisted(() => ({
  googleEnabled: true,
  sectionProps: vi.fn(),
  exportApi: {
    getDocument: vi.fn(),
    downloadWordExport: vi.fn(),
    downloadPdfExport: vi.fn(),
    listBaselines: vi.fn(),
  },
}));

vi.mock("@/lib/api/export", () => h.exportApi);
vi.mock("@/lib/google-auth", () => ({
  get isGoogleAuthEnabled() {
    return h.googleEnabled;
  },
  GOOGLE_CLIENT_ID: "abc.apps.googleusercontent.com",
}));
vi.mock("./GoogleDocsExportSection", () => ({
  default: (props: Record<string, unknown>) => {
    h.sectionProps(props);
    return <div data-testid="google-docs-section" />;
  },
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
  flagsAppendix: { redOpen: [], staleCount: 0, waived: [] },
};

const load = async () => {
  vi.resetModules();
  return (await import("./ExportPanel")).default;
};

beforeEach(() => {
  vi.clearAllMocks();
  h.exportApi.listBaselines.mockResolvedValue({ data: [], error: null });
  h.exportApi.getDocument.mockResolvedValue({ data: fixture, error: null, meta: { assembled_at_version: 3, spine_version: 3, stale: false } });
});

describe("ExportPanel - Google Docs", () => {
  it("có client id ⇒ có lựa chọn Google Docs; chọn ⇒ thay nút tải bằng phần xuất Google Docs", async () => {
    h.googleEnabled = true;
    const ExportPanel = await load();
    renderWithIntl(<ExportPanel projectId="p1" projectName="FlintFlow" onClose={vi.fn()} documentLanguage="vi" />);

    expect(await screen.findByRole("button", { name: /Tải bản nháp/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("radio", { name: /Google Docs/ }));

    expect(await screen.findByTestId("google-docs-section")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Tải bản nháp/ })).not.toBeInTheDocument();
    expect(h.sectionProps).toHaveBeenLastCalledWith(
      expect.objectContaining({ projectId: "p1", source: "draft", baselineId: undefined, lang: undefined, fileLanguage: "vi" })
    );
  });

  it("không có client id ⇒ chỉ Word và PDF", async () => {
    h.googleEnabled = false;
    const ExportPanel = await load();
    renderWithIntl(<ExportPanel projectId="p1" projectName="FlintFlow" onClose={vi.fn()} />);
    await screen.findByRole("button", { name: /Tải bản nháp/ });
    expect(screen.getAllByRole("radio").map((r) => r.textContent)).toEqual([expect.stringMatching(/^Word/), expect.stringMatching(/^PDF/)]);
  });
});
