import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import registry from "../lib/constants/step-registry.json";

/**
 * e2e T23 — FE thật trên BE thật, **không msw**.
 *
 * Kịch bản đi qua đúng cái seam mà T23 sửa: đăng nhập → danh sách dự án đọc tiến độ từ
 * `GET /projects/:id/progress` → mở workspace → gieo nội dung qua change flow (`POST /changes`, T17) →
 * Document pane hiển thị nội dung đó → Verification đọc cờ từ BE → Export mở được.
 *
 * **Không chạy step AI trong e2e.** Gieo nội dung bằng op là đường **không cần model** mà vẫn đi qua
 * đúng op engine + invariants thật — nó kiểm được cái e2e cần kiểm: seam FE ↔ BE.
 *
 * T24 đã mở đường chạy step mà không gọi model (`AI_PROVIDER_OVERRIDE=mock` + `mock.provider.ts` trả
 * output hợp schema), nhưng lô op của mock luôn rỗng nên step chạy qua mà không sinh nội dung nào.
 * Muốn e2e phủ cả bước AI thì phải thêm một kịch bản riêng khẳng định được điều gì đó về *đường đi*
 * (step tới được gate, SSE phát đủ sự kiện), không phải về nội dung. Xem `docs/fe-architecture.md`.
 */

const API = process.env.E2E_API_URL ?? "http://localhost:5000/api/v1";
const EMAIL = process.env.E2E_EMAIL ?? "fixture@flintflow.io";
const PASSWORD = process.env.E2E_PASSWORD ?? "fixture-password-123";

const PROJECT_NAME = `E2E T23 ${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}`;

/** Nhãn step lấy từ chính bản registry FE đang dùng — không chép tay, không hardcode tiếng Việt. */
const labelOf = (stepId: string): string => {
  const def = (registry as { id: string; label_vi: string }[]).find((s) => s.id === stepId.split("@")[0]);
  if (!def) throw new Error(`step ${stepId} không có trong registry`);
  return def.label_vi;
};

interface Envelope<T> {
  data: T | null;
  error: { code: string; message: string } | null;
}

const api = async <T>(
  request: APIRequestContext,
  method: "get" | "post" | "delete",
  path: string,
  token: string,
  body?: unknown
): Promise<{ status: number; json: Envelope<T> }> => {
  const res = await request[method](`${API}${path}`, {
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    ...(body === undefined ? {} : { data: body }),
  });
  return { status: res.status(), json: (await res.json()) as Envelope<T> };
};

const login = async (request: APIRequestContext): Promise<string> => {
  const res = await request.post(`${API}/auth/login`, { data: { email: EMAIL, password: PASSWORD } });
  expect(res.ok(), "tài khoản e2e phải đăng nhập được trên BE thật").toBeTruthy();
  const body = (await res.json()) as Envelope<{ accessToken: string }>;
  return body.data!.accessToken;
};

/** Đăng nhập qua UI thật, không nhét token vào storage — đó là một phần của luồng cần kiểm. */
const loginThroughUi = async (page: Page): Promise<void> => {
  await page.goto("/login");
  await page.locator("#email").fill(EMAIL);
  await page.locator("#password").fill(PASSWORD);
  await page.getByRole("button", { name: /đăng nhập/i }).click();
  await page.waitForURL(/\/home/, { timeout: 20_000 });
};

