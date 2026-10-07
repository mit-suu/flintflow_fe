/**
 * Nhật ký hoạt động của một lượt chạy (FLF-221) — danh sách việc THẬT runner đã làm, dựng từ `state.events` (sống qua
 * SSE, hoặc từ `run-state.events` sau reload). Không bịa tiến độ: mỗi dòng ứng với một sự kiện BE đã phát.
 *
 * Viết như IDE báo việc của agent: mỗi dòng là một hành động kèm KẾT QUẢ user quan tâm ("Cập nhật Brief" + các mục vừa
 * ghi bên dưới), không phải số đếm nội bộ ("còn thiếu 5 mục", "Hỏi bạn 3 câu", "Đã nhận 0 câu trả lời") hay thời lượng
 * từng dòng. Việc đã có thẻ riêng trên màn hình (câu hỏi, cổng duyệt) không lặp lại thành dòng.
 */
import { workspaceStepLabel as stepLabel } from "./phase-labels";
import type { ChangeSummary, StepEvent } from "@/types/pipeline";
import { projectFieldText } from "./GateCard";

/** Sự kiện đã lưu kèm thời điểm: SSE sống ⇒ ms (reducer gắn), run-state sau reload ⇒ ISO (BE gắn). */
export type LoggedEvent = StepEvent & { at?: number | string };

export type ActivityStatus = "done" | "running" | "failed";

export interface ActivityLine {
  key: string;
  kind: "step" | "task";
  text: string;
  status: ActivityStatus;
  /** Tooltip: mã bước — chỉ để tra cứu, không nằm trong chữ hiện ra. */
  title?: string;
  /** Chi tiết thụt dòng dưới việc — những gì vừa được ghi, bằng lời thường. */
  details: string[];
}

const COLLECTION_LABEL: Record<string, string> = {
  project: "thông tin dự án",
  addendum: "ghi chú",
  assumptions: "điều tôi tạm hiểu",
  other_requirements: "yêu cầu khác",
  actors: "actor",
  roles: "vai trò",
  use_cases: "use case",
  features: "tính năng",
  screens: "màn hình",
  functions: "chức năng",
  entities: "thực thể",
  nfrs: "NFR",
  business_rules: "quy tắc",
  messages: "thông báo",
  glossary: "thuật ngữ",
  permissions: "phân quyền",
};

const PREFIX: Record<ChangeSummary["kind"], string> = { add: "+", update: "~", remove: "−" };
const VERB: Record<ChangeSummary["kind"], string> = { add: "Thêm", update: "Cập nhật", remove: "Xoá" };

/** Số mục chi tiết tối đa dưới một việc ghi — còn lại gộp thành "và N mục khác". */
const MAX_DETAILS = 5;

/** "+3 actor ~1 use case" — gộp theo loại thay đổi và nhóm dữ liệu. */
export const summaryCounts = (rows: readonly ChangeSummary[]): string => {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const key = `${PREFIX[row.kind]}|${COLLECTION_LABEL[row.collection] ?? row.collection}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()].map(([key, n]) => {
    const [prefix, label] = key.split("|");
    return `${prefix}${n} ${label}`;
  }).join(" ");
};

/** Nhật ký nói "điều tôi tạm hiểu" như panel Brief, không dùng chữ "giả định" của tài liệu. */
const plainWording = (text: string): string => text.replace(/giả định/gi, "điều tôi tạm hiểu");

/** Một dòng thay đổi bằng lời thường: "Tên hệ thống: Internal Hub", "Tôi tạm hiểu: …". */
const changeText = (row: ChangeSummary): string => {
  if (row.collection === "project") return projectFieldText(row.title_vi);
  if (row.collection === "assumptions") return `${row.kind === "add" ? "Tôi tạm hiểu" : row.kind === "update" ? "Cập nhật điều tôi tạm hiểu" : "Bỏ điều tôi tạm hiểu"}: ${plainWording(row.title_vi)}`;
  // Yêu cầu khác chỉ có bản tiếng Anh (statement) — khung chat pha Brief không hiện câu tiếng Anh, chỉ nói có thêm mục
  if (row.collection === "other_requirements") return `${VERB[row.kind]} ${COLLECTION_LABEL[row.collection]}`;
  return `${VERB[row.kind]} ${COLLECTION_LABEL[row.collection] ?? row.collection}: ${row.title_vi}`;
};

const changeDetails = (rows: readonly ChangeSummary[]): string[] => {
  const shown = rows.slice(0, MAX_DETAILS).map(changeText);
  return rows.length > MAX_DETAILS ? [...shown, `và ${rows.length - MAX_DETAILS} mục khác`] : shown;
};

/** Một sự kiện ⇒ một dòng việc (null ⇒ không đáng thành một dòng: nội bộ, hoặc đã có thẻ riêng trên màn hình). */
const taskOf = (event: StepEvent): { text: string; details?: string[]; failed?: boolean; transient?: boolean } | null => {
  switch (event.type) {
    case "answer_received":
      // Chỉ là trạng thái lúc AI đang đọc — xong thì lời đáp của AI đã nói điều đó, không để lại thành dòng
      return { text: event.count > 0 ? "Đọc câu trả lời của bạn" : "Đọc tin nhắn của bạn", transient: true };
    case "draft":
      // Lượt soạn lại do bản nháp sai khuôn là việc nội bộ — với user vẫn chỉ là một việc "Soạn nội dung"
      return event.attempt > 1 ? null : { text: "Soạn nội dung" };
    case "ops_applied": {
      const rows = event.summary ?? [];
      if (rows.length === 0) return { text: `Ghi ${event.changes.length} thay đổi` };
      return { text: `Ghi ${summaryCounts(rows)}`, details: changeDetails(rows) };
    }
    case "render":
      // Mã sơ đồ (D-UC-01) là id nội bộ — không nằm trong chữ hiện ra
      return event.render_status === "error" ? { text: "Chưa vẽ được một sơ đồ", failed: true } : { text: "Vẽ sơ đồ" };
    case "flags":
      return (event.red_delta ?? 0) > 0 ? { text: `Phát hiện ${event.red_delta} lỗi cần sửa`, failed: true } : null;
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
export const activityLines = (events: readonly LoggedEvent[], running: boolean): ActivityLine[] => {
  const lines: ActivityLine[] = [];
  let currentStep: string | null = null;
  // Việc "tạm" chỉ hiện khi nó là việc cuối và lượt còn đang chạy
  const lastTaskIndex = events.reduce((last, event, index) => (taskOf(event) ? index : last), -1);

  events.forEach((event, index) => {
    const task = taskOf(event);
    if (!task) return;
    if (task.transient && !(running && index === lastTaskIndex)) return;
    if (event.step_id !== currentStep && event.type !== "error") {
      currentStep = event.step_id;
      // Chữ hiện ra chỉ có tên bước; mã bước nằm ở tooltip
      const label = stepLabel(event.step_id);
      const named = label !== event.step_id;
      lines.push({ key: `step-${event.step_id}-${index}`, kind: "step", text: named ? plainWording(label) : "Bước tiếp theo", title: event.step_id, status: "done", details: [] });
    }
    lines.push({ key: `${event.type}-${index}`, kind: "task", text: task.text, status: task.failed ? "failed" : "done", details: task.details ?? [] });
  });

  const out = lines.filter((line) => line.kind === "task").length === 0 || lines.filter((line) => line.kind === "step").length > 1
    ? lines
    : lines.filter((line) => line.kind === "task");
  const last = out.length - 1;
  if (running && last >= 0 && out[last].kind === "task" && out[last].status !== "failed") out[last].status = "running";
  return out;
};
