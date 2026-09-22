import { expect, test, type Locator, type Page } from "@playwright/test";
import path from "node:path";
import fs from "node:fs";

/**
 * e2e mode 1 **v3** (bám BPMN 2026-09-22, plan `mode1-v3/`) — FE thật trên BE thật, **có gọi AI thật** (I-4, CR).
 *
 * Flow 1 kết thúc ở gap report hoặc đi sang 3.1: import xong là mọi sửa qua change request — không chạy step, không
 * ký baseline v1, không waive:
 *
 *   tạo project → import → gap report → workspace (không step) → chat lệnh sửa ⇒ thẻ mời tạo CR
 *   → panel "Sửa tài liệu có xem trước" ⇒ diff ⇒ Tạo CR (form 3.1 + preview_id) → CR 3.2…3.14 (duyệt có lý do)
 *   → version 0.x (bản nháp + bản có đánh dấu) → release 1.0 (Flow 6)
 *
 * Chạy tay, không nằm trong CI mặc định: cần `E2E_MODE1=1`, tài khoản `seed:e2e-user` có credit, và file SRS
 * .docx **không** mang stamp FlintFlow (`E2E_MODE1_DOCX`); `E2E_MODE1_FOREIGN_DOCX` (tuỳ chọn) là file mang
 * stamp của project khác để thử nhánh từ chối. Ảnh chụp từng bước + file tải về ghi vào `E2E_OUT`.
 *
 * Kịch bản **không** khẳng định cứng những chỗ phụ thuộc nội dung file người dùng đưa vào — có step nào
 * đang "Thiếu" không, CR có tìm ra vị trí không, còn cờ đỏ nào không waive được không. Những nhánh đó ghi
 * log rồi dừng sạch, vì trượt ở đấy nói về file mẫu chứ không nói về code.
 */

const EMAIL = process.env.E2E_EMAIL ?? "fixture@flintflow.io";
const PASSWORD = process.env.E2E_PASSWORD ?? "fixture-password-123";
const DOCX = process.env.E2E_MODE1_DOCX ?? "";
const FOREIGN_DOCX = process.env.E2E_MODE1_FOREIGN_DOCX ?? "";
const OUT = process.env.E2E_OUT ?? path.join("test-results", "mode1");
const AI_TIMEOUT = 10 * 60_000;

test.skip(!process.env.E2E_MODE1 || !DOCX, "Chỉ chạy tay: đặt E2E_MODE1=1 và E2E_MODE1_DOCX");
test.setTimeout(60 * 60_000);
// Chromium đầy đủ ở chế độ headless mới — không cần tải thêm `chrome-headless-shell`
// actionTimeout: một selector lệch (vd nút đổi tên sau thiết kế lại) phải gãy sau 1 phút, không treo tới hạn 60 phút của test
test.use({ channel: "chromium", actionTimeout: 60_000 });

const PROJECT_NAME = `E2E mode1 v3 ${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}`;
const CHANGE_INSTRUCTION = process.env.E2E_MODE1_INSTRUCTION ?? "Đổi tầm nhìn sản phẩm thành: nền tảng học trực tuyến cho trung tâm đào tạo nhỏ.";

let shot = 0;
const snap = async (page: Page, name: string) => {
  fs.mkdirSync(OUT, { recursive: true });
  await page.screenshot({ path: path.join(OUT, `${String(++shot).padStart(2, "0")}-${name}.png`), fullPage: true });
};

