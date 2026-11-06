import { expect, test, type Locator, type Page } from "@playwright/test";
import path from "node:path";
import fs from "node:fs";
import { E2E_API_URL } from "../playwright.config";

/**
 * e2e FLF-278 trên FLF-335/336 — dự án mới có mẫu bắt buộc, FE thật trên BE thật:
 *
 *   tạo dự án "Dự án mới" + mẫu bắt buộc → tải file mẫu → mapping review (phần nhỏ `slot:*`) → trích → kết quả đọc
 *   (chế độ 3, mục trống "Sẽ soạn") → lưu mẫu cho tổ chức → "Viết với FlintFlow" ⇒ workspace luồng tạo mới
 *   (Luồng 2 tại 2.4) → mẫu nằm trong thư viện của tổ chức
 *
 * Chạy tay: `E2E_TEMPLATE_DOCX` là file mẫu .docx (trống hoặc điền dở, có chữ hướng dẫn kiểu `[...]`). BE có thể chạy với
 * `AI_PROVIDER_OVERRIDE=mock` — kịch bản không khẳng định nội dung AI trích, chỉ khẳng định luồng và trạng thái.
 */

const EMAIL = process.env.E2E_EMAIL ?? "fixture@flintflow.io";
const PASSWORD = process.env.E2E_PASSWORD ?? "fixture-password-123";
const DOCX = process.env.E2E_TEMPLATE_DOCX ?? "";
const OUT = process.env.E2E_OUT ?? path.join("test-results", "template-fixed");
const AI_TIMEOUT = 5 * 60_000;

test.skip(!DOCX, "Chỉ chạy tay: đặt E2E_TEMPLATE_DOCX");
test.setTimeout(20 * 60_000);
test.use({ channel: "chromium", actionTimeout: 60_000 });

const STAMP = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
const PROJECT_NAME = `E2E mẫu bắt buộc ${STAMP}`;
const ORG_TEMPLATE_NAME = `Mẫu E2E ${STAMP}`;

let shot = 0;
const snap = async (page: Page, name: string) => {
  fs.mkdirSync(OUT, { recursive: true });
  await page.screenshot({ path: path.join(OUT, `${String(++shot).padStart(2, "0")}-${name}.png`), fullPage: true });
};

/** Chờ một trong các locator hiện ra; trả index. */
const firstVisible = async (page: Page, candidates: Locator[], timeout: number): Promise<number> => {
  const deadline = Date.now() + timeout;
  for (;;) {
    for (let i = 0; i < candidates.length; i++) if (await candidates[i].first().isVisible().catch(() => false)) return i;
    if (Date.now() >= deadline) throw new Error("Hết giờ chờ trạng thái tiếp theo");
    await page.waitForTimeout(1000);
  }
};

