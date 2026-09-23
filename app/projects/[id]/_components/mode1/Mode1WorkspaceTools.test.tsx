/**
 * Cột công cụ mode 1 — chủ yếu là chỗ nối: ba link điều hướng, cờ + lối tạo CR, bảng version. Mode 1 v3 (bám BPMN):
 * không còn kế hoạch step / ký baseline v1.
 */
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { API_BASE_URL } from "@/lib/api/client";
import { mockServer } from "@/mocks/server";
import Mode1WorkspaceTools from "./Mode1WorkspaceTools";

const P = "650000000000000000000001";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useParams: () => ({ id: "650000000000000000000001" }),
}));

beforeAll(() => mockServer.listen({ onUnhandledRequest: "error" }));
afterEach(() => mockServer.resetHandlers());
afterAll(() => mockServer.close());

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
  has_tracked_file: false,
  has_original_file: true,
  created_by: "u1",
  created_at: "2026-09-20T03:00:00.000Z",
};

const renderTools = (over: Partial<Parameters<typeof Mode1WorkspaceTools>[0]> = {}) =>
  render(
    <Mode1WorkspaceTools
      projectId={P}
      projectName="Lumen LMS"
      flags={[]}
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

  it("hiện cờ + bảng version; không còn kế hoạch step, ký baseline v1 (mode 1 v3)", async () => {
    serveVersions([VERSION_00]);
    renderTools();
    expect(screen.getByText("Cờ & change request")).toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: "Release" })).toBeInTheDocument();
    expect(screen.queryByText("Kế hoạch step theo template")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Ký baseline v1" })).not.toBeInTheDocument();
  });

  it("release xong ⇒ tải lại CẢ Spine lẫn danh sách version", async () => {
    const versionCalls = serveVersions([VERSION_00]);
    mockServer.use(
      http.get(`${API_BASE_URL}/projects/:projectId/spine`, () => HttpResponse.json({ data: { spine_version: 7 }, error: null })),
      http.post(`${API_BASE_URL}/projects/:projectId/release`, () => HttpResponse.json({ data: { version: { version: "1.0" } }, error: null }, { status: 201 }))
    );
    const onSpineChanged = vi.fn();
    renderTools({ onSpineChanged });
    await waitFor(() => expect(versionCalls.n).toBe(1));
    fireEvent.click(await screen.findByRole("button", { name: "Release" }));
    fireEvent.click(screen.getByRole("button", { name: "Xác nhận release" }));
    await waitFor(() => expect(onSpineChanged).toHaveBeenCalled());
    await waitFor(() => expect(versionCalls.n, "bảng version phải tải lại").toBeGreaterThan(1));
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
