/**
 * FLF-466: trang đọc chỉ đọc (/projects/[id]/view) cho phép Viewer xuất bản ổn định sang Google Docs
 * (chỉ `source="baseline"` + `baselineId`), và tên file tải về dùng `versionFileName` kèm mã dự án.
 */
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithIntl } from "@/test/intl";
import { mockTiming, resetMockChangeFlowState, resetMockTranslationState } from "@/mocks/handlers";
import { mockServer } from "@/mocks/server";
import { MOCK_PROJECT_ID, resetMockState } from "@/mocks/state";
import { saveBlob } from "@/lib/api/files";
import { projectCode } from "@/types/doc-version";
import ReadOnlyDocumentPage from "./page";

const P = MOCK_PROJECT_ID;
const g = vi.hoisted(() => ({ sectionProps: vi.fn(), role: "viewer" as const }));

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: P }),
  useSearchParams: () => new URLSearchParams(""),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
}));
vi.mock("@/lib/api/token-store", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  getActiveOrgId: () => "org-1",
}));
vi.mock("@/lib/api/orgs", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  fetchOrganization: async () => ({ id: "org-1", name: "Org", role: g.role }),
}));
vi.mock("@/lib/google-auth", () => ({ isGoogleAuthEnabled: true, GOOGLE_CLIENT_ID: "abc.apps.googleusercontent.com" }));
vi.mock("@/lib/api/files", () => ({ saveBlob: vi.fn() }));
vi.mock("../_components/GoogleDocsExportSection", () => ({
  default: (props: Record<string, unknown>) => {
    g.sectionProps(props);
    return <div data-testid="viewer-google-docs-export" />;
  },
}));

beforeAll(() => {
  mockTiming.stepDelayMs = 0;
  mockServer.listen({ onUnhandledRequest: "error" });
});
beforeEach(() => {
  resetMockState();
  resetMockChangeFlowState();
  resetMockTranslationState();
  g.sectionProps.mockClear();
  vi.mocked(saveBlob).mockClear();
});
afterEach(() => mockServer.resetHandlers());
afterAll(() => mockServer.close());

describe("view/page.tsx FLF-466 (Viewer Google Docs & tên file)", () => {
  it("Viewer mở bản ổn định ⇒ có nút Xuất Google Docs (source=baseline) và tải Word không bị lỗi 'vv'", async () => {
    const bl = { id: "BL001", version: "1.0", snapshot_ref: "BL001", spine_version: 1, type: "generated", doc_version: null, created_by: "u1", created_at: "2026-11-01T00:00:00.000Z" };
    const doc = { projectId: P, projectName: "Demo", version: "1.0", source: "baseline", generatedAt: "2026-11-01T00:00:00.000Z", sections: [{ id: "fixed:1", number: "1", heading: "Overview", level: 1, blocks: [{ type: "paragraph", runs: [{ text: "Hi" }] }] }], recordOfChanges: [] };
    mockServer.use(
      http.get("*/projects/:projectId/baselines", () => HttpResponse.json({ data: [bl], error: null })),
      http.get("*/projects/:projectId/document", () => HttpResponse.json({ data: doc, error: null, meta: { assembled_at_version: 1, spine_version: 1, stale: false } })),
      http.get("*/projects/:projectId/export/word", () => HttpResponse.arrayBuffer(new ArrayBuffer(8), { headers: { "content-type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document" } }))
    );

    renderWithIntl(<ReadOnlyDocumentPage />);

    const exportBtn = await screen.findByRole("button", { name: "Xuất Google Docs" });
    fireEvent.click(exportBtn);
    expect(await screen.findByTestId("viewer-google-docs-export")).toBeInTheDocument();
    expect(g.sectionProps).toHaveBeenCalledWith(expect.objectContaining({ projectId: P, source: "baseline", baselineId: "BL001" }));

    fireEvent.click(screen.getByRole("button", { name: /Tải bản 1\.0/ }));
    await waitFor(() => expect(saveBlob).toHaveBeenCalled());
    const savedName = vi.mocked(saveBlob).mock.calls[0][1];
    expect(savedName).not.toContain("_vv");
    expect(savedName).toContain(`_${projectCode(P)}_v1.0.docx`);
  });
});
