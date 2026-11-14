import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

/**
 * E2E thực tế cho Billing, Credit & RBAC — FE Next.js + BE Express + MongoDB thật (không MSW, không mock).
 * Kiểm tra:
 *   1. Viewer fail-closed & không gọi bất kỳ API `/billing/*` nào kể cả lúc cold load hay đi thẳng URL.
 *   2. Analyst thấy số dư / giới hạn gói / dòng AI, bị chặn checkout, gửi Báo Lead nạp credit ⇒ Admin cộng
 *      credit qua `/admin/orgs/:orgId/credits` ⇒ Analyst nhận `credit_topped_up` có nhắc mở lại dự án & bấm Tiếp tục.
 *   3. Lead thấy đầy đủ VND + referenceCode + thanh toán pending + dòng `admin_adjust` có dấu `+` / `−`,
 *      và toàn bộ thông báo billing đổi VI ↔ EN sạch chữ tiếng Việt khi sang English.
 */

const API = process.env.E2E_API_URL ?? "http://localhost:5000/api/v1";
const PASSWORD = "Password123!";
const VIETNAMESE = /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i;

const loginThroughUi = async (page: Page, email: string) => {
  await page.goto("/login");
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(PASSWORD);
  await Promise.all([
    page.waitForURL(/\/home/),
    page.locator('form button[type="submit"]').click(),
  ]);
};

const apiLogin = async (request: APIRequestContext, email: string): Promise<string> => {
  const res = await request.post(`${API}/auth/login`, {
    data: { email, password: PASSWORD },
  });
  expect(res.status()).toBe(200);
  const body = (await res.json()) as { data?: { accessToken?: string } };
  const token = body.data?.accessToken;
  if (!token) throw new Error(`Missing accessToken for ${email}`);
  return token;
};

const getTextExcludingLang = async (page: Page, selector: string): Promise<string> => {
  return page.locator(selector).evaluate((el) => {
    const clone = el.cloneNode(true) as HTMLElement;
    clone.querySelectorAll("[lang]").forEach((node) => node.remove());
    return clone.textContent ?? "";
  });
};

