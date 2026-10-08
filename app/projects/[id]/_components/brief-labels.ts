/**
 * Nhãn và phép đọc dữ liệu Brief dùng chung cho `BriefSummaryCard` (Hồ sơ dự án) và `BriefPanel` (khung phải ở pha
 * B-0…B-2). Một bộ nhãn duy nhất — hai nơi hiển thị không được gọi cùng một giá trị bằng hai tên khác nhau.
 */
import type { Addendum, Assumption, AssumptionStatus, OtherRequirement, Spine } from "@/types/spine";

/** Nhãn tiếng Việt cho section đích của addendum — khớp mục của tài liệu, không phải khoá thô. */
export const SECTION_LABEL: Record<string, string> = {
  "fixed:1": "Tổng quan sản phẩm",
  "fixed:2.1": "Actor",
  "fixed:3.1.2": "Mô tả màn",
  "fixed:4.2.2": "Độ tin cậy",
  "fixed:4.2.3": "Hiệu năng",
  "fixed:5.4": "Yêu cầu khác (để dành)",
};

export const FORM_FACTOR_LABEL: Record<string, string> = {
  web_app: "Web",
  mobile_app: "Mobile",
  desktop_app: "Desktop",
  api_service: "API",
  cli: "CLI",
  embedded: "Nhúng",
};

export const STAKES_LABEL: Record<string, string> = {
  internal: "Nội bộ",
  production: "Chạy thật",
  regulated: "Có quản lý ngành",
};

export const OTHER_KIND_LABEL: Record<string, string> = {
  risk: "Rủi ro",
  assumption: "Giả định",
  open_question: "Câu hỏi mở",
  technical_risk: "Rủi ro kỹ thuật",
};

export const ASSUMPTION_STATUS_LABEL: Record<AssumptionStatus, string> = {
  unconfirmed: "Chưa xác nhận",
  confirmed: "Đã xác nhận",
  rejected: "Đã bỏ",
};

/** Danh sách nền tảng (FLF-237); dữ liệu cũ / cache còn là một chuỗi ⇒ coi như mảng một phần tử; rỗng ⇒ null. */
export const formFactorList = (value: string[] | string | null | undefined): string[] =>
  Array.isArray(value) ? value.filter((v) => v.trim() !== "") : value ? [value] : [];

/** "Web · Mobile" — nền tảng chính đứng đầu; không có nền tảng nào ⇒ null. */
export const formFactorLabel = (value: string[] | string | null | undefined): string | null => {
  const labels = formFactorList(value).map((v) => FORM_FACTOR_LABEL[v] ?? v);
  return labels.length === 0 ? null : labels.join(" · ");
};

export const stakesLabel = (value: string | null | undefined): string | null => (value ? (STAKES_LABEL[value] ?? value) : null);

/** Câu giả định bằng ngôn ngữ user (FLF-221); dữ liệu cũ chưa có `statement_vi` ⇒ bản EN. */
export const assumptionText = (assumption: Pick<Assumption, "statement" | "statement_vi">): string =>
  assumption.statement_vi?.trim() || assumption.statement;

/** Rủi ro / câu hỏi mở bằng ngôn ngữ user (FLF-237); dữ liệu cũ chưa có `statement_vi` ⇒ bản EN. */
export const otherRequirementText = (item: Pick<OtherRequirement, "statement" | "statement_vi">): string =>
  item.statement_vi?.trim() || item.statement;

/** Nhóm addendum theo `target_section` — đúng cách chúng sẽ đi vào tài liệu. */
export const groupByTarget = (addendum: Addendum[]): [string, Addendum[]][] => {
  const groups = new Map<string, Addendum[]>();
  for (const entry of addendum) {
    const list = groups.get(entry.target_section);
    if (list) list.push(entry);
    else groups.set(entry.target_section, [entry]);
  }
  return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
};

/** Khoá máy của addendum lõi mà pha Brief ghi thay cho `project.vision` / `project.goals` (mỗi mục tiêu một entry). */
export const BRIEF_VISION_TOPIC = "vision";
export const BRIEF_GOALS_TOPIC = "goals";

const normalizeTopic = (topic: string): string => topic.trim().toLowerCase();

/** Entry addendum lõi (tầm nhìn / mục tiêu) — hiện ở ô riêng, không lặp trong "Điều bạn đã kể". */
export const isBriefCoreTopic = (topic: string): boolean => {
  const key = normalizeTopic(topic);
  return key === BRIEF_VISION_TOPIC || key === BRIEF_GOALS_TOPIC;
};

export interface BriefGoal {
  id: string;
  text: string;
}

/**
 * Tầm nhìn + mục tiêu của Brief bằng ngôn ngữ user: đọc `content` của addendum lõi; dự án cũ chưa có addendum lõi
 * thì rơi về `project.vision` / `project.goals`.
 */
export const briefVisionGoals = (spine: Pick<Spine, "project" | "addendum">): { vision: string | null; goals: BriefGoal[] } => {
  const core = spine.addendum.filter((entry) => isBriefCoreTopic(entry.topic) && entry.content.trim() !== "");
  if (core.length === 0) {
    return {
      vision: spine.project.vision?.trim() || null,
      goals: spine.project.goals.filter((g) => g.trim() !== "").map((text, i) => ({ id: `project-goal-${i}`, text })),
    };
  }
  const vision = core.find((entry) => normalizeTopic(entry.topic) === BRIEF_VISION_TOPIC)?.content.trim() || null;
  const goals = core
    .filter((entry) => normalizeTopic(entry.topic) === BRIEF_GOALS_TOPIC)
    .map((entry) => ({ id: entry.id, text: entry.content.trim() }));
  return { vision, goals };
};
