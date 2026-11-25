/**
 * Nhật ký hoạt động của một lượt chạy (FLF-221) — danh sách việc THẬT runner đã làm, dựng từ `state.events` (sống qua
 * SSE, hoặc từ `run-state.events` sau reload). Không bịa tiến độ: mỗi dòng ứng với một sự kiện BE đã phát.
 *
 * Viết như IDE báo việc của agent: mỗi dòng là một hành động kèm KẾT QUẢ user quan tâm ("Cập nhật Brief" + các mục vừa
 * ghi bên dưới), không phải số đếm nội bộ ("còn thiếu 5 mục", "Hỏi bạn 3 câu", "Đã nhận 0 câu trả lời") hay thời lượng
 * từng dòng. Việc đã có thẻ riêng trên màn hình (câu hỏi, cổng duyệt) không lặp lại thành dòng.
 */
import { createTranslator } from "next-intl";
import { DEFAULT_LOCALE, type Locale } from "@/lib/i18n";
import en from "@/messages/en.json";
import vi from "@/messages/vi.json";
import { workspaceStepLabel as stepLabel } from "./phase-labels";
import type { ChangeSummary, RunStage, StepEvent } from "@/types/pipeline";
import { projectFieldText, type GateHelpersT } from "./gate-helpers";

const MESSAGES = { vi, en } as const;
/** Helper thuần (không hook) ⇒ dịch qua `createTranslator` theo locale nơi gọi truyền vào. */
const translatorFor = (locale: Locale) => createTranslator({ locale, messages: MESSAGES[locale], namespace: "workspace.activityLog" });
type ActivityTranslator = ReturnType<typeof translatorFor>;
/** Field lẻ của `project` dịch bằng helper của cổng chốt (`workspace.gateHelpers`, key động ⇒ translator dạng lỏng). */
const gateHelpersFor = (locale: Locale) =>
  createTranslator({ locale, messages: MESSAGES[locale], namespace: "workspace.gateHelpers" }) as unknown as GateHelpersT;

/** Sự kiện đã lưu kèm thời điểm: SSE sống ⇒ ms (reducer gắn), run-state sau reload ⇒ ISO (BE gắn). */
export type LoggedEvent = StepEvent & { at?: number | string };

export type ActivityStatus = "done" | "running" | "failed" | "todo";

export interface ActivityLine {
  key: string;
  kind: "step" | "task";
  text: string;
  status: ActivityStatus;
  /** Giai đoạn của lượt chạy mà dòng này thuộc về (dòng dựng từ event `stage`) — để biết việc nào còn chưa tới. */
  stage?: RunStage;
  /** Thời điểm dòng bắt đầu (ms epoch) — dòng đang làm đếm chữ phụ từ đây. */
  at?: number;
  /** Lượt thứ mấy của giai đoạn (soạn lại, kiểm tra lại) — từ 2 hiện nhãn "Lần 2". */
  round?: number;
  /** Tooltip: mã bước — chỉ để tra cứu, không nằm trong chữ hiện ra. */
  title?: string;
  /** Chi tiết thụt dòng dưới việc — những gì vừa được ghi, bằng lời thường. */
  details: string[];
}

/** Nhóm dữ liệu có nhãn đời thường (`workspace.activityLog.collections`); nhóm lạ hiện nguyên tên. */
const COLLECTIONS = new Set([
  "project", "addendum", "assumptions", "other_requirements", "actors", "roles", "use_cases", "features",
  "screens", "functions", "entities", "nfrs", "business_rules", "messages", "glossary", "permissions",
] as const);
type KnownCollection = typeof COLLECTIONS extends Set<infer K> ? K : never;

const collectionLabel = (collection: string, t: ActivityTranslator): string =>
  COLLECTIONS.has(collection as KnownCollection) ? t(`collections.${collection as KnownCollection}`) : collection;

const PREFIX: Record<ChangeSummary["kind"], string> = { add: "+", update: "~", remove: "−" };

/** Số mục chi tiết tối đa dưới một việc ghi — còn lại gộp thành "và N mục khác". */
const MAX_DETAILS = 5;

