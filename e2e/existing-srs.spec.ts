import { expect, test, type APIRequestContext, type Locator, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { inflateRawSync } from "node:zlib";
import { E2E_API_URL } from "../playwright.config";

/**
 * e2e dự án "Upload SRS có sẵn" (FLF-278 trên FLF-366) — FE thật trên BE thật:
 *  1. cấu trúc FlintFlow đủ mục (chế độ 1) ⇒ đọc một mạch tới workspace; bản 0.1 và Export Word bản nháp có **chữ y hệt
 *     file upload** (không bìa / mục lục FlintFlow, bảng lịch sử không thêm dòng "Import SRS …");
 *  2. mẫu cố định của công ty **đã điền** (có field chú thích hình + bookmark) ⇒ không kẹt "tạm dừng" (lỗi cũ 422), bản 0.1
 *     chữ y hệt file;
 *  3. mẫu cố định còn mục trống ⇒ màn "Kết quả đọc file" giữ bản đồ Có / Còn trống và chỉ một nút **Tiếp tục sửa với
 *     FlintFlow** (người dùng upload để sửa tiếp) ⇒ bản gốc 0.1 + workspace; gap report tải ở workspace.
 *
 * Chạy tay: `E2E_EXISTING_FPT_DOCX`, `E2E_EXISTING_COMPANY_DOCX`, `E2E_EXISTING_GAP_DOCX` — thiếu biến nào thì bỏ ca đó.
 * Ảnh + file tải về ghi vào `E2E_OUT`.
 */

const EMAIL = process.env.E2E_EMAIL ?? "fixture@flintflow.io";
const PASSWORD = process.env.E2E_PASSWORD ?? "fixture-password-123";
const FPT_DOCX = process.env.E2E_EXISTING_FPT_DOCX ?? "";
const COMPANY_DOCX = process.env.E2E_EXISTING_COMPANY_DOCX ?? "";
const GAP_DOCX = process.env.E2E_EXISTING_GAP_DOCX ?? "";
const OUT = process.env.E2E_OUT ?? path.join("test-results", "existing-srs");
const AI_TIMEOUT = 10 * 60_000;
const STAMP = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");

test.setTimeout(30 * 60_000);
test.use({ channel: "chromium", actionTimeout: 60_000 });

/** Đọc một part trong .docx (zip) bằng zlib có sẵn — không thêm dependency. */
const zipPart = (buffer: Buffer, name: string): string | null => {
  let eocd = buffer.length - 22;
  while (eocd >= 0 && buffer.readUInt32LE(eocd) !== 0x06054b50) eocd--;
  if (eocd < 0) throw new Error("không phải file zip");
  const count = buffer.readUInt16LE(eocd + 10);
  let at = buffer.readUInt32LE(eocd + 16);
  for (let i = 0; i < count; i++) {
    const method = buffer.readUInt16LE(at + 10);
    const size = buffer.readUInt32LE(at + 20);
    const nameLength = buffer.readUInt16LE(at + 28);
    const extra = buffer.readUInt16LE(at + 30);
    const comment = buffer.readUInt16LE(at + 32);
    const local = buffer.readUInt32LE(at + 42);
    const entry = buffer.toString("utf8", at + 46, at + 46 + nameLength);
    if (entry === name) {
      const start = local + 30 + buffer.readUInt16LE(local + 26) + buffer.readUInt16LE(local + 28);
      const data = buffer.subarray(start, start + size);
      return (method === 0 ? data : inflateRawSync(data)).toString("utf8");
    }
    at += 46 + nameLength + extra + comment;
  }
  return null;
};

const decode = (s: string) => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");

/** Chữ từng đoạn (kể cả ô bảng) của thân tài liệu, theo thứ tự. */
const textsOf = (buffer: Buffer): string[] =>
  [...(zipPart(buffer, "word/document.xml") ?? "").matchAll(/<w:p[ >][\s\S]*?<\/w:p>/g)]
    .map((m) => decode([...m[0].matchAll(/<w:t(?: [^>]*)?>([^<]*)<\/w:t>/g)].map((t) => t[1]).join("")))
    .filter((t) => t.trim());

const headerXml = (buffer: Buffer): string =>
  [1, 2, 3, 4].map((n) => zipPart(buffer, `word/header${n}.xml`) ?? "").join("");

let shot = 0;
const snap = async (page: Page, name: string) => {
  fs.mkdirSync(OUT, { recursive: true });
  await page.screenshot({ path: path.join(OUT, `${String(++shot).padStart(2, "0")}-${name}.png`), fullPage: true });
};

const firstVisible = async (page: Page, candidates: Locator[], timeout: number): Promise<number> => {
  const deadline = Date.now() + timeout;
  for (;;) {
    for (let i = 0; i < candidates.length; i++) if (await candidates[i].first().isVisible().catch(() => false)) return i;
    if (Date.now() >= deadline) throw new Error("Hết giờ chờ trạng thái tiếp theo");
    await page.waitForTimeout(1000);
  }
};

const token = async (request: APIRequestContext): Promise<string> => {
  const res = await request.post(`${E2E_API_URL}/auth/login`, { data: { email: EMAIL, password: PASSWORD } });
  expect(res.ok(), await res.text()).toBe(true);
  return ((await res.json()) as { data: { accessToken: string } }).data.accessToken;
};

const login = async (page: Page) => {
  await page.goto("/login");
  await page.locator("#email").fill(EMAIL);
  await page.locator("#password").fill(PASSWORD);
  await page.getByRole("button", { name: /đăng nhập/i }).click();
  await page.waitForURL(/\/home/, { timeout: 60_000 });
};

/** Tạo "Dự án có sẵn" qua API, mở trang import, chọn ý định, tải file, Bắt đầu. Trả project id. */
const importExisting = async (page: Page, request: APIRequestContext, file: string, intent: "free" | "fixed", label: string) => {
  const auth = { Authorization: `Bearer ${await token(request)}` };
  const created = await request.post(`${E2E_API_URL}/projects`, { headers: auth, data: { name: `E2E có sẵn ${label} ${STAMP}`, source: "existing" } });
  expect(created.ok(), await created.text()).toBe(true);
  const projectId = ((await created.json()) as { data: { _id: string } }).data._id;
  console.log(`[e2e] ${label}: project ${projectId}`);
  await page.goto(`/projects/${projectId}/import`);
  await expect(page.getByText("File này theo cấu trúc nào?").first()).toBeVisible({ timeout: 60_000 });
  await page.getByRole("radio", { name: intent === "fixed" ? /Theo một mẫu cố định/ : /Cấu trúc tự do/ }).check();
  await page.getByTestId("docx-input").setInputFiles(file);
  const start = page.getByRole("button", { name: "Bắt đầu", exact: true });
  await expect(start).toBeVisible({ timeout: AI_TIMEOUT });
  await snap(page, `${label}-start`);
  await start.click();
  return { projectId, auth };
};

/** Chờ tới workspace (đọc một mạch xong) hoặc màn kết quả đọc; tạm dừng = lỗi. */
const waitImported = async (page: Page, projectId: string): Promise<"workspace" | "reading"> => {
  const reading = page.getByRole("region", { name: "Kết quả đọc file" });
  const paused = page.getByText(/đang tạm dừng|tạm dừng/i);
  const workspace = page.locator("#flintflow-chat-pane");
  const at = await firstVisible(page, [workspace, reading, paused], AI_TIMEOUT);
  expect(at, "đọc file / tạo bản gốc không được dừng giữa chừng (lỗi cũ: 422 TEMPLATE_LAYOUT_UNAVAILABLE)").not.toBe(2);
  if (at === 0) await expect(page).toHaveURL(new RegExp(`/projects/${projectId}$`));
  return at === 0 ? "workspace" : "reading";
};

const download = async (request: APIRequestContext, auth: Record<string, string>, url: string, name: string): Promise<Buffer> => {
  const res = await request.get(url, { headers: auth });
  expect(res.status(), (await res.text()).slice(0, 300)).toBe(200);
  const body = await res.body();
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, name), body);
  return body;
};