test.describe.serial("Billing & Credit RBAC E2E", () => {
  test.beforeEach(async ({ request }) => {
    const probe = await request.post(`${API}/auth/login`, {
      data: { email: "e2e.viewer@flintflow.local", password: PASSWORD },
    });
    test.skip(
      !probe.ok(),
      "chưa có sân test billing E2E (e2e.viewer@flintflow.local) - chạy seed:e2e-billing rồi thử lại",
    );
  });

  test("Viewer: ẩn hoàn toàn billing UI, chặn URL billing/checkout và 0 request tới /billing/*", async ({ page }) => {
    const billingRequests: string[] = [];
    page.on("request", (req) => {
      if (/\/api\/v1\/billing(?:\b|\/|\?)/.test(req.url())) {
        billingRequests.push(`${req.method()} ${req.url()}`);
      }
    });

    await loginThroughUi(page, "e2e.viewer@flintflow.local");
    await expect(page.getByTestId("active-org-name")).toHaveText("E2E Billing Studio");

    const sidebar = page.getByRole("complementary", { name: "Điều hướng chính" });
    await expect(sidebar.locator('a[href="/home/billing"]')).toHaveCount(0);
    await expect(page.locator('header a[href="/home/billing"]')).toHaveCount(0);

    await page.getByRole("button", { name: "Tài khoản E2E Viewer" }).click();
    await expect(page.getByRole("menuitem", { name: /Hồ sơ cá nhân/ })).toBeVisible();
    await expect(page.getByRole("menuitem", { name: /Thanh toán/ })).toHaveCount(0);
    await page.keyboard.press("Escape");

    await page.goto("/home/profile");
    await expect(page.getByText("Thông tin cá nhân")).toBeVisible();
    await expect(page.getByText("e2e.viewer@flintflow.local").first()).toBeVisible();
    await expect(page.getByText("Credit hiện có")).toHaveCount(0);
    await expect(page.locator('a[href="/home/billing"]')).toHaveCount(0);

    await page.goto("/home/billing");
    await expect(page).toHaveURL(/\/home$/);

    await page.goto("/home/billing/checkout?intentId=intent_e2e_test");
    await expect(page).toHaveURL(/\/home$/);

    expect(billingRequests).toEqual([]);
  });

  test("Analyst: xem số dư & usage, checkout bị chuyển hướng, gửi yêu cầu nạp -> Admin cộng credit -> nhận thông báo nhắc bấm Tiếp tục (VI & EN)", async ({
    page,
    request,
  }) => {
    await loginThroughUi(page, "e2e.analyst@flintflow.local");
    await page.goto("/home/billing");

    await expect(page.getByRole("heading", { name: "Thanh toán & credit" })).toBeVisible();
    await expect(page.getByText("420", { exact: true })).toBeVisible();
    await expect(page.getByText("435", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("15", { exact: true })).toBeVisible();
    await expect(page.getByText("Tối đa 3 thành viên · 3 dự án").first()).toBeVisible();
    await expect(page.getByText("Tối đa 5 thành viên · 50 dự án")).toBeVisible();

    const usageRow = page.locator("li", { hasText: /1\.200 \/ 450/ });
    await expect(usageRow).toBeVisible();
    await expect(usageRow.getByText("E2E Core SRS")).toBeVisible();
    await expect(usageRow.getByText("E2E Analyst")).toBeVisible();
    await expect(usageRow.getByText("−6", { exact: true })).toBeVisible();

    await expect(page.getByRole("button", { name: "Mua ngay" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /Mua gói/ })).toHaveCount(0);

    await page.getByRole("combobox", { name: "Loại" }).click();
    await expect(page.getByRole("option", { name: "Sử dụng AI" })).toBeVisible();
    await expect(page.getByRole("option", { name: "Thanh toán" })).toHaveCount(0);
    await page.keyboard.press("Escape");

    await page.getByRole("button", { name: "Báo Lead nạp credit" }).click();
    await expect(page.getByText(/Đã báo 1 Lead/)).toBeVisible();

    await page.goto("/home/billing/checkout?intentId=intent_e2e_test");
    await expect(page).toHaveURL(/\/home\/billing$/);

    const [analystToken, adminToken] = await Promise.all([
      apiLogin(request, "e2e.analyst@flintflow.local"),
      apiLogin(request, "e2e.admin@flintflow.local"),
    ]);

    const orgsRes = await request.get(`${API}/orgs`, {
      headers: { Authorization: `Bearer ${analystToken}` },
    });
    expect(orgsRes.status()).toBe(200);
    const orgsJson = (await orgsRes.json()) as { data?: Array<{ id: string; name: string }> };
    const studio = orgsJson.data?.find((o) => o.name === "E2E Billing Studio");
    if (!studio) throw new Error("Missing E2E Billing Studio org");

    const topupRes = await request.patch(`${API}/admin/orgs/${studio.id}/credits`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { amount: 25, reason: "Topup for Analyst" },
    });
    expect(topupRes.status()).toBe(200);

    await page.goto("/home/notifications");
    await expect(page.getByText("Tổ chức đã được nạp 25 credit")).toBeVisible();
    await expect(page.getByText(/Mở lại dự án và bấm tiếp tục - bước đang dừng không tự chạy\./)).toBeVisible();

    const localeGroup = page.getByRole("group", { name: "Ngôn ngữ" });
    await localeGroup.getByRole("button", { name: "English" }).click();

    await expect(page.getByText("25 credits were added to the organization")).toBeVisible();
    await expect(page.getByText(/Reopen the project and press Continue - the paused step does not resume by itself\./)).toBeVisible();

    const panelTextEn = await getTextExcludingLang(page, "#notifications-panel");
    expect(VIETNAMESE.test(panelTextEn)).toBe(false);
  });

  test("Lead: thấy đủ VND + referenceCode + pending QR + admin_adjust dấu + / −, và thông báo billing đổi VI ↔ EN không sót tiếng Việt", async ({
    page,
  }) => {
    await loginThroughUi(page, "e2e.lead@flintflow.local");
    await page.goto("/home/billing");

    await expect(page.getByRole("button", { name: "Mua ngay" }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: /Mua gói Pro/ })).toBeVisible();

    const purchaseRow = page.locator("li", { hasText: "REF-E2E-100" });
    await expect(purchaseRow).toBeVisible();
    await expect(purchaseRow.getByText("40.000 ₫")).toBeVisible();
    await expect(purchaseRow.getByText("+100", { exact: true })).toBeVisible();

    const pendingRow = page.locator("li", { hasText: "Đang chờ" });
    await expect(pendingRow).toBeVisible();
    await expect(pendingRow.getByText("199.000 ₫")).toBeVisible();
    await expect(pendingRow.getByRole("button", { name: "Mở mã QR" })).toBeVisible();

    await expect(page.getByText("+50", { exact: true })).toBeVisible();
    await expect(page.getByText("+25", { exact: true })).toBeVisible();
    await expect(page.getByText("−15", { exact: true })).toBeVisible();

    await page.goto("/home/notifications");
    await expect(page.getByText("Tổ chức được cộng credit").first()).toBeVisible();
    await expect(page.getByText("+50 credit cho E2E Billing Studio. Lý do: Support bonus")).toBeVisible();
    await expect(page.getByText("Tổ chức bị trừ credit")).toBeVisible();
    await expect(page.getByText("-15 credit cho E2E Billing Studio. Lý do: Manual correction")).toBeVisible();
    await expect(page.getByText("Thanh toán thành công")).toBeVisible();
    await expect(page.getByText("Credit sắp hết")).toBeVisible();
    await expect(page.getByText("Tổ chức cần nạp credit")).toBeVisible();

    await page.getByRole("group", { name: "Ngôn ngữ" }).getByRole("button", { name: "English" }).click();

    await expect(page.getByText("Organization credits added").first()).toBeVisible();
    await expect(page.getByText("+50 credits for E2E Billing Studio. Reason: Support bonus")).toBeVisible();
    await expect(page.getByText("Organization credits deducted")).toBeVisible();
    await expect(page.getByText("-15 credits for E2E Billing Studio. Reason: Manual correction")).toBeVisible();
    await expect(page.getByText("Payment successful")).toBeVisible();
    await expect(page.getByText("Credits running low")).toBeVisible();
    await expect(page.getByText("Your organization needs credits")).toBeVisible();

    const panelTextEn = await getTextExcludingLang(page, "#notifications-panel");
    expect(VIETNAMESE.test(panelTextEn)).toBe(false);
  });
});
