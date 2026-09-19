import { expect, test, type Page } from "@playwright/test";
import path from "node:path";
import fs from "node:fs";

/**
 * e2e mode 1 (FLF-172, DoD P3) — FE thật trên BE thật, **có gọi AI thật** (I-4, kiểm ngữ nghĩa, C-2/C-4/C-5).
 * Chạy tay, không nằm trong CI mặc định: cần `E2E_MODE1=1`, tài khoản `seed:e2e-user` có credit, và file SRS
 * .docx **không** mang stamp FlintFlow (`E2E_MODE1_DOCX`); `E2E_MODE1_FOREIGN_DOCX` (tuỳ chọn) là file mang stamp
 * của project khác để thử nhánh từ chối. Ảnh chụp từng bước + file tải về ghi vào `E2E_OUT` (mặc định `test-results/mode1`).
 *
 * Luồng §1 plan mode 1: tạo project mode 1 → import → gap report → CR → duyệt một phần → tải `0.1` → release → tải bản sạch.
 */

const EMAIL = process.env.E2E_EMAIL ?? "fixture@flintflow.io";
const PASSWORD = process.env.E2E_PASSWORD ?? "fixture-password-123";
const DOCX = process.env.E2E_MODE1_DOCX ?? "";
const FOREIGN_DOCX = process.env.E2E_MODE1_FOREIGN_DOCX ?? "";
const OUT = process.env.E2E_OUT ?? path.join("test-results", "mode1");
const AI_TIMEOUT = 10 * 60_000;

test.skip(!process.env.E2E_MODE1 || !DOCX, "Chỉ chạy tay: đặt E2E_MODE1=1 và E2E_MODE1_DOCX");
test.setTimeout(45 * 60_000);
// Chromium đầy đủ ở chế độ headless mới — không cần tải thêm `chrome-headless-shell`
test.use({ channel: "chromium" });

const PROJECT_NAME = `E2E mode1 ${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}`;

let shot = 0;
const snap = async (page: Page, name: string) => {
  fs.mkdirSync(OUT, { recursive: true });
  await page.screenshot({ path: path.join(OUT, `${String(++shot).padStart(2, "0")}-${name}.png`), fullPage: true });
};

const saveDownload = async (page: Page, trigger: () => Promise<void>): Promise<string> => {
  const [download] = await Promise.all([page.waitForEvent("download", { timeout: 60_000 }), trigger()]);
  const file = path.join(OUT, download.suggestedFilename());
  await download.saveAs(file);
  return download.suggestedFilename();
};

/** Chờ một trong các locator hiện ra; trả index. */
const firstVisible = async (page: Page, candidates: ReturnType<Page["locator"]>[], timeout: number): Promise<number> => {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    for (let i = 0; i < candidates.length; i++) if (await candidates[i].first().isVisible().catch(() => false)) return i;
    await page.waitForTimeout(1000);
  }
  throw new Error("Hết giờ chờ trạng thái tiếp theo");
};

