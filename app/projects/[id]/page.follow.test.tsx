import { act, screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { renderWithIntl } from "@/test/intl";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockTiming, resetMockChangeFlowState } from "@/mocks/handlers";
import { mockServer } from "@/mocks/server";
import { MOCK_PROJECT_ID, mockState, resetMockState } from "@/mocks/state";
import WorkspacePage from "./page";

const { router } = vi.hoisted(() => ({ router: { push: vi.fn(), replace: vi.fn() } }));

vi.mock("next/navigation", () => ({
  useRouter: () => router,
  useParams: () => ({ id: MOCK_PROJECT_ID }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => `/projects/${MOCK_PROJECT_ID}`,
}));
// Đã đăng nhập: AuthGuard/useWorkspace không gọi refresh
vi.mock("@/lib/auth", async (importOriginal) => ({ ...(await importOriginal<object>()), isAuthenticated: () => true }));

Element.prototype.scrollIntoView = vi.fn();

/** Số lần BE bị gọi theo đường dẫn (không tính query). */
const calls = new Map<string, number>();
const count = (suffix: string) => [...calls].filter(([path]) => path.endsWith(suffix)).reduce((sum, [, n]) => sum + n, 0);

/** Phần `/version` do test điều khiển; mặc định khớp đúng tài liệu mock đang hiển thị. */
const remote = { spineAhead: 0, revisionSuffix: "" };

beforeAll(() => {
  mockTiming.stepDelayMs = 0;
  mockServer.listen({ onUnhandledRequest: "error" });
  mockServer.events.on("request:start", ({ request }) => {
    const path = new URL(request.url).pathname;
    calls.set(path, (calls.get(path) ?? 0) + 1);
  });
  Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "visible" });
});
beforeEach(() => {
  resetMockState();
  resetMockChangeFlowState();
  calls.clear();
  remote.spineAhead = 0;
  remote.revisionSuffix = "";
  mockServer.use(
    http.get("*/projects/:projectId/run-state/active", () => HttpResponse.json({ data: null, error: null })),
    http.get("*/projects/:projectId/version", () =>
      HttpResponse.json({
        data: { spine_version: mockState.spine.spine_version + remote.spineAhead, document_revision: `${mockState.spine.spine_version}:en${remote.revisionSuffix}` },
        error: null,
      })
    )
  );
});
afterEach(() => mockServer.resetHandlers());
afterAll(() => mockServer.close());

const pollVersion = () => act(async () => void document.dispatchEvent(new Event("visibilitychange")));

describe("WorkspacePage — tài liệu tự bám bản mới", () => {
  it("revision tài liệu đổi ở nơi khác ⇒ tải lại tài liệu đúng một lần; không poll /document hay /progress", async () => {
    renderWithIntl(<WorkspacePage />);
    await screen.findByText(/1\. Product Overview/);
    await waitFor(() => expect(count("/version")).toBe(1));
    expect(count("/document")).toBe(1);
    const progressBefore = count("/progress");

    remote.revisionSuffix = "+dịch";
    await pollVersion();

    await waitFor(() => expect(count("/document")).toBe(2));
    // Đi cùng đường onSpineChanged: Spine + tiến độ tải lại cùng tài liệu
    await waitFor(() => expect(count("/progress")).toBeGreaterThan(progressBefore));
    expect(count("/version")).toBe(2);
  }, 30_000);

  it("chỉ spine_version đổi (cùng revision tài liệu) ⇒ đọc lại Spine, KHÔNG tải lại tài liệu", async () => {
    renderWithIntl(<WorkspacePage />);
    await screen.findByText(/1\. Product Overview/);
    await waitFor(() => expect(count("/version")).toBe(1));
    const spineBefore = count("/spine");

    remote.spineAhead = 3;
    await pollVersion();

    await waitFor(() => expect(count("/spine")).toBeGreaterThan(spineBefore));
    expect(count("/document")).toBe(1);
  }, 30_000);
});