test("mẫu bắt buộc: Luồng 1 → Luồng 2 cho phần còn thiếu", async ({ page }) => {
  const problems: string[] = [];
  page.on("console", (m) => m.type() === "error" && !/Failed to load resource: .* 4\d\d/.test(m.text()) && problems.push(`console: ${m.text()}`));
  page.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));
  page.on("response", (r) => {
    if (r.url().includes("/api/v1/") && r.status() >= 500) problems.push(`${r.status()} ${r.request().method()} ${r.url()}`);
  });

  // ── 1. Đăng nhập + tạo "Dự án mới" có mẫu bắt buộc (FLF-335 ⇒ import + fixed) ─────────────
  await page.goto("/login");
  await page.locator("#email").fill(EMAIL);
  await page.locator("#password").fill(PASSWORD);
  await page.getByRole("button", { name: /đăng nhập/i }).click();
  await page.waitForURL(/\/home/, { timeout: 60_000 });

  const newProject = page.getByRole("button", { name: /Dự án mới/ }).first();
  if (await newProject.isVisible().catch(() => false)) await newProject.click();
  // Trang home cũng có bộ chọn "Bạn bắt đầu từ đâu?" — chỉ thao tác trong dialog tạo dự án
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("radio", { name: /^Dự án mới/ }).click();
  await dialog.getByRole("radio", { name: /^Có$/ }).click();
  await dialog.getByLabel("Tên dự án").fill(PROJECT_NAME);
  await snap(page, "create-project");
  await dialog.getByRole("button", { name: "Bắt đầu" }).click();
  await page.waitForURL(/\/projects\/[a-f0-9]{24}\/import$/, { timeout: 60_000 });
  const projectId = page.url().match(/projects\/([a-f0-9]{24})/)![1];
  console.log(`[e2e] project ${projectId}`);
  await expect(page.getByText("Tải lên mẫu bắt buộc (.docx, trống hoặc điền dở)")).toBeVisible({ timeout: 60_000 });

  // ── 2–3. Tải mẫu → (FLF-343) màn "Sẵn sàng đọc tài liệu": xác nhận bản mới nhất + Bắt đầu một lần ⇒ đọc file, so cấu trúc
  // đích (I-5) ⇒ kết quả đọc chế độ 3. Mapping heading tự động; màn xác nhận mapping (nếu còn hiện) thì kiểm phần nhỏ `slot:*`.
  await page.getByTestId("docx-input").setInputFiles(DOCX);
  const mapping = page.getByRole("button", { name: "Xác nhận mapping" });
  const start = page.getByRole("button", { name: "Bắt đầu", exact: true });
  const fields = page.getByRole("button", { name: "Xác nhận tất cả field" });
  const baseline = page.getByRole("button", { name: "Tạo baseline 0.1" });
  const reading = page.getByRole("region", { name: "Kết quả đọc file" });
  const paused = page.getByText(/đang tạm dừng/);
  for (;;) {
    const at = await firstVisible(page, [mapping, start, fields, baseline, reading, paused], AI_TIMEOUT);
    expect(at, "đọc file / tạo bản gốc không được dừng giữa chừng").not.toBe(5);
    if (at === 4) break;
    if (at === 0) {
      const slotGroups = await page.locator('optgroup[label="Một phần nội dung (mẫu chia nhỏ hơn FlintFlow)"]').count();
      expect(slotGroups, "ô chọn section có nhóm phần nhỏ slot:*").toBeGreaterThan(0);
      await snap(page, "mapping-review");
    }
    if (at === 1) {
      const latest = page.getByRole("checkbox", { name: /Đây là bản mới nhất của tài liệu/ });
      if (!(await latest.isChecked())) await latest.check();
      await snap(page, "start");
    }
    const action = [mapping, start, fields, baseline][at];
    await action.click();
    await expect(action.first()).toBeHidden({ timeout: AI_TIMEOUT });
  }
  await expect(reading.getByText(/Mẫu có \d+ mục đã có nội dung và \d+ mục còn trống/)).toBeVisible();
  // Dự án mới theo mẫu bắt buộc: không khoá mẫu còn trống thành bản gốc, không gap report
  await expect(reading.getByRole("button", { name: "Tiếp tục sửa với FlintFlow" })).toHaveCount(0);
  await expect(reading.getByText("Sẽ soạn").first()).toBeVisible();
  console.log(`[e2e] kết quả đọc:\n${await reading.innerText()}`);
  await snap(page, "reading-result");

  // ── 4. Lưu mẫu + mapping cho tổ chức (lát 5) ──────────────────────────────────────────────
  await page.getByLabel("Tên mẫu").fill(ORG_TEMPLATE_NAME);
  await page.getByRole("button", { name: "Lưu làm mẫu của tổ chức" }).click();
  await expect(page.getByText(/Đã lưu\. Dự án mới của tổ chức/)).toBeVisible({ timeout: 30_000 });

  // ── 5. Luồng 2 cho phần thiếu (lát 3) ─────────────────────────────────────────────────────
  await reading.getByRole("button", { name: "Viết với FlintFlow" }).click();
  await page.waitForURL(new RegExp(`/projects/${projectId}$`), { timeout: 60_000 });
  await expect(page.locator("#flintflow-chat-pane"), "workspace luồng tạo mới").toBeVisible({ timeout: 60_000 });
  await snap(page, "workspace-flow2");

  // BE: dự án sang luồng tạo mới (`fpt`; lần import ở `drafting` — kiểm ở `mode1/flow2.int.test.ts`). Route import của mode 1
  // không còn dùng cho dự án này, còn thư viện tổ chức vẫn dùng được trong Luồng 2.
  const project = await page.request.get(`${E2E_API_URL}/projects/${projectId}`);
  expect(project.ok()).toBe(true);
  const body = (await project.json()) as { data: { mode?: string } };
  expect(body.data.mode).toBe("fpt");
  const matches = await page.request.get(`${E2E_API_URL}/projects/${projectId}/library-matches`);
  expect(matches.status(), "thư viện tổ chức dùng được ở Luồng 2").toBe(200);

  // ── 6. Thư viện của tổ chức có mẫu vừa lưu ────────────────────────────────────────────────
  await page.goto("/home/library");
  await expect(page.getByText(ORG_TEMPLATE_NAME)).toBeVisible({ timeout: 60_000 });
  await snap(page, "org-library");

  fs.writeFileSync(path.join(OUT, "problems.txt"), problems.join("\n"));
  expect(problems, problems.join("\n")).toEqual([]);
});