/** "+3 actor ~1 use case" — gộp theo loại thay đổi và nhóm dữ liệu. */
export const summaryCounts = (rows: readonly ChangeSummary[], locale: Locale = DEFAULT_LOCALE): string => {
  const t = translatorFor(locale);
  const counts = new Map<string, number>();
  for (const row of rows) {
    const key = `${PREFIX[row.kind]}|${collectionLabel(row.collection, t)}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()].map(([key, n]) => {
    const [prefix, label] = key.split("|");
    return `${prefix}${n} ${label}`;
  }).join(" ");
};

/** Nhật ký nói "điều tôi tạm hiểu" như panel Brief, không dùng chữ "giả định" của tài liệu (chỉ chữ tiếng Việt). */
const plainWording = (text: string): string => text.replace(/giả định/gi, "điều tôi tạm hiểu");

/** Một dòng thay đổi bằng lời thường: "Tên hệ thống: Internal Hub", "Tôi tạm hiểu: …". */
const changeText = (row: ChangeSummary, t: ActivityTranslator, locale: Locale): string => {
  if (row.collection === "project") return projectFieldText(row.title_vi, gateHelpersFor(locale));
  // `title_vi` là dữ liệu BE — giữ nguyên, chỉ phần lời quanh nó theo ngôn ngữ giao diện
  if (row.collection === "assumptions") return t(`assumption.${row.kind}`, { title: plainWording(row.title_vi) });
  const verb = t(`verbs.${row.kind}`);
  // Yêu cầu khác chỉ có bản tiếng Anh (statement) — khung chat pha Brief không hiện câu tiếng Anh, chỉ nói có thêm mục
  if (row.collection === "other_requirements") return t("changeShort", { verb, collection: collectionLabel(row.collection, t) });
  return t("change", { verb, collection: collectionLabel(row.collection, t), title: row.title_vi });
};

const changeDetails = (rows: readonly ChangeSummary[], t: ActivityTranslator, locale: Locale): string[] => {
  const shown = rows.slice(0, MAX_DETAILS).map((row) => changeText(row, t, locale));
  return rows.length > MAX_DETAILS ? [...shown, t("more", { count: rows.length - MAX_DETAILS })] : shown;
};

/** Một sự kiện ⇒ một dòng việc (null ⇒ không đáng thành một dòng: nội bộ, hoặc đã có thẻ riêng trên màn hình). */
const taskOf = (event: StepEvent, t: ActivityTranslator, locale: Locale): { text: string; details?: string[]; failed?: boolean; transient?: boolean } | null => {
  switch (event.type) {
    case "answer_received":
      // Chỉ là trạng thái lúc AI đang đọc — xong thì lời đáp của AI đã nói điều đó, không để lại thành dòng
      return { text: event.count > 0 ? t("readingAnswers") : t("readingMessage"), transient: true };
    case "stage":
      // Giai đoạn thật của lượt chạy (BE phát khi bắt đầu giai đoạn) ⇒ dòng đang làm ngay từ đầu, không phải chờ ghi xong
      // mới có dòng. Chữ chung chung: không lô, không mã bước. `gate` đã có thẻ chốt riêng.
      switch (event.stage) {
        case "intake":
          return { text: t("stages.intake") };
        case "ask":
          return { text: t("stages.ask") };
        case "draft":
          return { text: t("drafting") };
        case "check":
          return { text: t("stages.check") };
        case "render":
          return { text: t("stages.render") };
        default:
          return null;
      }
    case "draft":
      // Lượt soạn lại do bản nháp sai khuôn là việc nội bộ — với user vẫn chỉ là một việc "Soạn nội dung"
      return event.attempt > 1 ? null : { text: t("drafting") };
    case "ops_applied": {
      const rows = event.summary ?? [];
      if (rows.length === 0) return { text: t("wroteCount", { count: event.changes.length }) };
      return { text: t("wrote", { summary: summaryCounts(rows, locale) }), details: changeDetails(rows, t, locale) };
    }
    case "render":
      // Mã sơ đồ (D-UC-01) là id nội bộ — không nằm trong chữ hiện ra
      return event.render_status === "error" ? { text: t("renderFailed"), failed: true } : { text: t("rendered") };
    case "flags":
      return (event.red_delta ?? 0) > 0 ? { text: t("flagsFound", { count: event.red_delta ?? 0 }), failed: true } : null;
    case "error":
      // Thẻ lỗi ngay dưới nhật ký đã nói câu này, kèm việc user làm được. Nhắc lại ở đây chỉ thành tiếng vọng.
      return null;
    default:
      return null;
  }
};

/**
 * Dòng việc theo thứ tự thời gian. Chạy liền nhiều bước (cả giai đoạn) thì có dòng tiêu đề mỗi khi sang bước khác;
 * một bước lẻ thì không — thẻ ngay dưới đã nói bước nào. Dòng cuối là việc đang làm khi `running`.
 */
export const activityLines = (events: readonly LoggedEvent[], running: boolean, locale: Locale = DEFAULT_LOCALE): ActivityLine[] => {
  const t = translatorFor(locale);
  const lines: ActivityLine[] = [];
  let currentStep: string | null = null;
  // Việc "tạm" chỉ hiện khi nó là việc cuối và lượt còn đang chạy
  const lastTaskIndex = events.reduce((last, event, index) => (taskOf(event, t, locale) ? index : last), -1);

  // Mỗi giai đoạn của một bước chỉ một dòng (soạn lại / kiểm tra lại ⇒ cùng dòng, tăng `round`); dòng đang làm = giai đoạn
  // vừa bắt đầu sau cùng. Việc ghi dữ liệu / vẽ sơ đồ gắn vào dòng giai đoạn của nó thay vì thành dòng riêng.
  const stageRow = new Map<string, ActivityLine>();
  let currentRow: ActivityLine | null = null;

  events.forEach((event, index) => {
    const task = taskOf(event, t, locale);
    if (!task) return;
    if (task.transient && !(running && index === lastTaskIndex)) return;
    if (event.step_id !== currentStep && event.type !== "error") {
      currentStep = event.step_id;
      currentRow = null;
      // Chữ hiện ra chỉ có tên bước; mã bước nằm ở tooltip
      const label = stepLabel(event.step_id, locale);
      const named = label !== event.step_id;
      lines.push({ key: `step-${event.step_id}-${index}`, kind: "step", text: named ? plainWording(label) : t("nextStep"), title: event.step_id, status: "done", details: [] });
    }
    const at = typeof event.at === "string" ? Date.parse(event.at) : event.at;
    const stage: RunStage | undefined =
      event.type === "stage" ? event.stage : event.type === "draft" ? "draft" : event.type === "render" ? "render" : undefined;

    if (stage) {
      const rowKey = `${event.step_id}|${stage}`;
      const row = stageRow.get(rowKey);
      if (row) {
        // Giai đoạn quay lại (BE báo lại `stage`) ⇒ lượt mới của cùng việc; event `draft` / `render` lẻ chỉ là cùng lượt
        if (event.type === "stage" && currentRow !== row) {
          row.round = (row.round ?? 1) + 1;
          row.at = at;
          if (stage === "draft") row.text = t("redrafting");
        }
        if (task.failed) row.status = "failed";
        currentRow = row;
        return;
      }
      const created: ActivityLine = { key: `${event.type}-${index}`, kind: "task", text: task.text, status: task.failed ? "failed" : "done", details: [], stage, at, round: 1 };
      stageRow.set(rowKey, created);
      lines.push(created);
      currentRow = created;
      return;
    }

    // Ghi dữ liệu ⇒ chi tiết của dòng "Soạn nội dung" của bước (tóm tắt trước, rồi từng mục)
    const draftRow = stageRow.get(`${event.step_id}|draft`);
    if (event.type === "ops_applied" && draftRow) {
      draftRow.details = [task.text, ...(task.details ?? [])];
      return;
    }
    const prev = lines[lines.length - 1];
    if (prev?.kind === "task" && prev.text === task.text && !task.details?.length) {
      if (task.failed) prev.status = "failed";
      return;
    }
    lines.push({ key: `${event.type}-${index}`, kind: "task", text: task.text, status: task.failed ? "failed" : "done", details: task.details ?? [], at });
  });

  const out = lines.filter((line) => line.kind === "task").length === 0 || lines.filter((line) => line.kind === "step").length > 1
    ? lines
    : lines.filter((line) => line.kind === "task");
  const current = currentRow as ActivityLine | null;
  const active = running ? (current ?? [...out].reverse().find((line) => line.kind === "task") ?? null) : null;
  if (active && active.status !== "failed") {
    active.status = "running";
    // Giai đoạn sau dòng đang làm đã chạy ở lượt trước (soạn lại ⇒ sẽ kiểm tra lại) ⇒ chưa tới
    const order = (line: ActivityLine) => UPCOMING_ORDER.indexOf(line.stage as (typeof UPCOMING_ORDER)[number]);
    const activeOrder = order(active);
    for (const line of out) {
      if (line !== active && line.kind === "task" && line.status === "done" && activeOrder >= 0 && order(line) > activeOrder) line.status = "todo";
    }
    // Như danh sách việc của agent: các giai đoạn chưa xuất hiện của bước hiện mờ ở dưới
    if (activeOrder >= 0) {
      const seen = new Set(out.filter((line) => line.kind === "task").map((line) => line.stage));
      for (const stage of UPCOMING_ORDER.slice(activeOrder + 1)) {
        if (!seen.has(stage)) out.push({ key: `todo-${stage}`, kind: "task", text: stageText(stage, t), status: "todo", details: [], stage });
      }
    }
  }
  return out;
};

/** Giai đoạn mọi lượt soạn đều qua, theo thứ tự (vẽ sơ đồ chỉ có ở một số bước ⇒ không báo trước). */
const UPCOMING_ORDER = ["intake", "draft", "check"] as const;
const stageText = (stage: (typeof UPCOMING_ORDER)[number], t: ActivityTranslator): string =>
  stage === "draft" ? t("drafting") : t(`stages.${stage}`);