/** Bản tải về có chữ y hệt file upload (từng đoạn / ô bảng), có watermark DRAFT, không dòng lịch sử của lần import. */
const expectSameAsUpload = (upload: Buffer, downloaded: Buffer, what: string) => {
  const expected = textsOf(upload);
  const actual = textsOf(downloaded);
  const missing = expected.filter((t) => !actual.includes(t));
  const extra = actual.filter((t) => !expected.includes(t));
  console.log(`[e2e] ${what}: ${actual.length}/${expected.length} đoạn; thiếu ${missing.length}, thừa ${extra.length}`);
  if (missing.length || extra.length) console.log(`[e2e] ${what} — thiếu: ${JSON.stringify(missing.slice(0, 5))} · thừa: ${JSON.stringify(extra.slice(0, 5))}`);
  expect(actual, `${what}: chữ y hệt file upload`).toEqual(expected);
  expect(actual.join("\n")).not.toContain("Import SRS");
  expect(actual.join("\n")).not.toMatch(/Baseline 0\.1 signed|Ký baseline 0\.1/);
  expect(headerXml(downloaded), `${what}: watermark DRAFT`).toContain('string="DRAFT"');
};

test.describe("Upload SRS có sẵn — tải về giống file upload", () => {
  test("cấu trúc FlintFlow đủ mục: bản 0.1 và Export Word bản nháp chữ y hệt file upload", async ({ page, request }) => {
    test.skip(!FPT_DOCX, "đặt E2E_EXISTING_FPT_DOCX");
    await login(page);
    const { projectId, auth } = await importExisting(page, request, FPT_DOCX, "free", "fpt");
    expect(await waitImported(page, projectId)).toBe("workspace");
    await snap(page, "fpt-workspace");
    const upload = fs.readFileSync(FPT_DOCX);
    expectSameAsUpload(upload, await download(request, auth, `${E2E_API_URL}/projects/${projectId}/versions/0.1/download`, "fpt-v0.1.docx"), "fpt bản 0.1");
    expectSameAsUpload(upload, await download(request, auth, `${E2E_API_URL}/projects/${projectId}/export/word?source=draft`, "fpt-draft.docx"), "fpt Export Word bản nháp");
  });

  test("SRS đủ mục + chọn 'Theo một mẫu cố định': không dừng ở kết quả đọc (heading tính năng chỉ chứa chức năng con không phải mục trống)", async ({ page, request }) => {
    test.skip(!FPT_DOCX, "đặt E2E_EXISTING_FPT_DOCX");
    await login(page);
    const { projectId, auth } = await importExisting(page, request, FPT_DOCX, "fixed", "fpt-fixed");
    expect(await waitImported(page, projectId), "lỗi cũ: 3.2 / 3.3 / 3.4 / 3.5 bị báo 'Còn trống' ⇒ dừng ở kết quả đọc").toBe("workspace");
    await snap(page, "fpt-fixed-workspace");
    expectSameAsUpload(fs.readFileSync(FPT_DOCX), await download(request, auth, `${E2E_API_URL}/projects/${projectId}/versions/0.1/download`, "fpt-fixed-v0.1.docx"), "fpt + mẫu cố định bản 0.1");
  });

  test("mẫu công ty đã điền (field + bookmark): không kẹt tạm dừng, bản 0.1 chữ y hệt file; nhãn Mục của mẫu", async ({ page, request }) => {
    test.skip(!COMPANY_DOCX, "đặt E2E_EXISTING_COMPANY_DOCX");
    await login(page);
    const { projectId, auth } = await importExisting(page, request, COMPANY_DOCX, "fixed", "company");
    const landed = await waitImported(page, projectId);
    if (landed === "reading") {
      await snap(page, "company-reading");
      await page.getByRole("button", { name: "Tiếp tục sửa với FlintFlow" }).click();
      await page.waitForURL(new RegExp(`/projects/${projectId}$`), { timeout: AI_TIMEOUT });
    }
    await expect(page.locator("#flintflow-chat-pane")).toBeVisible({ timeout: 60_000 });
    await expect(page.getByText("Mục riêng", { exact: true })).toHaveCount(0);
    await snap(page, "company-workspace");
    const upload = fs.readFileSync(COMPANY_DOCX);
    expectSameAsUpload(upload, await download(request, auth, `${E2E_API_URL}/projects/${projectId}/versions/0.1/download`, "company-v0.1.docx"), "mẫu công ty bản 0.1");
  });

  test("mẫu cố định còn mục trống: chip Còn trống, một nút Tiếp tục sửa với FlintFlow ⇒ workspace; gap report tải ở workspace", async ({ page, request }) => {
    test.skip(!GAP_DOCX, "đặt E2E_EXISTING_GAP_DOCX");
    await login(page);
    const { projectId, auth } = await importExisting(page, request, GAP_DOCX, "fixed", "gap");
    expect(await waitImported(page, projectId)).toBe("reading");
    const reading = page.getByRole("region", { name: "Kết quả đọc file" });
    await expect(reading.getByRole("heading", { name: "Kết quả đọc file" })).toBeVisible();
    await expect(reading.getByText(/File theo mẫu của bạn: \d+ mục đã có nội dung, \d+ mục còn trống/)).toBeVisible();
    expect(await reading.getByRole("button").allTextContents()).toEqual(["Tiếp tục sửa với FlintFlow"]);
    await expect(reading.getByText("Còn trống").first()).toBeVisible();
    await expect(reading.getByText("Sẽ soạn")).toHaveCount(0);
    await expect(reading.getByText(/^bước S-/)).toHaveCount(0);
    await expect(reading.getByText(/giữ nguyên file của bạn làm bản gốc 0\.1 rồi mở chỗ sửa/)).toBeVisible();
    // Badge trạng thái ở header theo đúng trạng thái import (lỗi cũ: vẫn "Đang trích field")
    await expect(page.getByText("Chưa hoàn thiện — chờ bạn quyết")).toBeVisible({ timeout: 30_000 });
    await snap(page, "gap-reading");

    await reading.getByRole("button", { name: "Tiếp tục sửa với FlintFlow" }).click();
    await page.waitForURL(new RegExp(`/projects/${projectId}$`), { timeout: AI_TIMEOUT });
    await expect(page.locator("#flintflow-chat-pane")).toBeVisible({ timeout: 60_000 });
    await snap(page, "gap-workspace");
    // Gap report vẫn tải được sau khi vào chỗ sửa
    await download(request, auth, `${E2E_API_URL}/projects/${projectId}/gap-report?format=docx`, "gap-report.docx");
  });
});
