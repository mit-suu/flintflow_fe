import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

/**
 * Luồng Brief trọn vẹn trên FE thật + BE thật + **model thật** — từ ý tưởng (B-0.1) tới khi duyệt xong Chốt Brief (B-2).
 *
 * Kịch bản đóng vai một chủ đầu tư thật: tiếng Việt đời thường, viết tắt, trả lời gộp bằng một tin đánh số, hỏi ngược
 * "bạn nghĩ sao", đẩy lại câu kỹ thuật, trả lời bằng ý tưởng thay cho con số, và sửa một điều bằng chat ở cổng duyệt.
 * Mục đích là chấm cách AI hỏi và trả lời, nên spec không khẳng định nội dung câu chữ — nó chỉ đòi luồng đi được tới hết
 * Brief, rồi để lại transcript + ảnh + dump dữ liệu cho người/agent chấm.
 *
 * Gọi model tốn credit nên chỉ chạy khi `E2E_REAL_AI=1`. Biến khác:
 * - `E2E_TICKET` — nhãn trong tên project (`E2E Brief FLF-<ticket> <timestamp>`).
 * - `E2E_BRIEF_OUT` — thư mục ghi `transcript.md`, `dump.json`, ảnh; mặc định `test-results/brief-flow/<timestamp>`.
 * - `E2E_REVIEW_MODE` — `fast` ("Cuối giai đoạn") | `strict` ("Mọi bước"); không đặt ⇒ mặc định của project.
 *
 * Mắt là API (`run-state/active`, `steps`): biết chắc lượt đang chờ gì. Tay là UI: gõ ô chat, bấm lựa chọn, bấm duyệt —
 * đúng đường user đi.
 */

const API = process.env.E2E_API_URL ?? "http://localhost:5000/api/v1";
const EMAIL = process.env.E2E_EMAIL ?? "fixture@flintflow.io";
const PASSWORD = process.env.E2E_PASSWORD ?? "fixture-password-123";
const TICKET = process.env.E2E_TICKET ?? "dev";
const STAMP = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
const OUT = process.env.E2E_BRIEF_OUT ?? join("test-results", "brief-flow", STAMP);
const REVIEW_MODE = process.env.E2E_REVIEW_MODE;
/** `E2E_PROJECT_ID`: chạy tiếp một project đang dở (lượt trước bị dừng giữa chừng) thay vì tạo project mới. */
const RESUME_ID = process.env.E2E_PROJECT_ID;
let PROJECT_NAME = `E2E Brief FLF-${TICKET} ${STAMP}`;
/** Bước cuối của Chốt Brief — duyệt xong nó là hết Brief. */
const LAST_BRIEF_STEP = "B-2.3";
const RUN_TIMEOUT_MS = 40 * 60_000;

/** Ý tưởng lấy từ §1 `docs/demo-project-outpatient-clinic.md`, viết theo giọng user. */
const IDEA =
  "bệnh viện đa khoa công lập tuyến tỉnh bên tôi cần phần mềm quản lý khám ngoại trú, từ đặt lịch khám đến thanh toán bhyt. dự án đầu tư bằng vốn ngân sách nhà nước";
const GATE_CORRECTION = "à không, nền tảng là cả web và app điện thoại nha";
const PUSHBACK = "ủa cái này hệ thống bạn phải tự tìm hiểu và trả lời tôi chứ";
const ASK_BACK = "cái này tôi chưa biết nữa bạn nghĩ sao";
const QUALITATIVE =
  "tôi muốn là bác sĩ khám xong bấm nút là hệ thống báo bệnh nhân kế tiếp đến sớm, đỡ phải ngồi chờ cả buổi ngoài hành lang";
const DELEGATIONS = ["theo khuyến nghị của bạn", "tôi không nghĩ ra, bạn đề xuất đi", "oke"];

interface Envelope<T> {
  data: T | null;
  error: { code: string; message: string } | null;
}
interface QuestionOption {
  label: string;
  description?: string;
}
interface Question {
  id: string;
  text: string;
  header?: string;
  options?: QuestionOption[];
  multiple?: boolean;
}
interface RunState {
  step_id: string;
  run_id: string;
  status: "running" | "waiting_answer" | "gate" | "done" | "interrupted" | "cancelled";
  alive: boolean;
  questions: Question[] | null;
  error: { code: string; message: string } | null;
}
interface StepSummary {
  id: string;
  status: "pending" | "in_progress" | "accepted" | "revision_requested";
}
interface ChatSession {
  _id: string;
  is_pipeline?: boolean;
  messages: { role: "user" | "ai"; content: string; step?: string; createdAt: string }[];
}