const saveDownload = async (page: Page, trigger: () => Promise<void>): Promise<string> => {
  const [download] = await Promise.all([page.waitForEvent("download", { timeout: 60_000 }), trigger()]);
  await download.saveAs(path.join(OUT, download.suggestedFilename()));
  return download.suggestedFilename();
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

const visible = (locator: Locator) => locator.first().isVisible().catch(() => false);

const chat = (page: Page) => page.locator("#flintflow-chat-pane");

const sendChat = async (page: Page, text: string) => {
  await chat(page).locator("textarea").fill(text);
  await chat(page).getByRole("button", { name: "Gửi tin nhắn" }).click();
};

/** Ghi log rồi kết thúc sạch: nhánh phụ thuộc nội dung file, không phải lỗi code. */
const finish = (problems: string[], reason?: string) => {
  if (reason) console.log(`[e2e] dừng sớm: ${reason}`);
  fs.writeFileSync(path.join(OUT, "problems.txt"), problems.join("\n"));
  expect(problems, problems.join("\n")).toEqual([]);
};

test("mode 1 v3 đi trọn luồng trên BE thật", async ({ page }) => {
  const problems: string[] = [];
  // 4xx mong đợi (file stamp project khác 422, chat lệnh sửa 409) trình duyệt vẫn log "Failed to load resource"
  page.on("console", (m) => m.type() === "error" && !/Failed to load resource: .* 4\d\d/.test(m.text()) && problems.push(`console: ${m.text()}`));
  page.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));
  page.on("response", (r) => {
    if (r.url().includes("/api/v1/") && r.status() >= 500) problems.push(`${r.status()} ${r.request().method()} ${r.url()}`);
  });

  // ── 1. Đăng nhập + tạo project mode 1 ──────────────────────────────────────────────
  await page.goto("/login");
  await page.locator("#email").fill(EMAIL);
  await page.locator("#password").fill(PASSWORD);
  await page.getByRole("button", { name: /đăng nhập/i }).click();
  await page.waitForURL(/\/home/, { timeout: 30_000 });

  const newProject = page.getByRole("button", { name: /Dự án mới/ }).first();
  if (await visible(newProject)) await newProject.click();
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

  // ── 3. Upload → xác nhận bản mới nhất → mapping → trích field (1.1–1.9) ─────────────
  await page.getByTestId("docx-input").setInputFiles(DOCX);
  await page.getByRole("button", { name: "Đúng, đây là bản mới nhất" }).click({ timeout: 60_000 });
  const mapping = page.getByRole("button", { name: "Xác nhận mapping" });
  const startExtract = page.getByRole("button", { name: "Bắt đầu trích (AI)" });
  if ((await firstVisible(page, [mapping, startExtract], 60_000)) === 0) {
    await snap(page, "mapping-review");
    await mapping.click();
  }

  await startExtract.click({ timeout: 60_000 });
  await expect(page.getByRole("progressbar")).toBeVisible({ timeout: 30_000 });
  await snap(page, "extracting");
  const fields = page.getByRole("button", { name: "Xác nhận tất cả field" });
  const baseline = page.getByRole("button", { name: "Tạo baseline 0.0" });
  const pausedBanner = page.getByText(/đang tạm dừng/);
  const afterExtract = await firstVisible(page, [fields, baseline, pausedBanner], AI_TIMEOUT);
  await snap(page, "after-extract");
  expect(afterExtract, "I-4 không được dừng giữa chừng").not.toBe(2);
  if (afterExtract === 0) await fields.click();

  // ── 4. Baseline 0.0 ⇒ gap report (1.10–1.13) ───────────────────────────────────────
  await baseline.click({ timeout: 60_000 });
  await page.waitForURL(/\/gap-report$/, { timeout: AI_TIMEOUT });
  await expect(page.getByText(/Gap report — bản 0\.0/)).toBeVisible({ timeout: 30_000 });
  await snap(page, "gap-report");
  console.log(`[e2e] gap report: ${await saveDownload(page, () => page.getByRole("button", { name: "Tải gap report (.docx)" }).click())}`);

  // ── 5. Workspace mode 1 v3 (bám BPMN): KHÔNG chạy step, KHÔNG ký v1, KHÔNG waive ───────
  await page.goto(`/projects/${projectId}`);
  await expect(chat(page), "chat pane có mặt").toBeVisible({ timeout: 60_000 });
  const flagsPanel = page.getByRole("region", { name: "Cờ đỏ đang chặn release" });
  await expect(flagsPanel, "cột cờ mode 1").toBeVisible({ timeout: 30_000 });
  expect(await visible(page.getByRole("button", { name: /^Chạy bước / })), "mode 1 v3 không có nút chạy bước").toBe(false);
  expect(await visible(page.getByRole("button", { name: "Hiện tiến độ" })), "mode 1 v3 không có rail tiến độ").toBe(false);
  expect(await visible(page.getByRole("button", { name: "Ký baseline v1" })), "mode 1 v3 không ký baseline v1").toBe(false);
  expect(await visible(flagsPanel.getByRole("button", { name: "Waive" })), "mode 1 v3 không waive").toBe(false);
  await snap(page, "workspace");

  // Bản 0.0 giữ được file gốc người dùng upload (FLF-184)
  const original = page.getByRole("button", { name: "Tải file gốc" });
  if (await visible(original)) console.log(`[e2e] file gốc: ${await saveDownload(page, () => original.first().click())}`);

  // ── 6. Chat ra lệnh sửa ⇒ thẻ mời tạo CR (form 3.1), BE KHÔNG tự tạo CR ─────────────
  await sendChat(page, CHANGE_INSTRUCTION);
  const crCard = chat(page).getByRole("status").filter({ hasText: "Muốn sửa tài liệu? Hãy tạo change request" });
  await expect(crCard, "import xong ⇒ lệnh sửa trong chat mời tạo CR").toBeVisible({ timeout: 60_000 });
  await snap(page, "chat-requires-cr");
  await crCard.getByRole("button", { name: "Bỏ qua" }).click();

  // ── 7. Panel "Sửa tài liệu có xem trước" ⇒ xem diff ⇒ Tạo CR (form 3.1 + preview_id) ─
  await page.getByRole("button", { name: /Sửa tài liệu có xem trước/ }).click();
  const panel = page.getByRole("complementary", { name: "Change panel" });
  await expect(panel.getByText(/mọi thay đổi đi qua change request/)).toBeVisible({ timeout: 30_000 });
  expect(await visible(panel.getByRole("button", { name: "Undo op cuối" })), "mode 1 không Undo thẳng").toBe(false);
  await panel.locator("#change-instruction").fill(CHANGE_INSTRUCTION);
  await panel.getByRole("button", { name: "Xem trước thay đổi" }).click();
  const createCrButton = page.getByRole("button", { name: /^Tạo CR/ });
  const clarification = panel.getByText("Cần làm rõ");
  const previewKind = await firstVisible(page, [createCrButton, clarification, panel.locator(".text-error")], AI_TIMEOUT);
  await snap(page, "preview");
  if (previewKind !== 0) {
    problems.push(`xem trước không ra diff (kiểu ${previewKind}): ${await panel.textContent()}`);
    return finish(problems, "bản xem trước không ra diff");
  }
  // Bản xem trước lỗi (AI dựng op sai) vẫn tạo được CR — chỉ không kèm bản xem trước (nhánh thật, ghi log)
  const withPreview = (await createCrButton.first().textContent())?.trim() === "Tạo CR";
  if (!withPreview) console.log("[e2e] bản xem trước lỗi — tạo CR không kèm bản xem trước");
  await createCrButton.first().click();
  await page.waitForURL(/\/change-requests\?new=1/, { timeout: 30_000 });
  if (withPreview) await expect(page.getByLabel("Bản xem trước đính kèm"), "form 3.1 phải báo đính kèm bản xem trước").toBeVisible({ timeout: 30_000 });
  await page.getByLabel("Người yêu cầu *").fill("PM Lan");
  await snap(page, "cr-form");
  await page.getByRole("button", { name: "Tạo change request" }).click();
  await page.waitForURL(/\/change-requests\/CR-\d+$/, { timeout: 60_000 });
  if (withPreview) await expect(page.getByLabel("Bản xem trước đính kèm"), "CR phải mang seed từ bản xem trước").toBeVisible({ timeout: 30_000 });
  console.log(`[e2e] change request ${page.url().match(/(CR-\d+)$/)![1]}`);

  // ── 10. CR: làm rõ → vị trí + khoá → đề xuất → kiểm → nộp (3.2–3.11) ───────────────
  const btn = (name: string | RegExp) => page.getByRole("button", { name });
  const clarify = btn("Bắt đầu làm rõ (AI)");
  if (await visible(clarify)) await clarify.click();
  for (let round = 0; round < 4; round++) {
    const form = page.getByRole("form", { name: "Trả lời câu hỏi làm rõ" });
    if ((await firstVisible(page, [form, btn("Tìm vị trí ảnh hưởng & khoá")], AI_TIMEOUT)) === 1) break;
    await snap(page, `cr-clarify-${round + 1}`);
    for (const box of await form.getByRole("textbox").all()) await box.fill("Có — áp dụng cho mọi chỗ trong tài liệu.");
    await form.getByRole("button", { name: "Gửi câu trả lời" }).click();
    await page.waitForTimeout(1500);
  }

  await btn("Tìm vị trí ảnh hưởng & khoá").click();
  // L3: mục trống không có phần tử để sửa ⇒ BE trả CR_NO_LOCATIONS kèm step cần chạy, không đứng im
  const noLocations = page.getByRole("alert").filter({ hasText: /Không có phần tử nào để sửa|Không tìm được phần tử nào/ });
  if ((await firstVisible(page, [page.getByText(/Vị trí ảnh hưởng \(\d+\)/), noLocations], 90_000)) === 1) {
    await snap(page, "cr-no-locations");
    console.log(`[e2e] CR không có vị trí: ${await noLocations.first().textContent()}`);
    return finish(problems, "CR không tìm được vị trí nào");
  }
  await snap(page, "cr-impact");

  let readyToSubmit = false;
  for (let step = 0; step < 8; step++) {
    const i = await firstVisible(
      page,
      [
        btn("AI đề xuất sửa"),
        btn("AI làm lại vị trí trượt"),
        btn("Kiểm đề xuất"),
        btn("Nộp để duyệt"),
        page.getByText(/AI đã làm lại 2 lần/),
        pausedBanner,
      ],
      AI_TIMEOUT
    );
    await snap(page, `cr-step-${step + 1}`);
    if (i === 3) {
      readyToSubmit = true;
      break;
    }
    if (i === 5) throw new Error("CR bị tạm dừng");
    if (i === 4) {
      // 3.9 (mode 1 v3): sửa trong step sở hữu cho từng vị trí trượt, rồi kiểm lại
      const drafts = page.getByRole("button", { name: /^Sửa trong step / });
      const n = await drafts.count();
      if (!n) throw new Error("CR rơi vào manual_fix mà không có vị trí nào sửa trong step được");
      for (let k = 0; k < n; k++) {
        await drafts.first().click();
        await page.getByLabel(/AI viết lại theo quy tắc của step/).fill("Viết lại đúng theo yêu cầu của change request, giữ nguyên phần không liên quan.");
        await btn("Viết lại đề xuất (AI)").click();
        await expect(btn("Viết lại đề xuất (AI)")).toBeHidden({ timeout: AI_TIMEOUT });
      }
      await btn("Kiểm lại").click();
      await page.waitForTimeout(1500);
      continue;
    }
    await [btn("AI đề xuất sửa"), btn("AI làm lại vị trí trượt"), btn("Kiểm đề xuất")][i].click();
    await page.waitForTimeout(1500);
  }
  expect(readyToSubmit, "CR phải tới được bước nộp sau ≤ 8 lượt đề xuất/kiểm").toBe(true);
  await btn("Nộp để duyệt").click();

  // ── 11. Duyệt: mọi vị trí "không liên quan" ⇒ BE chặn nộp, FE phải có lối ra (L6) ──
  const nothingToApprove = page.getByRole("alert").filter({ hasText: /không có gì để duyệt/ });
  if ((await firstVisible(page, [page.getByText(/Nhóm thay đổi \(\d+\)/), nothingToApprove], 90_000)) === 1) {
    await snap(page, "cr-nothing-to-approve");
    await expect(btn("Đóng CR").or(btn("Sửa lại CR")), "L6: CR không được kẹt ở màn duyệt trống").toBeVisible();
    return finish(problems, "CR không có nhóm nào để duyệt");
  }
  await snap(page, "cr-in-review");

  const cards = page.getByRole("article", { name: /^Nhóm / });
  const total = await cards.count();
  let approve = 0;
  for (let g = 0; g < total; g++) if (/· Sửa/.test((await cards.nth(g).textContent()) ?? "")) approve = g;
  console.log(`[e2e] ${total} nhóm, duyệt nhóm #${approve + 1}`);
  for (let g = 0; g < total; g++) {
    if (g === approve) continue;
    const card = cards.nth(g);
    await card.getByRole("button", { name: "Từ chối" }).click();
    await card.getByLabel(/Lý do từ chối/).fill("Ngoài phạm vi lần sửa này");
    await card.getByRole("button", { name: "Xác nhận từ chối" }).click();
    await expect(card.getByText("Từ chối", { exact: true })).toBeVisible({ timeout: 60_000 });
  }
  // BPMN 3.12 (mode 1 v3): duyệt cũng kèm lý do
  await cards.nth(approve).getByRole("button", { name: "Duyệt" }).click();
  await cards.nth(approve).getByLabel(/Lý do duyệt/).fill("Đúng yêu cầu của PM Lan");
  await cards.nth(approve).getByRole("button", { name: "Xác nhận duyệt" }).click();
  await expect(page.getByText(/vào bản 0\.\d/), "duyệt xong ⇒ ghi ngay thành version minor (D4)").toBeVisible({ timeout: AI_TIMEOUT });
  await snap(page, "cr-written");

  // ── 12. Version 0.x tải được, rồi release 1.0 (Flow 6, UC-57) ─────────────────────
  await page.goto(`/projects/${projectId}`);
  await expect(page.getByRole("heading", { name: "Release" })).toBeVisible({ timeout: 60_000 });
  console.log(`[e2e] bản nháp sau CR: ${await saveDownload(page, () => page.getByRole("button", { name: "Tải bản nháp (DRAFT)" }).first().click())}`);
  // BPMN 3.14 (mode 1 v3): bản có đánh dấu — Track Changes tác giả là mã CR
  const tracked = page.getByRole("button", { name: "Tải bản có đánh dấu" });
  if (await visible(tracked)) console.log(`[e2e] bản có đánh dấu: ${await saveDownload(page, () => tracked.first().click())}`);
  else problems.push("version sau CR không có bản có đánh dấu (tracked_file_ref null — xem log BE [C-7])");
  await snap(page, "versions");

  const release = page.getByRole("button", { name: "Release", exact: true });
  if (await release.isDisabled()) {
    await snap(page, "release-blocked");
    console.log("[e2e] release bị khoá (còn cờ đỏ) — đúng BR-04");
  } else {
    await release.click();
    await page.getByRole("button", { name: "Xác nhận release" }).click();
    await expect(page.getByText(/1\.0/).first()).toBeVisible({ timeout: 60_000 });
    await snap(page, "released");
    const clean = await saveDownload(page, () => page.getByRole("button", { name: "Tải bản sạch" }).first().click());
    expect(clean).not.toContain("DRAFT");
    console.log(`[e2e] bản release: ${clean}`);
  }

  // ── 13. Danh sách dự án: thẻ mode 1 ───────────────────────────────────────────────
  await page.goto("/home");
  const card = page.getByRole("main").getByRole("link").filter({ hasText: PROJECT_NAME }).first();
  await expect(card).toContainText("SRS có sẵn", { timeout: 30_000 });
  await snap(page, "home-card");

  finish(problems);
});
