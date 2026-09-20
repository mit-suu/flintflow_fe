import { expect, test, type Locator, type Page } from "@playwright/test";
import path from "node:path";
import fs from "node:fs";

/**
 * e2e mode 1 **v2** (FLF-188, plan v2 §10) — FE thật trên BE thật, **có gọi AI thật** (I-4, step runner, CR).
 *
 * Luồng v2 khác hẳn v1: file gốc không còn là nguồn sự thật, Spine mới là, và mode 1 dùng CHÍNH workspace
 * của mode 2 cho tới khi ký baseline v1 (D1/D3):
 *
 *   tạo project → import → gap review → **workspace** → chạy một step còn thiếu → sửa qua chat
 *   → ký baseline v1 → chat sau v1 đẻ ra CR → duyệt CR → version 0.x → release 1.0
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
test.use({ channel: "chromium" });

const PROJECT_NAME = `E2E mode1 v2 ${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}`;
const WAIVE_REASON = "E2E: mục này không áp dụng cho tài liệu mẫu, xác nhận bỏ qua để đi tiếp kịch bản";

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
  await chat(page).getByRole("button", { name: "arrow_upward" }).click();
};

/** Ghi log rồi kết thúc sạch: nhánh phụ thuộc nội dung file, không phải lỗi code. */
const finish = (problems: string[], reason?: string) => {
  if (reason) console.log(`[e2e] dừng sớm: ${reason}`);
  fs.writeFileSync(path.join(OUT, "problems.txt"), problems.join("\n"));
  expect(problems, problems.join("\n")).toEqual([]);
};

