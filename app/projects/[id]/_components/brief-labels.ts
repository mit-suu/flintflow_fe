/**
 * Nhãn và phép đọc dữ liệu Brief dùng chung cho `BriefSummaryCard` (Hồ sơ dự án) và `BriefPanel` (khung phải ở pha
 * B-0…B-2). Một bộ nhãn duy nhất — hai nơi hiển thị không được gọi cùng một giá trị bằng hai tên khác nhau.
 */
import type { Locale } from "@/lib/i18n";
import type { Addendum, Assumption, OtherRequirement, Spine } from "@/types/spine";

/**
 * Section đích của addendum ⇒ khoá nhãn trong `messages → workspace.briefLabels.section` (khoá message không chứa được
 * `:`/`.` nên không dùng thẳng id section) — khớp mục của tài liệu, không phải khoá thô.
 *
 * Phủ hết các section cố định mà BE ghi addendum vào (xem bảng step của srs-orchestrator): thiếu nhãn
 * nào thì ghi chú của section đó rơi vào nhóm gộp "Mục khác" và user mất luôn thông tin nó thuộc mục nào.
 *
 * **Thứ tự khai báo chính là thứ tự nhóm hiển thị** (`groupByTarget`), nên giữ đúng thứ tự mục trong
 * tài liệu.
 */
const SECTION_KEY = {
  "fixed:1": "s1",
  "fixed:2.1": "s2_1",
  "fixed:2.2.1": "s2_2_1",
  "fixed:2.2.2": "s2_2_2",
  "fixed:3.1.1": "s3_1_1",
  "fixed:3.1.2": "s3_1_2",
  "fixed:3.1.3": "s3_1_3",
  "fixed:3.1.4": "s3_1_4",
  "fixed:3.1.5": "s3_1_5",
  "fixed:4.1": "s4_1",
  "fixed:4.2.1": "s4_2_1",
  "fixed:4.2.2": "s4_2_2",
  "fixed:4.2.3": "s4_2_3",
  "fixed:4.2.4": "s4_2_4",
  "fixed:5.1": "s5_1",
  "fixed:5.2": "s5_2",
  "fixed:5.3": "s5_3",
  "fixed:5.4": "s5_4",
  "fixed:5.5": "s5_5",
} as const;

type SectionKey = (typeof SECTION_KEY)[keyof typeof SECTION_KEY];

const sectionKeyOf = (sectionId: string): SectionKey | undefined =>
  Object.prototype.hasOwnProperty.call(SECTION_KEY, sectionId) ? SECTION_KEY[sectionId as keyof typeof SECTION_KEY] : undefined;

/**
 * Translator của `workspace.briefLabels` — truyền thẳng `useTranslations("workspace.briefLabels")`. Chỉ khai các khoá
 * helper dùng, để helper `.ts` thuần không phải biết kiểu đầy đủ của next-intl.
 */
export type BriefLabelsTranslator = (
  key: `section.${SectionKey}` | `formFactor.${FormFactorKey}` | `stakes.${StakesKey}` | `otherKind.${OtherKindKey}` | "otherSection"
) => string;

/** Nhãn mục tài liệu của section đích (`fixed:2.1` ⇒ "Actor"); section chưa có nhãn ⇒ null. */
export const sectionLabel = (sectionId: string, t: BriefLabelsTranslator): string | null => {
  const key = sectionKeyOf(sectionId);
  return key ? t(`section.${key}`) : null;
};

/**
 * Bảng tiếng Việt giữ lại cho `gate-helpers.ts` (nhóm khác sở hữu); phần hiển thị của nhóm Brief đi qua
 * `formFactorLabel` / `stakesLabel` (theo ngôn ngữ giao diện).
 */
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

const FORM_FACTOR_KEYS = ["web_app", "mobile_app", "desktop_app", "api_service", "cli", "embedded"] as const;
type FormFactorKey = (typeof FORM_FACTOR_KEYS)[number];
const STAKES_KEYS = ["internal", "production", "regulated"] as const;
type StakesKey = (typeof STAKES_KEYS)[number];
const OTHER_KIND_KEYS = ["risk", "assumption", "open_question", "technical_risk"] as const;
type OtherKindKey = (typeof OTHER_KIND_KEYS)[number];

const isOneOf = <K extends string>(keys: readonly K[], value: string): value is K => (keys as readonly string[]).includes(value);

/** Loại rủi ro / câu hỏi mở (`other_requirements[].kind`); loại lạ ⇒ nguyên khoá. */
export const otherKindLabel = (kind: string, t: BriefLabelsTranslator): string =>
  isOneOf(OTHER_KIND_KEYS, kind) ? t(`otherKind.${kind}`) : kind;

/** Danh sách nền tảng (FLF-237); dữ liệu cũ / cache còn là một chuỗi ⇒ coi như mảng một phần tử; rỗng ⇒ null. */
export const formFactorList = (value: string[] | string | null | undefined): string[] =>
  Array.isArray(value) ? value.filter((v) => v.trim() !== "") : value ? [value] : [];

/** "Web · Mobile" — nền tảng chính đứng đầu; không có nền tảng nào ⇒ null. */
export const formFactorLabel = (value: string[] | string | null | undefined, t: BriefLabelsTranslator): string | null => {
  const labels = formFactorList(value).map((v) => (isOneOf(FORM_FACTOR_KEYS, v) ? t(`formFactor.${v}`) : v));
  return labels.length === 0 ? null : labels.join(" · ");
};

export const stakesLabel = (value: string | null | undefined, t: BriefLabelsTranslator): string | null =>
  value ? (isOneOf(STAKES_KEYS, value) ? t(`stakes.${value}`) : value) : null;

/**
 * Câu giả định theo ngôn ngữ giao diện: `vi` ⇒ `statement_vi` (FLF-221, dữ liệu cũ chưa có thì bản EN); `en` ⇒ bản EN
 * (`statement`) — BE luôn ghi bản này.
 */
export const assumptionText = (assumption: Pick<Assumption, "statement" | "statement_vi">, locale: Locale = "vi"): string =>
  (locale === "vi" && assumption.statement_vi?.trim()) || assumption.statement;

/** Rủi ro / câu hỏi mở theo ngôn ngữ giao diện (FLF-237) — như `assumptionText`. */
export const otherRequirementText = (item: Pick<OtherRequirement, "statement" | "statement_vi">, locale: Locale = "vi"): string =>
  (locale === "vi" && item.statement_vi?.trim()) || item.statement;

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
  const order = Object.keys(SECTION_KEY);
  const groups = new Map<string, Addendum[]>();
  for (const entry of addendum) {
    const key = sectionKeyOf(entry.target_section) ? entry.target_section : OTHER_SECTION_KEY;
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