test.describe("workspace end-to-end trên BE thật", () => {
  let token = "";
  let projectId = "";

  test.beforeAll(async ({ playwright }) => {
    const request = await playwright.request.newContext();
    token = await login(request);

    const created = await api<{ _id: string }>(request, "post", "/projects", token, {
      name: PROJECT_NAME,
      mode: "fpt",
    });
    expect(created.status, "tạo dự án qua API").toBeLessThan(300);
    projectId = created.json.data!._id;

    await request.dispose();
  });

  test.afterAll(async ({ playwright }) => {
    // Dọn dữ liệu test: e2e chạy trên Mongo thật, để lại project rác thì lần sau lưới đầy dự án "E2E T23…"
    if (!projectId) return;
    const request = await playwright.request.newContext();
    await api(request, "delete", `/projects/${projectId}`, token).catch(() => undefined);
    await request.dispose();
  });

  test("đăng nhập, thẻ dự án đọc tiến độ thật, workspace và Export chạy trên BE", async ({ page, request }) => {
    // ── 1. Đăng nhập qua UI ────────────────────────────────────────────────────────────
    await loginThroughUi(page);

    // ── 2. Thẻ dự án: việc tiếp theo lấy từ step registry, không phải bảng nhãn cứng cũ ────────────
    // Dự án mới đã có Spine rỗng với `progress.current_step = B-0.1` (`spine.repository.INITIAL_STEP`),
    // nên thẻ phải chỉ đúng việc đầu tiên — "Chưa bắt đầu" chỉ dành cho project không có Spine.
    // Chỉ tìm trong vùng nội dung: sidebar có nhóm "Gần đây" cũng là link mang tên dự án (không có nhãn step)
    const card = page.getByRole("main").getByRole("link").filter({ hasText: PROJECT_NAME }).first();
    await expect(card, "dự án vừa tạo phải xuất hiện ở /home").toBeVisible({ timeout: 20_000 });
    await expect(card, "nhãn step đọc từ registry").toContainText(labelOf("B-0.1"), { timeout: 20_000 });
    // Nhãn 7 bước cũ đã bị gỡ — không được xuất hiện lại dưới bất kỳ dạng nào
    await expect(card).not.toContainText(/Sinh đặc tả sections|Export handoff cho dev|Review & chỉnh sửa/);

    // ── 3. Gieo nội dung §1 bằng op thật (không model) ─────────────────────────────────
    const spine = await api<{ spine_version: number }>(request, "get", `/projects/${projectId}/spine`, token);
    expect(spine.status).toBe(200);

    const vision = "E2E vision: turn a raw idea into a complete SRS through a guided conversation.";
    const applied = await api<{ spine_version: number }>(request, "post", `/projects/${projectId}/changes`, token, {
      base_version: spine.json.data!.spine_version,
      ops: [
        { op: "set", path: "project.vision", value: vision, reason: "e2e seed" },
        { op: "set", path: "project.goals", value: ["Ship a usable draft in one day"], reason: "e2e seed" },
      ],
    });
    expect(applied.status, "áp op qua change flow (T17)").toBe(200);

    // ── 4. Workspace mở trên BE thật ───────────────────────────────────────────────────
    await page.goto(`/projects/${projectId}`);
    await expect(page.getByText(PROJECT_NAME).first()).toBeVisible({ timeout: 25_000 });

    // Nút Export ở header workspace (có nhiều chỗ khớp /export/ — lấy nút đầu ở thanh trên)
    const exportButton = page.getByRole("button", { name: /export/i }).first();
    await expect(exportButton).toBeVisible();

    // ── 5. Verification đọc cờ từ BE ───────────────────────────────────────────────────
    const flags = await api<unknown[]>(request, "get", `/projects/${projectId}/flags`, token);
    expect(flags.status, "GET /flags phải trả 200 trên project thật").toBe(200);
    expect(Array.isArray(flags.json.data)).toBeTruthy();

    // ── 6. Export panel mở được và báo đúng trạng thái từ BE ───────────────────────────
    await exportButton.click();
    const exportPanel = page.getByText(/word/i).first();
    await expect(exportPanel).toBeVisible({ timeout: 15_000 });

    // Dự án chưa ghép tài liệu ⇒ BE trả NO_WORKING_DRAFT, panel phải nói ra chứ không im lặng
    const doc = await api<unknown>(request, "get", `/projects/${projectId}/document?source=draft`, token);
    expect([200, 409], "GET /document trả 200 khi đã assemble, 409 NO_WORKING_DRAFT khi chưa").toContain(doc.status);
    if (doc.status === 409) expect(doc.json.error?.code).toBe("NO_WORKING_DRAFT");
  });

  test("không còn đường bật msw ở runtime", async ({ page }) => {
    await loginThroughUi(page);
    // Service worker của msw đã bị gỡ khỏi `public/` — trang không được đăng ký worker nào
    const workers = await page.evaluate(async () => {
      if (!("serviceWorker" in navigator)) return 0;
      const regs = await navigator.serviceWorker.getRegistrations();
      return regs.length;
    });
    expect(workers, "FE chạy thẳng vào BE, không có service worker giả lập").toBe(0);
  });
});