// ── Người dùng giả lập ─────────────────────────────────────────────────────────────────────────────────────────────

/** Tình huống bắt buộc mỗi lượt chạy — đếm để transcript ghi đủ/thiếu. */
const situations = { numbered: 0, askBack: 0, pushback: 0, qualitative: 0, gateCorrection: 0, secondTab: 0 };
/** Tab thứ hai mở giữa lượt chạy (FLF-235): BE xong ⇒ UI tab đó phải hiện câu hỏi / cổng trong ≤ 5 s + một nhịp đo. */
const SECOND_TAB_LIMIT_MS = 7_000;
// Chạy tiếp project dở: tình huống đã có ở phần trước (vd `numbered,askBack,gateCorrection`) không cần lặp lại
for (const key of (process.env.E2E_SITUATIONS_DONE ?? "").split(",")) if (key in situations) situations[key as keyof typeof situations]++;

/** Câu kỹ thuật chủ đầu tư không trả lời được. */
const TECHNICAL = /đồng thời|uptime|sẵn sàng|hiệu năng|thời gian phản hồi|phản hồi trong|sao lưu|máy chủ|hạ tầng|công nghệ|kiến trúc|mã hoá|mã hóa|xác thực|tải cao|chịu tải|gói bảo mật|mức bảo mật|tiêu chuẩn bảo mật/i;
/** Câu đòi con số — user trả lời bằng ý tưởng. */
const METRIC = /thời gian chờ|chỉ số|con số|bao nhiêu phút|kpi|đo lường|đo bằng|mục tiêu định lượng|giảm bao nhiêu|%/i;

/** Bảng từ khoá → câu trả lời, nội dung từ `docs/demo-project-outpatient-clinic.md`, giọng user. */
const PERSONA: [RegExp, string][] = [
  [/tên (hệ thống|sản phẩm|phần mềm|dự án)|đặt tên|gọi (hệ thống|sản phẩm) là/i, "gọi là Hệ thống quản lý khám ngoại trú đi, viết tắt OPD cũng đc"],
  // Câu hỏi về hiện trạng thường nhắc cả BHYT/đặt lịch — xét trước các chủ đề cụ thể
  [/điểm nghẽn|hiện (nay|tại|giờ)|đang (làm|thực hiện|xử lý)|vấn đề|khó khăn|bất cập|vì sao|tại sao/i,
    "giờ bn phải xếp hàng từ sáng sớm lấy số, chờ cả buổi mới tới lượt, giấy tờ bhyt nhập tay nhiều nên hay sai bị xuất toán. nghẽn nhất là khâu tiếp đón buổi sáng"],
  [/không làm|ngoài phạm vi|loại trừ|chưa làm|để sau/i, "k làm nội trú, kho dược, quy trình xét nghiệm với chẩn đoán hình ảnh chi tiết, nhân sự, kế toán nha"],
  [/pháp lý|quy định|thông tư|nghị định|tuân thủ|văn bản/i,
    "vốn ngân sách nên theo nđ 73/2019, tt 04/2020 tính chi phí theo điểm use case, qđ 130 của byt về xml bhyt, tt 46/2018 hồ sơ bệnh án điện tử, với luật bảo vệ dữ liệu cá nhân"],
  [/bảo mật|dữ liệu (sức khoẻ|sức khỏe|cá nhân|nhạy cảm)|quyền riêng tư|lộ/i, "dữ liệu sức khỏe là nhạy cảm nên phải bảo mật kỹ, ai có quyền mới xem đc hồ sơ"],
  [/ai (sẽ )?(dùng|sử dụng)|người dùng|đối tượng|vai trò|nhóm người|những ai/i,
    "bệnh nhân, nhân viên tiếp đón, bác sĩ, thu ngân, dược sĩ, cán bộ giám định bhyt vs quản trị hệ thống. còn có cổng giám định bhyt vs cổng thanh toán là hệ thống ngoài"],
  [/phạm vi|tính năng|chức năng|mvp|bắt buộc|làm được gì|cần có/i,
    "đặt lịch online hoặc qua tổng đài, đổi hủy lịch; tiếp đón check-in, kiểm tra thẻ bhyt, cấp stt; bác sĩ ghi chẩn đoán icd-10, chỉ định cận lâm sàng, kê đơn; thu ngân tính phần bhyt trả vs phần bn tự trả; cấp phát thuốc; gửi xml bhyt; quản trị tài khoản danh mục"],
  [/bao nhiêu (ca|lượt|bệnh nhân|người)|quy mô|số lượng|mỗi ngày/i, "tầm 200 ca 1 ngày"],
  [/nền tảng|thiết bị|web|điện thoại/i, "web là chính, bệnh nhân thì có app điện thoại để đặt lịch"],
  [/đối thủ|cạnh tranh|khác biệt|so với/i, "cái này tôi k rõ lắm, bv tôi đang làm giấy là chính"],
  [/khách hàng|chủ đầu tư|ai trả tiền|ngân sách|kinh phí/i, "bv đa khoa tỉnh, vốn ngân sách nhà nước"],
  [/thanh toán|thu (tiền|phí)/i, "thu ngân thu tại quầy, bn cũng thanh toán online đc qua cổng thanh toán"],
  // Nhiều câu nhắc BHYT như bối cảnh — chỉ dùng câu này khi không khớp chủ đề cụ thể hơn
  [/bhyt|bảo hiểm|giám định/i, "có, tiếp đón phải kiểm tra thẻ bhyt qua cổng giám định, cuối cùng lập hồ sơ xml gửi lên cổng giám định bhyt"],
];