test("mode 1 đi trọn luồng trên BE thật", async ({ page }) => {
  const problems: string[] = [];
  // 4xx mong đợi (file stamp project khác 422, chat bị chặn 409) trình duyệt vẫn log "Failed to load resource" — bỏ qua, 5xx bắt ở dưới
  page.on("console", (m) => m.type() === "error" && !/Failed to load resource: .* 4\d\d/.test(m.text()) && problems.push(`console: ${m.text()}`));
  page.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));
  page.on("response", (r) => {
    if (r.url().includes("/api/v1/") && r.status() >= 500) problems.push(`${r.status()} ${r.request().method()} ${r.url()}`);
  });

  // ── 1. Đăng nhập + tạo project mode 1 (3.1) ────────────────────────────────────────
  await page.goto("/login");
  await page.locator("#email").fill(EMAIL);
  await page.locator("#password").fill(PASSWORD);
  await page.getByRole("button", { name: /đăng nhập/i }).click();
  await page.waitForURL(/\/home/, { timeout: 30_000 });

  // Tài khoản đã có dự án ⇒ mở dialog "Dự án mới"; chưa có ⇒ form tạo nằm sẵn trên trang
  const newProject = page.getByRole("button", { name: /Dự án mới/ }).first();
  if (await newProject.isVisible()) await newProject.click();
  await page.getByRole("radio", { name: /Upload SRS có sẵn/ }).click();
  await page.getByLabel("Tên dự án").fill(PROJECT_NAME);
  await snap(page, "create-project");
  await page.getByRole("button", { name: "Bắt đầu" }).click();
  await page.waitForURL(/\/projects\/[a-f0-9]{24}\/import$/, { timeout: 30_000 });
  const projectId = page.url().match(/projects\/([a-f0-9]{24})/)![1];
  console.log(`[e2e] project ${projectId}`);

  // ── 2. Preflight: file mang stamp project khác bị từ chối (I-1) ─────────────────────
  if (FOREIGN_DOCX) {
    await page.getByTestId("docx-input").setInputFiles(FOREIGN_DOCX);
    await expect(page.getByRole("alert").filter({ hasText: /dự án khác/ })).toBeVisible({ timeout: 30_000 });
    await snap(page, "foreign-stamp-rejected");
  }

  // ── 3. Upload → xác nhận bản mới nhất → mapping (1.1–1.7) ───────────────────────────
  await page.getByTestId("docx-input").setInputFiles(DOCX);
  await page.getByRole("button", { name: "Đúng, đây là bản mới nhất" }).click({ timeout: 60_000 });
  const mapping = page.getByRole("button", { name: "Xác nhận mapping" });
  const start = page.getByRole("button", { name: "Bắt đầu trích (AI)" });
  if ((await firstVisible(page, [mapping, start], 60_000)) === 0) {
    await snap(page, "mapping-review");
    await page.getByLabel("Chỉ hiện dòng độ tin thấp").uncheck();
    await snap(page, "mapping-all");
    await mapping.click();
  }

  // ── 4. Trích field chạy nền, FE poll (1.8–1.9) ─────────────────────────────────────
  await start.click({ timeout: 60_000 });
  await expect(page.getByRole("progressbar")).toBeVisible({ timeout: 30_000 });
  await snap(page, "extracting");
  const fields = page.getByRole("button", { name: "Xác nhận tất cả field" });
  const baseline = page.getByRole("button", { name: "Tạo baseline 0.0" });
  const paused = page.getByText(/đang tạm dừng/);
  const afterExtract = await firstVisible(page, [fields, baseline, paused], AI_TIMEOUT);
  await snap(page, "after-extract");
  expect(afterExtract, "I-4 không được dừng giữa chừng").not.toBe(2);
  if (afterExtract === 0) await fields.click();

  // ── 5. Baseline 0.0 + check ⇒ gap report (1.10–1.13) ───────────────────────────────
  await baseline.click({ timeout: 60_000 });
  await page.waitForURL(/\/gap-report$/, { timeout: AI_TIMEOUT });
  await expect(page.getByText("Gap report — bản 0.0")).toBeVisible({ timeout: 30_000 });
  await snap(page, "gap-report");
  const gapFile = await saveDownload(page, () => page.getByRole("button", { name: "Tải gap report (.docx)" }).click());
  console.log(`[e2e] gap report: ${gapFile}`);

  // ── 6. Tạo CR từ gap report (3.1) — đổi nội dung thành thay đổi cụ thể ─────────────
  await page.getByRole("link", { name: "Cần sửa → Tạo change request" }).click();
  await page.waitForURL(/\/change-requests\?/);
  await expect(page.getByLabel("Nguồn *")).toHaveValue("gap_report");
  await page.getByLabel("Tiêu đề").fill("Rename actor Student to Learner");
  await page
    .getByLabel("Mô tả thay đổi")
    .fill("Rename the actor 'Student' to 'Learner' everywhere in the document (actors table, use cases, descriptions).");
  await page.getByLabel("Người yêu cầu *").fill("PM Lan");
  await snap(page, "cr-form");
  await page.getByRole("button", { name: "Tạo change request" }).click();
  await page.waitForURL(/\/change-requests\/CR-\d+$/, { timeout: 30_000 });

  // ── 7. CR: làm rõ → vị trí + khoá → đề xuất → kiểm → nộp (3.2–3.11) ─────────────────
  const btn = (name: string) => page.getByRole("button", { name });
  await btn("Bắt đầu làm rõ (AI)").click();
  for (let round = 0; round < 4; round++) {
    const i = await firstVisible(page, [page.getByRole("form", { name: "Trả lời câu hỏi làm rõ" }), btn("Tìm vị trí ảnh hưởng & khoá")], AI_TIMEOUT);
    if (i === 1) break;
    await snap(page, `clarify-${round + 1}`);
    const form = page.getByRole("form", { name: "Trả lời câu hỏi làm rõ" });
    for (const box of await form.getByRole("textbox").all()) await box.fill("Yes — apply to every occurrence in the document.");
    await form.getByRole("button", { name: "Gửi câu trả lời" }).click();
    await page.waitForTimeout(1500);
  }
  await btn("Tìm vị trí ảnh hưởng & khoá").click();
  await expect(page.getByText(/Vị trí ảnh hưởng \(\d+\)/)).toBeVisible({ timeout: 60_000 });
  await snap(page, "impact");

  let readyToSubmit = false;
  for (let step = 0; step < 8; step++) {
    const i = await firstVisible(
      page,
      [btn("AI đề xuất sửa"), btn("AI làm lại vị trí trượt"), btn("Kiểm đề xuất"), btn("Nộp để duyệt"), page.getByText(/AI đã làm lại 2 lần/), paused],
      AI_TIMEOUT
    );
    await snap(page, `cr-step-${step + 1}`);
    if (i === 3) {
      readyToSubmit = true;
      break;
    }
    if (i >= 4) throw new Error(i === 4 ? "CR rơi vào manual_fix" : "CR bị tạm dừng");
    await [btn("AI đề xuất sửa"), btn("AI làm lại vị trí trượt"), btn("Kiểm đề xuất")][i].click();
    await page.waitForTimeout(1500);
  }
  expect(readyToSubmit, "CR phải tới được bước nộp sau ≤ 8 lượt đề xuất/kiểm").toBe(true);
  await btn("Nộp để duyệt").click();

  // ── 8. Duyệt một phần: duyệt một group có vị trí "Sửa", từ chối các group còn lại (3.12–3.14) ─
  await expect(page.getByText(/Nhóm thay đổi \(\d+\)/)).toBeVisible({ timeout: 60_000 });
  await snap(page, "in-review");
  const cards = page.getByRole("article", { name: /^Nhóm / });
  const groups = await cards.count();
  let approve = 0;
  for (let g = 0; g < groups; g++) if (/· Sửa/.test((await cards.nth(g).textContent()) ?? "")) approve = g;
  console.log(`[e2e] groups: ${groups}, duyệt nhóm #${approve + 1}`);
  for (let g = 0; g < groups; g++) {
    if (g === approve) continue;
    const card = cards.nth(g);
    await card.getByRole("button", { name: "Từ chối" }).click();
    await card.getByLabel(/Lý do từ chối/).fill("Out of scope for this revision");
    await card.getByRole("button", { name: "Xác nhận từ chối" }).click();
    await expect(card.getByText("Từ chối", { exact: true })).toBeVisible({ timeout: 60_000 });
  }
  await cards.nth(approve).getByRole("button", { name: "Duyệt" }).click();
  await expect(page.getByText(/vào bản 0\.1/)).toBeVisible({ timeout: AI_TIMEOUT });
  await snap(page, "cr-written");

  // ── 9. Tài liệu 0.1 có Track Changes, tải bản draft (3.8, 3.12) ────────────────────
  await page.getByRole("link", { name: "Xem tài liệu" }).click();
  await page.waitForURL(new RegExp(`/projects/${projectId}$`));
  await expect(page.getByRole("button", { name: "Xem bản 0.1" })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByLabel("Track Changes").first()).toBeVisible({ timeout: 30_000 });
  await snap(page, "document-0.1");
  const draftFile = await saveDownload(page, () => page.getByRole("button", { name: "Tải bản draft (Track Changes)" }).click());
  expect(draftFile).toMatch(/_v0\.1_DRAFT\.docx$/);

  await page.getByRole("button", { name: "So sánh version" }).click();
  await page.getByRole("button", { name: "So sánh", exact: true }).click();
  await expect(page.getByText(/0\.0 → 0\.1:/)).toBeVisible({ timeout: 30_000 });
  await snap(page, "compare");
  await page.getByRole("button", { name: "Tài liệu", exact: true }).click();

  // ── 10. Release (Flow 6): còn cờ đỏ ⇒ bị khoá (BR-04); đỏ = 0 ⇒ ra 1.0 + tải bản sạch ─
  const release = page.getByRole("button", { name: "Release", exact: true });
  await expect(release).toBeVisible();
  if (await release.isDisabled()) {
    await snap(page, "release-blocked");
    console.log(`[e2e] release bị khoá: ${await page.getByText(/Còn \d+ cờ đỏ/).textContent()}`);
  } else {
    await release.click();
    await page.getByRole("button", { name: "Xác nhận release" }).click();
    await expect(page.getByRole("button", { name: "Xem bản 1.0" })).toBeVisible({ timeout: 60_000 });
    await snap(page, "released");
    const clean = await saveDownload(page, () => page.getByRole("button", { name: "Tải bản sạch" }).click());
    expect(clean).not.toContain("DRAFT");
  }

  // ── 11. Chat mode 1 chỉ hỏi đáp: lệnh sửa ⇒ thẻ tạo CR (3.13) ──────────────────────
  await page.locator("#flintflow-chat-pane textarea").fill("Đổi tên actor Learner thành Student");
  await page.locator("#flintflow-chat-pane").getByRole("button", { name: "arrow_upward" }).click();
  await expect(page.getByText("Muốn sửa tài liệu? Hãy tạo change request")).toBeVisible({ timeout: 60_000 });
  await snap(page, "chat-requires-cr");

  // ── 12. Danh sách dự án: thẻ mode 1 (3.14) ─────────────────────────────────────────
  await page.goto("/home");
  // Chỉ tìm trong vùng nội dung: sidebar "Gần đây" cũng có link mang tên dự án
  const card = page.getByRole("main").getByRole("link").filter({ hasText: PROJECT_NAME }).first();
  await expect(card).toContainText("SRS có sẵn", { timeout: 30_000 });
  await snap(page, "home-card");

  fs.writeFileSync(path.join(OUT, "problems.txt"), problems.join("\n"));
  expect(problems, problems.join("\n")).toEqual([]);
});