test("mode 1 v2 đi trọn luồng trên BE thật", async ({ page }) => {
  const problems: string[] = [];
  // 4xx mong đợi (file stamp project khác 422, chat sau v1 409) trình duyệt vẫn log "Failed to load resource"
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

  // ── 5. Workspace: mode 1 v2 dùng CHÍNH workspace của mode 2 (D3) ───────────────────
  await page.goto(`/projects/${projectId}`);
  await expect(page.getByLabel("Tiến độ theo bước"), "thanh step của workspace phải hiện").toBeVisible({ timeout: 60_000 });
  await expect(chat(page), "chat pane có mặt — trước v1 sửa thẳng qua chat").toBeVisible();
  const planPanel = page.getByRole("region", { name: "Cờ đỏ đang chặn" });
  await expect(planPanel, "cột kế hoạch mode 1").toBeVisible({ timeout: 30_000 });
  await snap(page, "workspace");

  // Bản 0.0 giữ được file gốc người dùng upload (FLF-184)
  const original = page.getByRole("button", { name: "Tải file gốc" });
  if (await visible(original)) console.log(`[e2e] file gốc: ${await saveDownload(page, () => original.first().click())}`);

  // ── 6. Chạy một step còn thiếu (D2/D6) ─────────────────────────────────────────────
  // SRS đủ mọi đầu mục FPT thì không có step nào "Thiếu" — chặng này bỏ qua, không phải lỗi.
  const missingBadge = page.getByTestId("step-missing");
  if (await visible(missingBadge)) {
    console.log(`[e2e] ${await missingBadge.textContent()}`);
    const openStep = planPanel.getByRole("button", { name: /^(Chạy|Mở lại) S-/ }).first();
    await expect(openStep, "cờ đỏ phải có nút dẫn tới step xử lý được (L11c)").toBeVisible();
    const stepFromFlag = ((await openStep.textContent()) ?? "").replace(/^(Chạy|Mở lại)\s+/, "").trim();
    await openStep.click();
    await snap(page, "step-selected");

    const runButton = page.getByRole("button", { name: /^▶ Chạy / });
    if (await visible(runButton)) {
      await runButton.click();
      const gateCard = page.getByLabel("Cổng chốt");
      const sendAnswers = page.getByRole("button", { name: "Gửi câu trả lời" });
      for (let round = 0; round < 4; round++) {
        const i = await firstVisible(page, [gateCard, sendAnswers], AI_TIMEOUT);
        if (i === 0) break;
        await snap(page, `step-elicit-${round + 1}`);
        for (const box of await chat(page).getByRole("textbox").all()) {
          if (await box.isVisible().catch(() => false)) await box.fill("Cứ dùng phương án hợp lý nhất theo tài liệu.");
        }
        await sendAnswers.click();
      }
      await expect(gateCard).toBeVisible({ timeout: AI_TIMEOUT });
      await snap(page, "step-gate");

      // L11b: lô op rỗng / mục vẫn trống phải nói ra ở cổng chốt, không im lặng cho Accept
      const warning = gateCard.getByRole("status");
      if (await visible(warning)) console.log(`[e2e] cảnh báo ở gate: ${await warning.first().textContent()}`);

      await gateCard.getByRole("button", { name: /Accept$/ }).click();
      await expect(gateCard).toBeHidden({ timeout: 60_000 });
      await snap(page, "step-accepted");

      // L11: chạy tiếp ngay sau khi accept KHÔNG được ăn 409 lệch version
      const runAgain = page.getByRole("button", { name: /^▶ Chạy / });
      if (await visible(runAgain)) {
        await runAgain.click();
        await expect(page.getByText(/Dữ liệu vừa thay đổi ở phiên khác/), "L11: không còn kẹt SPINE_VERSION_CONFLICT").toBeHidden({ timeout: 15_000 });
      }
      console.log(`[e2e] đã chạy step ${stepFromFlag}`);
    }
  }

  // ── 7. Sửa qua chat khi CHƯA ký v1 — ghi thẳng, không cần CR (D3) ──────────────────
  await page.goto(`/projects/${projectId}`);
  await expect(chat(page)).toBeVisible({ timeout: 60_000 });
  await sendChat(page, "Đổi tầm nhìn sản phẩm thành: nền tảng học trực tuyến cho trung tâm đào tạo nhỏ.");
  await expect(
    page.getByText("Muốn sửa tài liệu? Hãy tạo change request"),
    "trước baseline v1 thì chat sửa thẳng, KHÔNG mời tạo CR"
  ).toBeHidden({ timeout: 60_000 });
  await snap(page, "chat-before-v1");

  // ── 8. Ký baseline v1 — còn cờ đỏ thì khoá; waive để đi tiếp (L11d) ────────────────
  const signButton = page.getByRole("button", { name: "Ký baseline v1" });
  await expect(signButton).toBeVisible({ timeout: 30_000 });
  for (let attempt = 0; attempt < 6 && (await signButton.isDisabled()); attempt++) {
    const waive = planPanel.getByRole("button", { name: "Waive" }).first();
    if (!(await visible(waive))) break;
    await waive.click();
    await planPanel.getByLabel(/Lý do bỏ qua/).fill(WAIVE_REASON);
    await planPanel.getByRole("button", { name: "Xác nhận waive" }).click();
    await page.waitForTimeout(1500);
  }
  await snap(page, "before-sign-off");

  if (await signButton.isDisabled()) {
    // Còn cờ không waive được (dead_reference / render_error) — dừng sạch, ghi lại lý do
    console.log(`[e2e] không ký được v1: ${await planPanel.textContent()}`);
    return finish(problems, "còn cờ đỏ không waive được");
  }

  await signButton.click();
  await expect(page.getByText(/Đã ký baseline v1/), "ký xong thì cột kế hoạch phải nói ra").toBeVisible({ timeout: AI_TIMEOUT });
  await snap(page, "signed-off-v1");

  // ── 9. Sau v1: lệnh sửa trong chat đẻ ra CR (BR-03, FLF-186) ───────────────────────
  await sendChat(page, "Đổi tên actor Learner thành Student ở mọi chỗ trong tài liệu.");
  const crCard = chat(page).getByRole("status").filter({ hasText: /change request|CR-/ });
  await expect(crCard, "sau v1 chat phải chuyển sang đường CR").toBeVisible({ timeout: 60_000 });
  await snap(page, "chat-after-v1");

  const openCr = crCard.getByRole("link", { name: /^Mở CR-/ });
  if (await visible(openCr)) {
    await openCr.click();
  } else {
    await crCard.getByRole("link", { name: "Tạo change request" }).click();
    await page.getByLabel("Người yêu cầu *").fill("PM Lan");
    await page.getByRole("button", { name: "Tạo change request" }).click();
  }
  await page.waitForURL(/\/change-requests\/CR-\d+$/, { timeout: 60_000 });
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
    if (i >= 4) throw new Error(i === 4 ? "CR rơi vào manual_fix" : "CR bị tạm dừng");
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
  await cards.nth(approve).getByRole("button", { name: "Duyệt" }).click();
  await expect(page.getByText(/vào bản 0\.\d/), "duyệt xong ⇒ ghi ngay thành version minor (D4)").toBeVisible({ timeout: AI_TIMEOUT });
  await snap(page, "cr-written");

  // ── 12. Version 0.x tải được, rồi release 1.0 (Flow 6, UC-57) ─────────────────────
  await page.goto(`/projects/${projectId}`);
  await expect(page.getByRole("heading", { name: "Release" })).toBeVisible({ timeout: 60_000 });
  console.log(`[e2e] bản sau CR: ${await saveDownload(page, () => page.getByRole("button", { name: /Tải bản draft|Tải bản render/ }).first().click())}`);
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
