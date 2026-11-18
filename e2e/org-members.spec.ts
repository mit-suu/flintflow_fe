import { expect, test } from "@playwright/test";
import { loginThroughUi } from "./login-helper";

const API = process.env.E2E_API_URL ?? "http://localhost:5000/api/v1";
const LEAD_EMAIL = process.env.E2E_FLF422_LEAD ?? "flf422-lead@flintflow.test";
const ANALYST_EMAIL = process.env.E2E_FLF422_ANALYST ?? "flf422-analyst@flintflow.test";
const STRANGER_EMAIL = process.env.E2E_FLF422_STRANGER ?? "flf422-stranger@flintflow.test";
const PASSWORD = process.env.E2E_FLF422_PASSWORD ?? "Flf422@test";

test.use({ launchOptions: { slowMo: process.env.CI ? 0 : 120 } });

test.describe("FLF-422 · Tổ chức & Thành viên end-to-end", () => {
  test.describe.configure({ mode: "serial", timeout: 180_000 });

  test("UC-07..10, UC-13..15, UC-80..81, BR-02 trọn luồng trên BE & FE thật", async ({ browser, request }) => {
    const health = await request.get(`${API.replace("/api/v1", "")}/health`);
    expect(health.ok(), "BE phải đang chạy").toBeTruthy();

    // Tương tự baseline-approval.spec.ts: CI mặc định chỉ seed fixture@flintflow.io;
    // bỏ qua sạch khi chưa gieo tài khoản sandbox FLF-422.
    const probe = await request.post(`${API}/auth/login`, {
      data: { email: LEAD_EMAIL, password: PASSWORD },
    });
    test.skip(!probe.ok(), `chưa có tài khoản test FLF-422 (${LEAD_EMAIL})`);

    const leadCtx = await browser.newContext();
    const analystCtx = await browser.newContext();
    const strangerCtx = await browser.newContext();

    try {
      const leadPage = await leadCtx.newPage();
      const analystPage = await analystCtx.newPage();
      const strangerPage = await strangerCtx.newPage();

      // ── 1. UC-07 & UC-80: Tạo org từ Onboarding + Đổi tên tổ chức ───────────────────
      await loginThroughUi(leadPage, LEAD_EMAIL, PASSWORD);
      await leadPage.waitForURL(/\/home\/onboarding/, { timeout: 20_000 });
      await expect(leadPage.getByRole("heading", { name: "Chọn nơi làm việc" })).toBeVisible();

      await leadPage.locator("#org-name").fill("Org Alpha E2E");
      await leadPage.getByRole("button", { name: "Tạo tổ chức" }).click();
      await leadPage.waitForURL(/\/home$/, { timeout: 20_000 });
      await expect(leadPage.getByTestId("active-org-name")).toContainText("Org Alpha E2E", { timeout: 20_000 });

      await leadPage.getByRole("link", { name: "Thành viên" }).click();
      await leadPage.waitForURL(/\/home\/members/, { timeout: 20_000 });
      await expect(leadPage.getByText("Thành viên của Org Alpha E2E")).toBeVisible();

      await leadPage.getByRole("button", { name: "Đổi tên tổ chức" }).click();
      const renameDialog = leadPage.getByRole("dialog", { name: "Đổi tên tổ chức" });
      await renameDialog.getByLabel(/Tên tổ chức/).fill("Org Alpha Updated");
      await renameDialog.getByRole("button", { name: "Lưu" }).click();
      await expect(renameDialog).toBeHidden({ timeout: 15_000 });
      await expect(leadPage.getByText("Thành viên của Org Alpha Updated")).toBeVisible();
      await expect(leadPage.getByTestId("active-org-name")).toContainText("Org Alpha Updated");

      // ── 2. UC-08 & UC-09: Mời thành viên, chặn lệch email, chấp nhận & đồng bộ session ──
      await leadPage.getByRole("button", { name: "Mời thành viên" }).click();
      const inviteDialog1 = leadPage.getByRole("dialog", { name: "Mời thành viên" });
      await inviteDialog1.getByLabel("Vai trò").selectOption("analyst");
      await inviteDialog1.getByLabel("Email người được mời").fill(ANALYST_EMAIL);
      await inviteDialog1.getByRole("button", { name: "Tạo mã mời" }).click();
      const code1 = (await inviteDialog1.getByTestId("invite-code").innerText()).trim();
      expect(code1.length).toBeGreaterThanOrEqual(8);
      await inviteDialog1.getByRole("button", { name: "Đóng" }).last().click();
      await expect(inviteDialog1).toBeHidden();
      await expect(leadPage.getByText(ANALYST_EMAIL)).toBeVisible();
      await expect(leadPage.getByText(/Analyst · Đang chờ/)).toBeVisible();

      // Người lạ nhập mã cấp cho Analyst -> 403 INVITE_EMAIL_MISMATCH, mã không bị hỏng
      await loginThroughUi(strangerPage, STRANGER_EMAIL, PASSWORD);
      await strangerPage.waitForURL(/\/home\/onboarding/, { timeout: 20_000 });
      await strangerPage.getByRole("tab", { name: "Nhập mã mời" }).click();
      await strangerPage.locator("#invite-code").fill(code1);
      await strangerPage.getByRole("button", { name: "Kiểm tra mã" }).click();
      await expect(
        strangerPage
          .getByRole("alert")
          .filter({ hasText: "Mã mời này được cấp riêng cho một địa chỉ email khác." })
      ).toBeVisible();

      // Analyst nhập đúng mã -> xem trước -> tham gia -> F5 vẫn giữ Org Alpha Updated
      await loginThroughUi(analystPage, ANALYST_EMAIL, PASSWORD);
      await analystPage.waitForURL(/\/home\/onboarding/, { timeout: 20_000 });
      await analystPage.getByRole("tab", { name: "Nhập mã mời" }).click();
      await analystPage.locator("#invite-code").fill(code1);
      await analystPage.getByRole("button", { name: "Kiểm tra mã" }).click();
      await expect(analystPage.getByText("Lời mời hợp lệ")).toBeVisible();
      await expect(analystPage.getByText("Bạn sẽ tham gia Org Alpha Updated với vai trò Analyst.")).toBeVisible();
      await analystPage.getByRole("button", { name: "Tham gia tổ chức" }).click();
      await analystPage.waitForURL(/\/home$/, { timeout: 20_000 });
      await expect(analystPage.getByTestId("active-org-name")).toContainText("Org Alpha Updated", { timeout: 20_000 });

      await analystPage.reload();
      await expect(analystPage.getByTestId("active-org-name")).toContainText("Org Alpha Updated", { timeout: 20_000 });

      // Analyst vào /home/members: chỉ xem, không mời/xoá org, menu bản thân luôn là Rời tổ chức
      await analystPage.getByRole("link", { name: "Thành viên" }).click();
      await analystPage.waitForURL(/\/home\/members/, { timeout: 20_000 });
      await expect(analystPage.getByText("Chỉ Lead mới mời, đổi vai trò hoặc xoá thành viên.")).toBeVisible();
      await expect(analystPage.getByRole("button", { name: "Mời thành viên" })).toHaveCount(0);
      await expect(analystPage.getByRole("button", { name: "Xoá tổ chức" })).toHaveCount(0);

      await analystPage.getByRole("button", { name: "Thao tác với Analyst FLF-422" }).click();
      await expect(analystPage.getByRole("menuitem", { name: "Rời tổ chức" })).toBeVisible();
      await expect(analystPage.getByRole("menuitem", { name: "Xoá khỏi tổ chức" })).toHaveCount(0);
      await analystPage.keyboard.press("Escape");

      // ── 3. UC-14 & BR-02: Khoá Lead duy nhất & cho phép tự hạ vai trò khi >= 2 Lead ──
      await leadPage.reload();
      await expect(leadPage.locator("#sole-lead-hint")).toBeVisible({ timeout: 20_000 });
      await expect(leadPage.getByLabel("Vai trò của Lead FLF-422")).toHaveCount(0);
      await expect(leadPage.getByRole("button", { name: "Xoá tổ chức" })).toBeDisabled();

      await leadPage.getByLabel("Vai trò của Analyst FLF-422").selectOption("lead");
      await expect(leadPage.getByLabel("Vai trò của Lead FLF-422")).toBeVisible({ timeout: 15_000 });

      await analystPage.reload();
      await expect(analystPage.getByRole("button", { name: "Mời thành viên" })).toBeVisible({ timeout: 20_000 });
      await analystPage.getByLabel("Vai trò của Analyst FLF-422").selectOption("analyst");
      await expect(analystPage.getByRole("button", { name: "Mời thành viên" })).toHaveCount(0, { timeout: 15_000 });
      await expect(analystPage.getByText("Chỉ Lead mới mời, đổi vai trò hoặc xoá thành viên.")).toBeVisible();

      // ── 4. UC-10 & UC-13: Đa org + Bị đuổi giữa phiên -> tự văng về /home/organizations ─
      await analystPage.getByTestId("active-org-name").click();
      await analystPage.getByRole("menuitem", { name: "Tạo hoặc tham gia" }).click();
      await analystPage.waitForURL(/\/home\/onboarding/, { timeout: 20_000 });
      await analystPage.locator("#org-name").fill("Org Beta Analyst");
      await analystPage.getByRole("button", { name: "Tạo tổ chức" }).click();
      await analystPage.waitForURL(/\/home$/, { timeout: 20_000 });
      await expect(analystPage.getByTestId("active-org-name")).toContainText("Org Beta Analyst", { timeout: 20_000 });

      await analystPage.getByTestId("active-org-name").click();
      await analystPage.getByRole("menuitem", { name: /Org Alpha Updated/ }).click();
      await analystPage.waitForURL(/\/home$/, { timeout: 20_000 });
      await expect(analystPage.getByTestId("active-org-name")).toContainText("Org Alpha Updated", { timeout: 20_000 });

      // Lead xoá Analyst khỏi Org Alpha Updated trong lúc Analyst vẫn đang mở Org Alpha Updated
      await leadPage.getByRole("button", { name: "Thao tác với Analyst FLF-422" }).click();
      await leadPage.getByRole("menuitem", { name: "Xoá khỏi tổ chức" }).click();
      const removeDialog = leadPage.getByRole("dialog", { name: "Xoá thành viên?" });
      await removeDialog.getByRole("button", { name: "Xác nhận" }).click();
      await expect(removeDialog).toBeHidden({ timeout: 15_000 });
      await expect(leadPage.getByRole("list").first().getByText("Analyst FLF-422")).toHaveCount(0, {
        timeout: 15_000,
      });

      // Analyst bấm điều hướng gây 403 ORG_FORBIDDEN -> refreshSession({ force: true }) -> /home/organizations
      await analystPage.getByRole("link", { name: "Thành viên" }).click();
      await analystPage.waitForURL(/\/home\/organizations/, { timeout: 25_000 });
      await expect(analystPage.getByRole("heading", { name: "Tổ chức của bạn" })).toBeVisible({ timeout: 15_000 });
      await expect(analystPage.getByText("Org Beta Analyst")).toBeVisible();
      await expect(analystPage.getByText("Org Alpha Updated")).toHaveCount(0);

      await analystPage.getByRole("button", { name: "Mở tổ chức này" }).click();
      await analystPage.waitForURL(/\/home$/, { timeout: 20_000 });
      await expect(analystPage.getByTestId("active-org-name")).toContainText("Org Beta Analyst", { timeout: 20_000 });

      // ── 5. UC-15: Rời tổ chức -> /home/onboarding khi không còn org nào ──────────────
      await analystPage.getByRole("link", { name: "Thành viên" }).click();
      await analystPage.waitForURL(/\/home\/members/, { timeout: 20_000 });
      await analystPage.getByRole("button", { name: "Mời thành viên" }).click();
      const inviteDialog2 = analystPage.getByRole("dialog", { name: "Mời thành viên" });
      await inviteDialog2.getByLabel("Vai trò").selectOption("viewer");
      await inviteDialog2.getByLabel("Email người được mời").fill(STRANGER_EMAIL);
      await inviteDialog2.getByRole("button", { name: "Tạo mã mời" }).click();
      const code2 = (await inviteDialog2.getByTestId("invite-code").innerText()).trim();
      await inviteDialog2.getByRole("button", { name: "Đóng" }).last().click();

      await strangerPage.locator("#invite-code").fill(code2);
      await strangerPage.getByRole("button", { name: "Kiểm tra mã" }).click();
      await expect(strangerPage.getByText("Bạn sẽ tham gia Org Beta Analyst với vai trò Viewer.")).toBeVisible();
      await strangerPage.getByRole("button", { name: "Tham gia tổ chức" }).click();
      await strangerPage.waitForURL(/\/home$/, { timeout: 20_000 });
      await strangerPage.getByRole("link", { name: "Thành viên" }).click();
      await strangerPage.waitForURL(/\/home\/members/, { timeout: 20_000 });

      await strangerPage.getByRole("button", { name: "Thao tác với Stranger FLF-422" }).click();
      await strangerPage.getByRole("menuitem", { name: "Rời tổ chức" }).click();
      const leaveDialog = strangerPage.getByRole("dialog", { name: "Rời tổ chức?" });
      await leaveDialog.getByRole("button", { name: "Xác nhận" }).click();
      await strangerPage.waitForURL(/\/home\/onboarding/, { timeout: 25_000 });
      await expect(strangerPage.getByRole("heading", { name: "Chọn nơi làm việc" })).toBeVisible();

      // ── 6. UC-81: Điều kiện chặn giữ nguyên lời mời; xoá org thu hồi mã mời & về Onboarding ─
      await leadPage.getByRole("button", { name: "Mời thành viên" }).click();
      const inviteDialog3 = leadPage.getByRole("dialog", { name: "Mời thành viên" });
      await inviteDialog3.getByLabel("Vai trò").selectOption("analyst");
      await inviteDialog3.getByLabel("Email người được mời").fill(STRANGER_EMAIL);
      await inviteDialog3.getByRole("button", { name: "Tạo mã mời" }).click();
      const code3 = (await inviteDialog3.getByTestId("invite-code").innerText()).trim();
      await inviteDialog3.getByRole("button", { name: "Đóng" }).last().click();

      const strangerLoginRes = await request.post(`${API}/auth/login`, {
        data: { email: STRANGER_EMAIL, password: PASSWORD },
      });
      expect(strangerLoginRes.ok()).toBeTruthy();
      const strangerToken = ((await strangerLoginRes.json()) as { data: { accessToken: string } }).data.accessToken;

      const leadLoginRes = await request.post(`${API}/auth/login`, {
        data: { email: LEAD_EMAIL, password: PASSWORD },
      });
      expect(leadLoginRes.ok()).toBeTruthy();
      const leadToken = ((await leadLoginRes.json()) as { data: { accessToken: string } }).data.accessToken;

      const leadOrgsRes = await request.get(`${API}/orgs`, {
        headers: { Authorization: `Bearer ${leadToken}` },
      });
      expect(leadOrgsRes.ok()).toBeTruthy();
      const alphaOrg = ((await leadOrgsRes.json()) as { data: { id: string; name: string }[] }).data.find(
        (o) => o.name === "Org Alpha Updated"
      );
      expect(alphaOrg).toBeTruthy();

      const switchRes = await request.post(`${API}/orgs/${alphaOrg!.id}/switch`, {
        headers: { Authorization: `Bearer ${leadToken}` },
      });
      expect(switchRes.ok()).toBeTruthy();
      const scopedLeadToken = ((await switchRes.json()) as { data: { accessToken: string } }).data.accessToken;

      const mismatchDeleteRes = await request.delete(`${API}/orgs/${alphaOrg!.id}`, {
        headers: { Authorization: `Bearer ${scopedLeadToken}` },
        data: { confirmName: "Wrong Name" },
      });
      expect(mismatchDeleteRes.status()).toBe(400);

      const previewBeforeDelete = await request.get(`${API}/invitations/${code3}`, {
        headers: { Authorization: `Bearer ${strangerToken}` },
      });
      expect(previewBeforeDelete.status()).toBe(200);

      await leadPage.getByRole("button", { name: "Xoá tổ chức" }).click();
      const deleteDialog = leadPage.getByRole("dialog", { name: "Xoá vĩnh viễn tổ chức?" });
      const confirmDeleteBtn = deleteDialog.getByRole("button", { name: "Xoá vĩnh viễn" });
      await expect(confirmDeleteBtn).toBeDisabled();
      await deleteDialog.getByLabel(/Gõ lại tên tổ chức/).fill("Org Alpha Updated");
      await expect(confirmDeleteBtn).toBeEnabled();
      await confirmDeleteBtn.click();

      await leadPage.waitForURL(/\/home\/onboarding/, { timeout: 25_000 });
      await expect(leadPage.getByRole("heading", { name: "Chọn nơi làm việc" })).toBeVisible();

      const previewAfterDelete = await request.get(`${API}/invitations/${code3}`, {
        headers: { Authorization: `Bearer ${strangerToken}` },
      });
      expect(previewAfterDelete.status()).toBe(410);
    } finally {
      await leadCtx.close();
      await analystCtx.close();
      await strangerCtx.close();
    }
  });
});
