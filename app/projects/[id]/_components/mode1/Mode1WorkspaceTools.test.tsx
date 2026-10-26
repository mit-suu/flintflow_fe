/**
 * Cột công cụ mode 1 — chủ yếu là chỗ nối: ba link điều hướng, cờ + lối tạo CR, bảng version. Mode 1 v3 (bám BPMN):
 * không còn kế hoạch step / ký baseline v1.
 */
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { renderWithIntl } from "@/test/intl";
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

/** Gói thay đổi (FLF-330) đang soạn, một CR đã ghi — Lead phát hành thẳng được. */
const servePackage = () =>
  mockServer.use(
    http.get(`${API_BASE_URL}/projects/:projectId/review-package`, () =>
      HttpResponse.json({
        data: {
          status: "drafting",
          base_version: "v0",
          latest_version: "0.2",
          next_version: "1.0",
          draft_label: "v0 · 1 thay đổi chưa duyệt",
          change_requests: [{ cr_id: "CR-001", title: "Nhanh hơn", requester: "PM Lan", source: { kind: "verbal", ref: null }, result_doc_version: "0.2", written_at: "2026-10-26T01:00:00.000Z" }],
          red_open: 0,
          submission: null,
          spine_version: 7,
        },
        error: null,
      })
    )
  );

const VERSION_00 = {
  version: "0.1",
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
  renderWithIntl(
    <Mode1WorkspaceTools
      projectId={P}
      projectName="Lumen LMS"
      flags={[]}
      onSpineChanged={vi.fn()}
      canRelease
      {...over}
    />
  );

describe("Mode1WorkspaceTools", () => {
  it("ba lối đi của mode 1 đều có link đúng địa chỉ", async () => {
    serveVersions([VERSION_00]);
    renderTools();
    const nav = screen.getByRole("navigation", { name: "Import & change request" });
    expect(within(nav).getByRole("link", { name: "Gap report" })).toHaveAttribute("href", `/projects/${P}?panel=gap`);
    expect(within(nav).getByRole("link", { name: "Change request" })).toHaveAttribute("href", `/projects/${P}?panel=cr`);
    expect(within(nav).getByRole("link", { name: "Nhập SRS" })).toHaveAttribute("href", `/projects/${P}/import`);
  });

  it("hiện cờ + gói thay đổi (FLF-330) + bảng version; không còn kế hoạch step, ký baseline v1, Release riêng của bảng version", async () => {
    serveVersions([VERSION_00]);
    servePackage();
    renderTools();
    expect(screen.getByText("Cờ & change request")).toBeInTheDocument();
    expect(await screen.findByText("Gói thay đổi")).toBeInTheDocument();
    expect(screen.queryByText("Kế hoạch step theo template")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Ký baseline v1" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Release" })).not.toBeInTheDocument();
  });

  it("Lead phát hành từ gói thay đổi ⇒ tải lại CẢ Spine lẫn danh sách version", async () => {
    const versionCalls = serveVersions([VERSION_00]);
    servePackage();
    mockServer.use(
      http.get(`${API_BASE_URL}/projects/:projectId/spine`, () => HttpResponse.json({ data: { spine_version: 7 }, error: null })),
      http.post(`${API_BASE_URL}/projects/:projectId/release`, () => HttpResponse.json({ data: { version: { version: "1.0" }, cr_ids: ["CR-001"], spine_version: 8 }, error: null }, { status: 201 }))
    );
    const onSpineChanged = vi.fn();
    renderTools({ onSpineChanged, orgRole: "lead" });
    await waitFor(() => expect(versionCalls.n).toBe(1));
    fireEvent.click(await screen.findByRole("button", { name: "Phát hành thẳng (Lead)" }));
    fireEvent.click(screen.getByRole("button", { name: "Xác nhận phát hành" }));
    await waitFor(() => expect(onSpineChanged).toHaveBeenCalled());
    await waitFor(() => expect(versionCalls.n, "bảng version phải tải lại").toBeGreaterThan(1));
  });

  it("lỗi tải version ⇒ báo ra, không nuốt", async () => {
    servePackage();
    mockServer.use(
      http.get(`${API_BASE_URL}/projects/:projectId/versions`, () =>
        HttpResponse.json({ data: null, error: { code: "INTERNAL", message: "Không tải được version" } }, { status: 500 })
      ),
      http.get(`${API_BASE_URL}/projects/:projectId/flags`, () => HttpResponse.json({ data: [], error: null }))
    );
    renderTools();
    expect(await screen.findByText("Không tải được version")).toHaveAttribute("role", "alert");
  });
});

describe("Mode1WorkspaceTools — Viewer (readOnly)", () => {
  it("không có Nhập SRS và Release; vẫn có Gap report, Change request và bảng version", async () => {
    serveVersions([VERSION_00]);
    renderTools({ readOnly: true });
    const nav = screen.getByRole("navigation", { name: "Import & change request" });
    expect(within(nav).getByRole("link", { name: "Gap report" })).toBeInTheDocument();
    expect(within(nav).getByRole("link", { name: "Change request" })).toBeInTheDocument();
    expect(within(nav).queryByRole("link", { name: "Nhập SRS" })).not.toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: "Các version" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Release" })).not.toBeInTheDocument();
  });
});

describe("Mode1WorkspaceTools — Analyst (không phải Lead)", () => {
  it("vẫn có Nhập SRS nhưng không có Release (chỉ Lead release)", async () => {
    serveVersions([VERSION_00]);
    renderTools({ canRelease: false });
    const nav = screen.getByRole("navigation", { name: "Import & change request" });
    expect(within(nav).getByRole("link", { name: "Nhập SRS" })).toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: "Các version" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Release" })).not.toBeInTheDocument();
  });
});