let delegationTurn = 0;
const delegate = (): string => DELEGATIONS[delegationTurn++ % DELEGATIONS.length];

/**
 * Câu trả lời cho các câu mở của một lượt. Tình huống bắt buộc được rải vào câu hợp nhất; chưa gặp thì lượt nhiều câu
 * dành một câu cho nó, để lượt hỏi gộp duy nhất (fast path) vẫn đủ tình huống.
 */
const answersFor = (questions: Question[]): string[] => {
  const out: (string | null)[] = questions.map(() => null);
  questions.forEach((q, i) => {
    if (TECHNICAL.test(q.text)) {
      out[i] = situations.pushback === 0 ? PUSHBACK : delegate();
      if (situations.pushback === 0) situations.pushback++;
    } else if (METRIC.test(q.text)) {
      out[i] = QUALITATIVE;
      situations.qualitative++;
    } else {
      const hit = PERSONA.find(([re]) => re.test(q.text));
      if (hit) out[i] = hit[1];
    }
  });
  // Câu không khớp gì: lần đầu hỏi ngược, sau đó uỷ quyền
  questions.forEach((_, i) => {
    if (out[i] !== null) return;
    if (situations.askBack === 0) {
      out[i] = ASK_BACK;
      situations.askBack++;
    } else out[i] = delegate();
  });
  // Lượt ≥ 3 câu còn thiếu tình huống: nhường câu cuối chưa mang tình huống nào cho nó
  if (questions.length >= 3) {
    const plain = (i: number) => ![PUSHBACK, ASK_BACK, QUALITATIVE].includes(out[i] as string);
    const last = [...questions.keys()].reverse().find(plain);
    if (last !== undefined && situations.askBack === 0) {
      out[last] = ASK_BACK;
      situations.askBack++;
    }
  }
  return out as string[];
};

/** Nhãn lựa chọn khuyến nghị, không có thì lựa chọn đầu. */
const recommendedOf = (q: Question): string => {
  const options = q.options ?? [];
  const label = (options.find((o) => /khuyến nghị|recommended/i.test(o.label)) ?? options[0]).label;
  return label.replace(/\s*\((khuyến nghị|recommended)\)\s*$/i, "").trim();
};

// ── Ghi nhận ───────────────────────────────────────────────────────────────────────────────────────────────────────

interface LogEntry {
  at: number;
  kind: "user" | "chip" | "gate" | "note";
  step: string;
  text: string;
}
/** Chạy tiếp theo đoạn (E2E_PROJECT_ID): nhật ký thao tác và tình huống đã gặp nằm ở OUT, nạp lại để transcript đủ. */
const STATE_FILE = join(OUT, "driver-state.json");
const log: LogEntry[] = [];
if (RESUME_ID && existsSync(STATE_FILE)) {
  const saved = JSON.parse(readFileSync(STATE_FILE, "utf8")) as { log: LogEntry[]; situations: typeof situations };
  log.push(...saved.log);
  Object.assign(situations, saved.situations);
}
const note = (kind: LogEntry["kind"], step: string, text: string) => {
  log.push({ at: Date.now(), kind, step, text });
  mkdirSync(OUT, { recursive: true });
  writeFileSync(STATE_FILE, JSON.stringify({ log, situations }));
  // Lượt chạy ~30 phút: in tiến trình để biết kẹt ở đâu khi nhìn log của reporter
  console.log(`[${new Date().toISOString().slice(11, 19)}] ${kind} ${step}: ${text.slice(0, 120).replace(/\n/g, " ⏎ ")}`);
};
let shot = 0;
const screenshot = async (page: Page, name: string) => {
  shot++;
  await page.screenshot({ path: join(OUT, `${String(shot).padStart(2, "0")}-${name}.png`), fullPage: false }).catch(() => undefined);
};

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// ── API ────────────────────────────────────────────────────────────────────────────────────────────────────────────

