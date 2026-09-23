/**
 * Cột công cụ mode 1 (V6: trước đây 50% coverage). Nó chủ yếu là chỗ nối — nên kiểm đúng phần nối:
 * ba link điều hướng, và ký baseline v1 xong thì **cả Spine lẫn danh sách version** đều phải tải lại
 * (thiếu một trong hai là người dùng ký xong mà bảng version vẫn cũ).
 */
import { render, screen, waitFor, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { API_BASE_URL } from "@/lib/api/client";
import { mockServer } from "@/mocks/server";
import type { StepPlanEntry } from "@/types/import";
import type { StepSummary } from "@/types/pipeline";
import Mode1WorkspaceTools from "./Mode1WorkspaceTools";

const P = "650000000000000000000001";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useParams: () => ({ id: "650000000000000000000001" }),
}));

beforeAll(() => mockServer.listen({ onUnhandledRequest: "error" }));
afterEach(() => mockServer.resetHandlers());
afterAll(() => mockServer.close());

const PLAN: StepPlanEntry[] = [
  { step_id: "S-7.1", state: "applied", missing: false, section_ids: ["fixed:5.1"], reason: "Có trong file, đã có nội dung" },
];

const step = (id: string, status: StepSummary["status"]): StepSummary => ({
  id,
  phase: id.split(".")[0],
  label_vi: id,
  label_en: id,
  kind: "fixed",
  status,
  deterministic: false,
  calls_used: 0,
  calls_limit: 8,
  regenerate_used: 0,
  regenerate_limit: 3,
  accepted_at: null,
  running: false,
});

const serveVersions = (versions: unknown[]) => {
  const calls = { n: 0 };
  mockServer.use(
    http.get(`${API_BASE_URL}/projects/:projectId/versions`, () => {
      calls.n += 1;
      return HttpResponse.json({ data: versions, error: null });
    }),
    http.get(`${API_BASE_URL}/projects/:projectId/flags`, () => HttpResponse.json({ data: [], error: null }))
  );
  return calls;
};

const VERSION_00 = {
  version: "0.0",
  kind: "import",
  based_on: null,
  cr_ids: [],
  baseline_id: "B01",
  has_clean_file: false,
  has_original_file: true,
  created_by: "u1",
  created_at: "2026-09-20T03:00:00.000Z",
};

const renderTools = (over: Partial<Parameters<typeof Mode1WorkspaceTools>[0]> = {}) =>
  render(
    <Mode1WorkspaceTools
      projectId={P}
      projectName="Lumen LMS"
      plan={PLAN}
      planError={null}
      busyStep={null}
      onToggleStep={vi.fn()}
      steps={[step("S-7.1", "accepted")]}
      flags={[]}
      signedOff={false}
      onSelectStep={vi.fn()}
      getBaseVersion={() => 7}
      onSpineChanged={vi.fn()}
      {...over}
    />
  );

describe("Mode1WorkspaceTools", () => {
  it("ba lối đi của mode 1 đều có link đúng địa chỉ", async () => {
    serveVersions([VERSION_00]);
    renderTools();
    const nav = screen.getByRole("navigation", { name: "Import & change request" });
    expect(within(nav).getByRole("link", { name: "Gap report" })).toHaveAttribute("href", `/projects/${P}/gap-report`);
    expect(within(nav).getByRole("link", { name: "Change request" })).toHaveAttribute("href", `/projects/${P}/change-requests`);
    expect(within(nav).getByRole("link", { name: "Nhập SRS" })).toHaveAttribute("href", `/projects/${P}/import`);
  });

  it("hiện cả kế hoạch step lẫn bảng version", async () => {
    serveVersions([VERSION_00]);
    renderTools();
    expect(screen.getByText("Kế hoạch step theo template")).toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: "Release" })).toBeInTheDocument();
  });

  it("ký baseline v1 xong ⇒ tải lại CẢ Spine lẫn danh sách version", async () => {
    const versionCalls = serveVersions([VERSION_00]);
    mockServer.use(
      http.post(`${API_BASE_URL}/projects/:projectId/baseline`, () => HttpResponse.json({ data: { id: "B02", version: "v1.0" }, error: null }, { status: 201 }))
    );
    const onSpineChanged = vi.fn();
    renderTools({ onSpineChanged });

    await waitFor(() => expect(versionCalls.n).toBe(1));
    const before = versionCalls.n;
    screen.getByRole("button", { name: "Ký baseline v1" }).click();

    await waitFor(() => expect(onSpineChanged).toHaveBeenCalled());
    await waitFor(() => expect(versionCalls.n, "bảng version phải tải lại, không để số cũ").toBeGreaterThan(before));
  });

  it("lỗi tải version ⇒ báo ra, không nuốt", async () => {
    mockServer.use(
      http.get(`${API_BASE_URL}/projects/:projectId/versions`, () =>
        HttpResponse.json({ data: null, error: { code: "INTERNAL", message: "Không tải được version" } }, { status: 500 })
      ),
      http.get(`${API_BASE_URL}/projects/:projectId/flags`, () => HttpResponse.json({ data: [], error: null }))
    );
    renderTools();
    expect(await screen.findByRole("alert")).toHaveTextContent("Không tải được version");
  });
});
