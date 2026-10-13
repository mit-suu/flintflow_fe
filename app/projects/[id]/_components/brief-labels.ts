/**
 * Nhãn và phép đọc dữ liệu Brief dùng chung cho `BriefSummaryCard` (Hồ sơ dự án) và `BriefPanel` (khung phải ở pha
 * B-0…B-2). Một bộ nhãn duy nhất — hai nơi hiển thị không được gọi cùng một giá trị bằng hai tên khác nhau.
 */
import type { Addendum, Assumption, AssumptionStatus, OtherRequirement, Spine } from "@/types/spine";

/**
 * Nhãn tiếng Việt cho section đích của addendum — khớp mục của tài liệu, không phải khoá thô.
 *
 * Phủ hết các section cố định mà BE ghi addendum vào (xem bảng step của srs-orchestrator): thiếu nhãn
 * nào thì ghi chú của section đó rơi vào nhóm gộp "Mục khác" và user mất luôn thông tin nó thuộc mục nào.
 *
 * **Thứ tự khai báo chính là thứ tự nhóm hiển thị** (`groupByTarget`), nên giữ đúng thứ tự mục trong
 * tài liệu.
 */
export const SECTION_LABEL: Record<string, string> = {
  "fixed:1": "Tổng quan sản phẩm",
  "fixed:2.1": "Actor",
  "fixed:2.2.1": "Sơ đồ use case",
  "fixed:2.2.2": "Use case",
  "fixed:3.1.1": "Luồng màn hình",
  "fixed:3.1.2": "Mô tả màn",
  "fixed:3.1.3": "Phân quyền màn hình",
  "fixed:3.1.4": "Chức năng không có màn",
  "fixed:3.1.5": "Sơ đồ thực thể",
  "fixed:4.1": "Giao tiếp ngoài",
  "fixed:4.2.1": "Tính dễ dùng",
  "fixed:4.2.2": "Độ tin cậy",
  "fixed:4.2.3": "Hiệu năng",
  "fixed:4.2.4": "Thuộc tính theo lĩnh vực",
  "fixed:5.1": "Quy tắc nghiệp vụ",
  "fixed:5.2": "Yêu cầu dùng chung",
  "fixed:5.3": "Thông báo ứng dụng",
  "fixed:5.4": "Yêu cầu khác (để dành)",
  "fixed:5.5": "Thuật ngữ",
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

/** Khoá gộp của mọi section chưa có nhãn — một nhóm "Mục khác" duy nhất, luôn đứng cuối. */
export const OTHER_SECTION_KEY = "__other__";

/**
 * Nhóm addendum theo `target_section` — đúng cách chúng sẽ đi vào tài liệu.
 *
 * Hai điều phải giữ:
 * - Section chưa có nhãn đều hiển thị cùng một chữ "Mục khác". Để mỗi khoá là một nhóm riêng thì panel
 *   hiện cùng cái tiêu đề đó mấy lần, xen kẽ giữa các nhóm có tên — đọc ra như dữ liệu bị lặp. Gộp hết
 *   vào một nhóm.
 * - Thứ tự nhóm theo thứ tự mục trong tài liệu, không so sánh chuỗi khoá: `localeCompare` xếp
 *   `fixed:10` trước `fixed:2`.
 */
export const groupByTarget = (addendum: Addendum[]): [string, Addendum[]][] => {
  const order = Object.keys(SECTION_LABEL);
  const groups = new Map<string, Addendum[]>();
  for (const entry of addendum) {
    const key = SECTION_LABEL[entry.target_section] ? entry.target_section : OTHER_SECTION_KEY;
    const list = groups.get(key);
    if (list) list.push(entry);
    else groups.set(key, [entry]);
  }
  const rank = (key: string) => (key === OTHER_SECTION_KEY ? order.length : order.indexOf(key));
  return [...groups.entries()].sort(([a], [b]) => rank(a) - rank(b));
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