/** Token đăng nhập của spec — lượt chạy dài hơn hạn access token, `api` tự đăng nhập lại khi gặp 401. */
let accessToken = "";

const login = async (request: APIRequestContext): Promise<string> => {
  const res = await request.post(`${API}/auth/login`, { data: { email: EMAIL, password: PASSWORD } });
  expect(res.ok(), "tài khoản e2e phải đăng nhập được trên BE thật").toBeTruthy();
  accessToken = ((await res.json()) as Envelope<{ accessToken: string }>).data!.accessToken;
  return accessToken;
};

const api = async <T>(request: APIRequestContext, method: "get" | "post", path: string, body?: unknown, retried = false): Promise<Envelope<T>> => {
  const res = await request[method](`${API}${path}`, {
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    ...(body === undefined ? {} : { data: body }),
    timeout: 60_000,
  });
  if (res.status() === 401 && !retried) {
    await login(request);
    return api<T>(request, method, path, body, true);
  }
  return (await res.json()) as Envelope<T>;
};

// ── Kịch bản ───────────────────────────────────────────────────────────────────────────────────────────────────────

// Lượt chạy dài ~30 phút: trace ghi suốt lượt làm worker phình RAM — spec tự chụp ảnh + ghi transcript thay cho trace
test.use({ trace: "off", screenshot: "off", video: "off", actionTimeout: 60_000 });

