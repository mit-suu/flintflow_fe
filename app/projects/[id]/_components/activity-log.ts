/**
 * Nhật ký hoạt động của một lượt chạy (FLF-221) — danh sách việc THẬT runner đã làm, dựng từ `state.events` (sống qua
 * SSE, hoặc từ `run-state.events` sau reload). Không bịa tiến độ: mỗi dòng ứng với một sự kiện BE đã phát.
 */
import { stepLabel } from "@/lib/constants/step-registry";
import type { ChangeSummary, StepEvent } from "@/types/pipeline";
import { formatDuration } from "./StepProgress";

/** Sự kiện đã lưu kèm thời điểm: SSE sống ⇒ ms (reducer gắn), run-state sau reload ⇒ ISO (BE gắn). */
export type LoggedEvent = StepEvent & { at?: number | string };

export type ActivityStatus = "done" | "running" | "failed";

export interface ActivityLine {
  key: string;
  kind: "step" | "task";
  text: string;
  status: ActivityStatus;
  /** "00:12" — chỉ có khi biết cả lúc bắt đầu lẫn lúc xong. */
  duration: string | null;
}

const COLLECTION_LABEL: Record<string, string> = {
  project: "thông tin dự án",
  addendum: "ghi chú",
  assumptions: "giả định",
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

const timeOf = (event: LoggedEvent): number | null => {
  if (typeof event.at === "number") return event.at;
  if (typeof event.at === "string") {
    const parsed = Date.parse(event.at);
    return Number.isNaN(parsed) ? null : parsed;
  }
  return null;
};

/** Một sự kiện ⇒ một dòng việc (null ⇒ không đáng thành một dòng: heartbeat, stage, elicit từng chữ…). */
const taskText = (event: StepEvent): { text: string; failed?: boolean } | null => {
  switch (event.type) {
    case "intake":
      return { text: event.empty_fields.length > 0 ? `Đọc dữ liệu · còn thiếu ${event.empty_fields.length} mục` : "Đọc dữ liệu" };
    case "answer_needed":
      return { text: `Hỏi bạn ${event.questions.length} câu` };
    case "answer_received":
      return { text: `Đã nhận ${event.count} câu trả lời` };
    case "draft":
      return { text: event.attempt > 1 ? `AI soạn lại (lần ${event.attempt})` : "AI soạn nội dung" };
    case "draft_retry":
      return { text: `Thử lại lần ${event.attempt}/${event.max}` };
    case "ops_applied": {
      const counts = summaryCounts(event.summary ?? []);
      return { text: counts ? `Đã ghi ${counts}` : `Đã ghi ${event.changes.length} thay đổi` };
    }
    case "render":
      return { text: `Vẽ sơ đồ ${event.diagram_id}`, failed: event.render_status === "error" };
    case "flags":
      return { text: (event.red_delta ?? 0) > 0 ? `Kiểm tra: ${event.red_delta} cờ đỏ mới` : "Kiểm tra quy tắc và tham chiếu" };
    case "auto_accepted":
      return { text: "Tự hoàn tất — không có gì cần bạn quyết" };
    case "gate_ready":
      return { text: "Xong, chờ bạn duyệt" };
    case "error":
      return { text: event.message, failed: true };
    default:
      return null;
  }
};

/**
 * Dòng việc theo thứ tự thời gian, có dòng tiêu đề mỗi khi sang bước khác (chạy cả giai đoạn). Dòng cuối là việc đang
 * làm khi `running`; mọi dòng trước nó đã xong. Thời lượng = từ sự kiện này tới sự kiện kế tiếp.
 */
export const activityLines = (events: readonly LoggedEvent[], running: boolean): ActivityLine[] => {
  const lines: ActivityLine[] = [];
  const starts: (number | null)[] = [];
  let currentStep: string | null = null;
  let lastTask = -1;

  events.forEach((event, index) => {
    const task = taskText(event);
    if (!task) return;
    const time = timeOf(event);
    // Việc trước kết thúc khi việc kế tiếp bắt đầu
    const previous = lastTask;
    if (previous >= 0 && starts[previous] !== null && time !== null) {
      lines[previous].duration = formatDuration(time - (starts[previous] as number));
    }
    if (event.step_id !== currentStep && event.type !== "error") {
      currentStep = event.step_id;
      const label = stepLabel(event.step_id);
      lines.push({ key: `step-${event.step_id}-${index}`, kind: "step", text: label ? `${event.step_id} · ${label}` : event.step_id, status: "done", duration: null });
      starts.push(null);
    }
    lines.push({ key: `${event.type}-${index}`, kind: "task", text: task.text, status: task.failed ? "failed" : "done", duration: null });
    starts.push(time);
    lastTask = lines.length - 1;
  });

  const last = lines.length - 1;
  if (running && last >= 0 && lines[last].kind === "task" && lines[last].status !== "failed") {
    lines[last].status = "running";
    lines[last].duration = null;
  }
  return lines;
};
