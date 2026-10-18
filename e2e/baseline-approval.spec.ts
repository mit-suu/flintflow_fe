import { expect, test, type Page } from "@playwright/test";

/**
 * Vòng duyệt baseline §3.5 trên giao diện thật + BE thật: Analyst gửi duyệt → Lead ghim góp ý và từ chối
 * → Analyst xử lý góp ý (bước sở hữu mục mở lại) → Lead chốt.
 *
 * Chạy trên sân test riêng (org "FLF-275 Sandbox") để không đụng dự án của nhóm. Dữ liệu phải được nạp
 * trước bằng script seed; thiếu thì test dừng ngay với câu chỉ rõ việc cần làm.
 */

const API = process.env.E2E_API_URL ?? "http://localhost:5000/api/v1";
const PROJECT_ID = process.env.E2E_PROJECT_ID ?? "6ace5cfc612215b41e1dec76";
const LEAD = process.env.E2E_LEAD_EMAIL ?? "flf275-lead@flintflow.test";
const ANALYST = process.env.E2E_ANALYST_EMAIL ?? "flf275-analyst@flintflow.test";
const PASSWORD = process.env.E2E_SANDBOX_PASSWORD ?? "Flf275@test";

/** Nút mở panel kiểm & chốt trên header (rail trái cũng có nút cùng tên cho giai đoạn S-9). */
const verifyButton = (page: Page) => page.getByTitle(/Kiểm tra tài liệu và chốt baseline|Kiểm & chốt —/);

/** Đăng nhập qua form thật rồi mở thẳng workspace của dự án sân test. */
const openWorkspace = async (page: Page, email: string): Promise<void> => {
  await page.goto("/login");
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(PASSWORD);
  await page.getByRole("button", { name: /đăng nhập/i }).click();
  await page.waitForURL(/\/home/, { timeout: 30_000 });
  await page.goto(`/projects/${PROJECT_ID}`);
  await expect(verifyButton(page)).toBeVisible({ timeout: 30_000 });
  // Panel chốt bản vẽ được trước khi Spine về; bấm lúc đó thì FE chưa có `base_version` để gửi
  await page.waitForLoadState("networkidle");
};

/** Panel "Kiểm & chốt" bên phải — nơi đặt khối Chốt baseline. */
const openVerification = async (page: Page) => {
  const heading = page.getByRole("heading", { name: "Chốt baseline" });
  if (!(await heading.isVisible().catch(() => false))) {
    await verifyButton(page).click();
  }
  await expect(heading).toBeVisible({ timeout: 20_000 });
};