test.describe("luồng Brief với model thật", () => {
  test.skip(process.env.E2E_REAL_AI !== "1", "chỉ chạy khi E2E_REAL_AI=1 (gọi model thật, tốn credit)");
  test.setTimeout(RUN_TIMEOUT_MS + 5 * 60_000);

  test("từ ý tưởng tới duyệt xong Chốt Brief", async ({ page, request, context }) => {
    mkdirSync(OUT, { recursive: true });
    /** Thời gian tab thứ hai thấy UI rảnh sau khi BE xong lượt (ms); null = chưa đo được. Gói trong object vì gán trong closure. */
    const secondTab: { ms: number | null; tries: number } = { ms: null, tries: 0 };
    const startedAt = Date.now();
    await login(request);

    let projectId: string;
    if (RESUME_ID) {
      projectId = RESUME_ID;
      const existing = await api<{ name: string }>(request, "get", `/projects/${projectId}`);
      expect(existing.data?.name, `project ${projectId} phải tồn tại`).toBeTruthy();
      PROJECT_NAME = existing.data!.name;
      note("note", "-", `chạy tiếp project ${projectId} — ${PROJECT_NAME}`);
    } else {
      const created = await api<{ _id: string }>(request, "post", "/projects", { name: PROJECT_NAME, mode: "fpt" });
      expect(created.data?._id, `tạo project: ${created.error?.message}`).toBeTruthy();
      projectId = created.data!._id;
      note("note", "-", `project ${projectId} — ${PROJECT_NAME}`);
    }

    if (REVIEW_MODE && !RESUME_ID) {
      const spine = await api<{ spine_version: number }>(request, "get", `/projects/${projectId}/spine`);
      const set = await api(request, "post", `/projects/${projectId}/changes`, {
        base_version: spine.data!.spine_version,
        ops: [{ op: "set", path: "project.review_mode", value: REVIEW_MODE, reason: "e2e: cách duyệt" }],
      });
      expect(set.error, "đặt review_mode").toBeNull();
      note("note", "-", `review_mode = ${REVIEW_MODE}`);
    }

    // Đăng nhập qua UI thật
    note("note", "-", "đăng nhập qua UI");
    await page.goto("/login");
    await page.locator("#email").fill(EMAIL);
    await page.locator("#password").fill(PASSWORD);
    await page.getByRole("button", { name: /đăng nhập/i }).click();
    await page.waitForURL(/\/home/, { timeout: 60_000 });
    note("note", "-", "mở workspace");
    // Next dev biên dịch trang workspace lần đầu có thể mất > 30 giây khi máy bận
    await page.goto(`/projects/${projectId}`, { timeout: 180_000 });
    await expect(page.getByText(PROJECT_NAME).first()).toBeVisible({ timeout: 180_000 });
    note("note", "-", "workspace sẵn sàng");

    const chatBox = page.locator("textarea").first();
    const aiIdle = async () => {
      await expect(chatBox).toBeVisible({ timeout: 60_000 });
      await expect(chatBox).not.toHaveAttribute("placeholder", "AI đang làm…", { timeout: 180_000 });
    };
    /** Khung chat đang xem một bước cũ (đã chốt) ⇒ thẻ hỏi / cổng của bước hiện tại không hiện: quay về bước hiện tại. */
    const backToCurrent = async () => {
      const back = page.getByRole("button", { name: /^Về / }).first();
      if (await back.isVisible().catch(() => false)) {
        await back.click();
        await page.waitForTimeout(1_000);
      }
    };
    const sendChat = async (text: string, step: string) => {
      await aiIdle();
      await chatBox.fill(text);
      await chatBox.press("Enter");
      note("user", step, text);
    };

    const steps = async (): Promise<{ current_phase: string | null; current_step: string | null; steps: StepSummary[] }> =>
      (await api<{ current_phase: string | null; current_step: string | null; steps: StepSummary[] }>(request, "get", `/projects/${projectId}/steps`))
        .data!;
    const liveStatus = (run: RunState | null) =>
      run !== null && (run.status === "waiting_answer" || run.status === "gate" || (run.status === "running" && run.alive));
    /**
     * Lượt đang sống. `run-state/active` chỉ trả lượt của step trong registry — lượt hỏi gộp đầu giai đoạn mang step_id
     * là đơn vị giai đoạn (`B-1`) nên phải đọc riêng `/steps/<giai đoạn>/run-state`.
     */
    const activeRun = async (): Promise<RunState | null> => {
      const res = await api<RunState | null>(request, "get", `/projects/${projectId}/run-state/active`);
      if (liveStatus(res.data)) return res.data;
      // `current_phase` có thể còn là giai đoạn vừa xong — suy thêm đơn vị giai đoạn từ `current_step` (B-1.1 ⇒ B-1)
      const summary = await steps();
      const units = new Set([summary.current_step?.replace(/\.\d+.*$/, ""), summary.current_phase].filter((u): u is string => Boolean(u)));
      for (const unit of units) {
        const state = await api<RunState | null>(request, "get", `/projects/${projectId}/steps/${unit}/run-state`);
        if (liveStatus(state.data)) return state.data;
      }
      return res.data;
    };

    /** Chờ lượt đổi trạng thái sau một thao tác — tránh đọc lại đúng trạng thái cũ rồi bấm hai lần. */
    const signature = (run: RunState | null) => (run ? `${run.run_id}|${run.status}|${run.step_id}|${(run.questions ?? []).map((q) => q.id + q.text).join("/")}` : "none");
    const waitForChange = async (before: string) => {
      const until = Date.now() + 10 * 60_000;
      while (Date.now() < until) {
        await page.waitForTimeout(3_000);
        if (signature(await activeRun()) !== before) return;
      }
      throw new Error(`luồng kẹt 10 phút ở trạng thái ${before}`);
    };

    // ── Trả lời một lượt hỏi ──────────────────────────────────────────────────────────────────────────────────
    const answerQuestions = async (run: RunState) => {
      const questions = run.questions ?? [];
      const card = questions.filter((q) => (q.options ?? []).length > 0);
      const open = questions.filter((q) => (q.options ?? []).length === 0);
      await aiIdle();
      await backToCurrent();
      await screenshot(page, `ask-${run.step_id}`);

      // Câu có lựa chọn: bấm lựa chọn khuyến nghị trên thẻ (chưa gửi — ô chat gửi kèm nếu có câu mở)
      const cardBox = page.getByRole("group", { name: /^Câu hỏi \d+ trên \d+$|^Xem lại câu trả lời$/ });
      for (const [i, q] of card.entries()) {
        const label = recommendedOf(q);
        if (card.length > 1) await cardBox.getByRole("tab").nth(i).click();
        await cardBox.getByRole(q.multiple ? "checkbox" : "radio", { name: new RegExp(escapeRe(label)) }).first().click();
        note("chip", run.step_id, `${q.text} → [${label}]`);
      }

      if (open.length === 0) {
        // Câu chọn nhiều không tự sang tab kế — bấm "Tiếp" tới tab "Xem lại" rồi mới có nút gửi
        const submit = cardBox.getByRole("button", { name: /^Gửi câu trả lời$/ });
        for (let i = 0; i <= card.length && !(await submit.isVisible().catch(() => false)); i++) {
          await cardBox.getByRole("button", { name: /^Tiếp$|^Bỏ qua$/ }).last().click();
        }
        await submit.click();
        note("chip", run.step_id, "[Gửi câu trả lời]");
        return;
      }
      const texts = answersFor(open);
      let message: string;
      if (open.length === 1) message = texts[0];
      else {
        message = texts.map((t, i) => `${i + 1}. ${t}`).join("\n");
        situations.numbered++;
      }
      await sendChat(message, run.step_id);
    };

    // ── Cổng duyệt ────────────────────────────────────────────────────────────────────────────────────────────
    const handleGate = async (run: RunState) => {
      await aiIdle();
      await backToCurrent();
      const gateCard = page.getByLabel("Cổng chốt");
      const acceptButton = page.getByRole("button", { name: /Duyệt, sang bước tiếp|Đúng rồi, đi tiếp/ }).last();
      await expect(acceptButton).toBeVisible({ timeout: 60_000 });
      await screenshot(page, `gate-${run.step_id}`);
      const gateText = (await gateCard.count()) > 0 ? await gateCard.last().innerText() : "";
      note("gate", run.step_id, gateText.trim() || "(cổng duyệt dạng tin nhắn AI — xem tin AI ngay trước)");

      // Một lần mỗi lượt chạy: sửa nền tảng bằng chat khi AI đã chốt nền tảng
      if (situations.gateCorrection === 0) {
        const spine = await api<{ project: { form_factor?: string[] | string | null } }>(request, "get", `/projects/${projectId}/spine`);
        const platforms = spine.data?.project.form_factor;
        if (Array.isArray(platforms) ? platforms.length > 0 : Boolean(platforms)) {
          situations.gateCorrection++;
          await sendChat(GATE_CORRECTION, run.step_id);
          return;
        }
      }
      await acceptButton.click();
      note("chip", run.step_id, `[${(await acceptButton.innerText()).trim()}]`);
    };

    // ── Vòng điều khiển ───────────────────────────────────────────────────────────────────────────────────────
    let retries = 0;
    let failures = 0;
    /** Thao tác UI hỏng (không thấy phần tử, hết giờ) ⇒ ghi lại, tải lại trang, vòng sau thử lại; quá 5 lần là luồng gãy. */
    const attempt = async (label: string, action: () => Promise<void>): Promise<boolean> => {
      try {
        await action();
        return true;
      } catch (err) {
        failures++;
        note("note", label, `thao tác lỗi (${failures}): ${err instanceof Error ? err.message.split("\n")[0] : String(err)} — tải lại trang`);
        await screenshot(page, `action-error-${label}`);
        expect(failures, "luồng gãy: thao tác UI lỗi quá 5 lần").toBeLessThanOrEqual(5);
        await page.reload({ timeout: 180_000 }).catch(() => undefined);
        return false;
      }
    };
    let idleSince = 0;
    let done = false;
    while (Date.now() - startedAt < RUN_TIMEOUT_MS) {
      // Xét mỗi vòng: ở "Cuối giai đoạn" FE chạy ngay giai đoạn kế sau khi duyệt B-2 nên lúc nào cũng có lượt sống
      if ((await steps()).steps.find((s) => s.id === LAST_BRIEF_STEP)?.status === "accepted") {
        done = true;
        break;
      }
      const run = await activeRun();
      if (run?.status === "running" && run.alive) {
        idleSince = 0;
        // Một lần mỗi lượt chạy, ở B-2 (bước có hỏi / cổng): mở tab thứ hai giữa lượt, đo lúc BE xong tới lúc tab đó hiện UI
        // Lượt chạy có thể chết giữa chừng (model bị từ chối lô op) ⇒ thử lại tối đa 3 lần, chỉ tính là gặp khi đo được
        if (situations.secondTab === 0 && secondTab.tries < 3 && /^B-2\./.test(run.step_id)) {
          secondTab.tries++;
          await attempt(`second-tab-${run.step_id}`, async () => {
            const tab = await context.newPage();
            try {
              await tab.goto(`/projects/${projectId}`, { timeout: 180_000 });
              await expect(tab.getByText(PROJECT_NAME).first()).toBeVisible({ timeout: 180_000 });
              const box = tab.locator("textarea").first();
              await expect(box).toHaveAttribute("placeholder", "AI đang làm…", { timeout: 30_000 });
              await screenshot(tab, `second-tab-running-${run.step_id}`);
              note("note", run.step_id, "tab thứ hai mở giữa lượt chạy: ô nhập 'AI đang làm…'");
              // Chờ BE xong lượt (hỏi hoặc cổng) theo API, mỗi giây một lần
              let settled: RunState | null = null;
              const until = Date.now() + 10 * 60_000;
              while (Date.now() < until) {
                const now = await activeRun();
                if (now && (now.status === "waiting_answer" || now.status === "gate")) {
                  settled = now;
                  break;
                }
                if (!now || now.status !== "running") break;
                await tab.waitForTimeout(1_000);
              }
              if (!settled) {
                note("note", run.step_id, "tab thứ hai: lượt không dừng ở câu hỏi / cổng — không đo được");
                return;
              }
              const doneAt = Date.now();
              await expect(box).not.toHaveAttribute("placeholder", "AI đang làm…", { timeout: 60_000 });
              if (settled.status === "gate") {
                await expect(tab.getByRole("button", { name: /Duyệt, sang bước tiếp|Đúng rồi, đi tiếp/ }).last()).toBeVisible({ timeout: 60_000 });
              }
              secondTab.ms = Date.now() - doneAt;
              situations.secondTab++;
              await screenshot(tab, `second-tab-settled-${settled.step_id}`);
              note("note", settled.step_id, `tab thứ hai hiện ${settled.status === "gate" ? "cổng" : "câu hỏi"} sau ${secondTab.ms} ms kể từ lúc BE xong (mục tiêu ≤ ${SECOND_TAB_LIMIT_MS})`);
            } finally {
              await tab.close();
            }
          });
          continue;
        }
        await page.waitForTimeout(3_000);
        continue;
      }
      const before = signature(run);
      if (run?.status === "waiting_answer") {
        idleSince = 0;
        if (await attempt(run.step_id, () => answerQuestions(run))) await waitForChange(before);
        continue;
      }
      if (run?.status === "gate") {
        idleSince = 0;
        if (await attempt(run.step_id, () => handleGate(run))) await waitForChange(before);
        continue;
      }
      if (run?.status === "interrupted" || (run?.status === "running" && !run.alive)) {
        retries++;
        note("note", run.step_id, `lượt bị gián đoạn (${run.error?.code ?? "không mã"}) — Chạy lại lần ${retries}`);
        await screenshot(page, `interrupted-${run.step_id}`);
        expect(retries, "luồng gãy: gián đoạn quá 3 lần").toBeLessThanOrEqual(3);
        const rerun = page.getByRole("button", { name: "Chạy lại" }).first();
        if (await rerun.isVisible().catch(() => false)) await rerun.click();
        else await page.reload();
        await waitForChange(before);
        continue;
      }

      // Không có lượt nào: bước tới lượt chưa chạy ⇒ nhắn để chạy (ý tưởng ở lượt đầu)
      await aiIdle();
      const opening = page.getByLabel("Bắt đầu dự án");
      const summary = await steps();
      if (await opening.isVisible().catch(() => false)) {
        await sendChat(IDEA, summary.current_step ?? "B-0.1");
        await waitForChange(before);
        continue;
      }
      const placeholder = (await chatBox.getAttribute("placeholder")) ?? "";
      if (placeholder.startsWith("Kể ý tưởng")) {
        await sendChat("oke tiếp đi", summary.current_step ?? "?");
        await waitForChange(before);
        continue;
      }
      // UI chưa bắt kịp BE: chờ, quá 90 giây thì tải lại trang một lần
      idleSince ||= Date.now();
      if (Date.now() - idleSince > 90_000) {
        await screenshot(page, `stuck-${summary.current_step}`);
        note("note", summary.current_step ?? "?", "UI đứng yên 90 giây — tải lại trang");
        await page.reload();
        idleSince = Date.now();
      }
      await page.waitForTimeout(3_000);
    }

    // ── Kết quả: ảnh Brief, transcript, dump ──────────────────────────────────────────────────────────────────
    const finishedAt = Date.now();
    await page.reload({ timeout: 180_000 });
    await expect(page.getByText(PROJECT_NAME).first()).toBeVisible({ timeout: 180_000 });
    await screenshot(page, "final-workspace");
    const recordButton = page.getByRole("button", { name: /^Hồ sơ/ }).first();
    if (await recordButton.isVisible().catch(() => false)) {
      await recordButton.click();
      await page.waitForTimeout(1_500);
      await screenshot(page, "final-brief-panel");
    }

    const spine = await api<Record<string, unknown>>(request, "get", `/projects/${projectId}/spine`);
    const sp = (spine.data ?? {}) as { project?: Record<string, unknown>; decisions?: unknown; assumptions?: unknown; addendum?: unknown };
    const sessions = await api<ChatSession[]>(request, "get", `/projects/${projectId}/chats`);
    const pipelineSession = (sessions.data ?? []).find((s) => s.is_pipeline) ?? sessions.data?.[0];
    const session = pipelineSession
      ? (await api<ChatSession>(request, "get", `/projects/${projectId}/chats/${pipelineSession._id}`)).data
      : null;
    writeFileSync(
      join(OUT, "dump.json"),
      JSON.stringify({ project_id: projectId, project: sp.project, decisions: sp.decisions, assumptions: sp.assumptions, addendum: sp.addendum }, null, 2)
    );
    writeFileSync(join(OUT, "session.json"), JSON.stringify(session, null, 2));
    writeFileSync(join(OUT, "transcript.md"), renderTranscript(session, projectId, startedAt, finishedAt, done));

    expect(done, `luồng Brief phải tới được hết ${LAST_BRIEF_STEP} trong ${RUN_TIMEOUT_MS / 60_000} phút`).toBeTruthy();
    expect.soft(secondTab.ms, "tab thứ hai mở giữa lượt phải đo được thời gian BE xong → UI hiện").not.toBeNull();
    if (secondTab.ms !== null) expect.soft(secondTab.ms, "tab thứ hai thấy câu hỏi / cổng sau khi BE xong").toBeLessThanOrEqual(SECOND_TAB_LIMIT_MS);
  });
});