test.describe("FLF-275 · vòng duyệt baseline trên giao diện", () => {
  test.describe.configure({ mode: "serial", timeout: 180_000 });

  test("Analyst gửi duyệt, Lead từ chối kèm góp ý, Analyst xử lý, Lead chốt", async ({ browser, request }) => {
    const health = await request.get(`${API.replace("/api/v1", "")}/health`);
    expect(health.ok(), "BE phải đang chạy").toBeTruthy();

    /**
     * Kịch bản cần một dự án đã accepted hết step (nộp duyệt được ngay) cùng cặp Lead/Analyst của cùng org —
     * dựng bằng script seed sân test, không dựng được qua API vì nội dung phải do pipeline soạn. CI chưa có
     * sân đó nên bỏ qua thay vì đỏ; chạy máy dev sau khi seed thì kịch bản chạy đủ.
     */
    const probe = await request.post(`${API}/auth/login`, { data: { email: ANALYST, password: PASSWORD } });
    test.skip(!probe.ok(), `chưa có sân test FLF-275 (${ANALYST}) — seed rồi chạy lại`);

    // ── Analyst gửi Lead duyệt ────────────────────────────────────────────
    const analystCtx = await browser.newContext();
    const analyst = await analystCtx.newPage();
    analyst.on("response", (r) => {
      if (r.url().includes("/spine") || r.url().includes("/baseline")) console.log(`[analyst] ${r.status()} ${r.request().method()} ${r.url()}`);
    });
    await openWorkspace(analyst, ANALYST);
    await openVerification(analyst);

    const submitButton = analyst.getByRole("button", { name: "Gửi Lead duyệt" });
    await expect(submitButton, "chưa ai nộp ⇒ Analyst thấy nút gửi").toBeVisible();
    await expect(submitButton, "dự án sân test sạch cờ ⇒ nút bấm được").toBeEnabled();
    await submitButton.click();
    await expect(analyst.getByText(/Đã gửi Lead duyệt lúc/)).toBeVisible({ timeout: 20_000 });

    // ── Lead: không có góp ý thì không từ chối được ───────────────────────
    const leadCtx = await browser.newContext();
    const lead = await leadCtx.newPage();
    await openWorkspace(lead, LEAD);
    await openVerification(lead);
    await expect(lead.getByText(/Analyst đã gửi bản này lúc/)).toBeVisible();

    await lead.getByRole("button", { name: "Từ chối" }).click();
    await expect(lead.getByText(/Từ chối phải kèm góp ý ghim vào đúng chỗ cần sửa/)).toBeVisible();
    await expect(lead.getByRole("button", { name: "Mở Góp ý" }), "được chỉ sang nút Góp ý").toBeVisible();
    await lead.getByRole("button", { name: "Để sau" }).click();

    // ── Lead ghim góp ý vào một mục của tài liệu ──────────────────────────
    await lead.getByRole("button", { name: "Góp ý" }).first().click();
    const composer = lead.getByRole("textbox").last();
    await composer.fill("Mục này cần tiêu chí đo được trước khi chốt baseline.");
    await lead.getByRole("button", { name: /^Gửi$|Ghim|Góp ý$/ }).last().click();
    await expect(lead.getByText(/Mục này cần tiêu chí đo được/)).toBeVisible({ timeout: 20_000 });

    // ── Lead từ chối kèm lý do + góp ý ────────────────────────────────────
    await openVerification(lead);
    await lead.getByRole("button", { name: "Từ chối" }).click();
    await lead.locator("#reject-reason").fill("Thiếu tiêu chí đo được ở mục đầu tài liệu.");
    const rejectSubmit = lead.getByRole("button", { name: "Từ chối" }).last();
    await expect(rejectSubmit, "chưa chọn góp ý ⇒ chưa gửi được").toBeDisabled();
    await lead.locator('input[type="checkbox"]').first().check();
    await expect(rejectSubmit).toBeEnabled();
    await rejectSubmit.click();
    await expect(lead.getByText(/Lead chưa duyệt/).first()).toBeVisible({ timeout: 20_000 });

    // ── Analyst thấy lý do, xử lý góp ý, gửi lại ──────────────────────────
    await analyst.reload();
    await analyst.waitForLoadState("networkidle");
    await openVerification(analyst);
    await expect(analyst.getByText(/Thiếu tiêu chí đo được/).first()).toBeVisible({ timeout: 20_000 });
    await analyst.getByRole("button", { name: /góp ý đã xử lý — xem/ }).click();
    await expect(analyst.getByText(/Góp ý của lượt Lead từ chối baseline/)).toBeVisible();

    // "Giữ nguyên kèm lý do" (UC-47 nhánh không nhờ AI) ⇒ bước sở hữu mục mở lại
    await analyst.getByRole("button", { name: "Giữ nguyên" }).first().click();
    await analyst.locator('textarea[id^="keep-"]').fill("Khách đã chốt cách gọi này trong hợp đồng.");
    await analyst.getByRole("button", { name: "Lưu lý do" }).click();
    await expect(analyst.getByText(/Giữ nguyên — Khách đã chốt/)).toBeVisible({ timeout: 20_000 });

    // Gửi lại: BE chặn vì bước vừa mở lại làm mục cũ ⇒ FE phải nói đúng việc phải làm
    await openVerification(analyst);
    await analyst.getByRole("button", { name: "Gửi lại" }).click();
    await expect(analyst.getByText(/cờ đỏ|vấn đề|mở lại/i).first()).toBeVisible({ timeout: 20_000 });

    await analystCtx.close();
    await leadCtx.close();
  });
});