/** Tin AI lưu dạng JSON `{reply, questions}` hoặc văn bản thường. */
const aiText = (content: string): string => {
  try {
    const parsed = JSON.parse(content) as { reply?: string; questions?: { question?: string; text?: string; options?: { label: string }[] }[] };
    const qs = (parsed.questions ?? []).map((q, i) => {
      const options = (q.options ?? []).map((o) => o.label).join(" · ");
      return `  ${i + 1}. ${q.question ?? q.text ?? ""}${options ? `  _(chip: ${options})_` : ""}`;
    });
    return [parsed.reply ?? "", ...(qs.length ? ["", "  Câu hỏi:", ...qs] : [])].join("\n").trim();
  } catch {
    return content;
  }
};

const renderTranscript = (session: ChatSession | null, projectId: string, startedAt: number, finishedAt: number, done: boolean): string => {
  type Row = { at: number; line: string };
  const rows: Row[] = [];
  for (const m of session?.messages ?? []) {
    const who = m.role === "ai" ? "**AI**" : "**User**";
    rows.push({ at: Date.parse(m.createdAt), line: `### ${who} · ${m.step ?? "-"}\n\n${m.role === "ai" ? aiText(m.content) : m.content}\n` });
  }
  for (const e of log) {
    if (e.kind === "user") continue; // tin user đã có trong phiên chat
    const label = e.kind === "chip" ? "Bấm" : e.kind === "gate" ? "Cổng duyệt" : "Ghi chú";
    rows.push({ at: e.at, line: `> _${label} · ${e.step}_: ${e.text.replace(/\n+/g, " ⏎ ")}\n` });
  }
  rows.sort((a, b) => a.at - b.at);
  const userTurns = (session?.messages ?? []).filter((m) => m.role === "user").length;
  const minutes = ((finishedAt - startedAt) / 60_000).toFixed(1);
  const covered = Object.entries(situations)
    .map(([k, v]) => `${k}: ${v > 0 ? `có (${v})` : "**chưa gặp**"}`)
    .join(" · ");
  return [
    `# Transcript — ${PROJECT_NAME}`,
    "",
    `- Project: \`${projectId}\` · review_mode: ${REVIEW_MODE ?? "mặc định"}`,
    `- Kết quả: ${done ? `tới hết ${LAST_BRIEF_STEP}` : "**chưa tới hết Brief**"} · ${minutes} phút · ${userTurns} tin user`,
    `- Tình huống giả lập: ${covered}`,
    "",
    "---",
    "",
    ...rows.map((r) => r.line),
  ].join("\n");
};
