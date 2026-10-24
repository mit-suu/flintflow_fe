import type { ChangeSummary } from "@/types/pipeline";
import { FORM_FACTOR_LABEL, STAKES_LABEL } from "./brief-labels";

/** Quyết định của user về một giả định AI vừa đặt ra — dùng ở panel Cờ / rà giả định, không còn ở cổng chốt. */
export type AssumptionDecision =
  | { kind: "confirm"; id: string }
  | { kind: "reject"; id: string }
  | { kind: "edit"; id: string; statement: string }
  /** Giả định về một trường có tập giá trị cố định (nền tảng, mức độ quan trọng): chọn giá trị, không gõ, không gọi AI. */
  | { kind: "pick"; id: string; path: PickablePath; value: string; label: string };

/**
 * Trường `project` sửa bằng chọn giá trị — nhãn tiếng Việt dùng chung với Brief panel; `titleEn` dựng câu giả định
 * tiếng Anh (bản vào SRS).
 */
export const PICKABLE_FIELDS = {
  "project.form_factor": { title: "Nền tảng", titleEn: "Platform", labels: FORM_FACTOR_LABEL },
  "project.stakes": { title: "Mức độ quan trọng", titleEn: "Stakes", labels: STAKES_LABEL },
} as const;

export type PickablePath = keyof typeof PICKABLE_FIELDS;

export interface BlockingFlag {
  id: string;
  message: string;
  remediation_step?: string;
}

/**
 * Translator của namespace `workspace.gateHelpers` dạng lỏng: helper tra key động (`collection.<tên>`, `field.<tên>`)
 * nên không dùng được kiểu key chặt của next-intl. Có `has` để collection / field lạ (BE thêm sau) lùi về tên gốc.
 */
export interface GateHelpersT {
  (key: string, values?: Record<string, string | number>): string;
  has(key: string): boolean;
}

const KIND_PREFIX: Record<ChangeSummary["kind"], string> = { add: "+", update: "~", remove: "−" };

const collectionLabel = (collection: string, t: GateHelpersT): string =>
  t.has(`collection.${collection}`) ? t(`collection.${collection}`) : collection;

/** Gom tóm tắt theo (loại thay đổi × collection) để hiện "+3 use case: A, B, C". */
export const groupSummary = (
  summary: readonly ChangeSummary[],
  t: GateHelpersT
): { key: string; label: string; items: ChangeSummary[] }[] => {
  const groups = new Map<string, ChangeSummary[]>();
  for (const row of summary) {
    const key = `${row.kind}|${row.collection}`;
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  return [...groups.entries()].map(([key, items]) => {
    const [kind, collection] = key.split("|") as [ChangeSummary["kind"], string];
    return { key, label: t("groupLabel", { prefix: KIND_PREFIX[kind], count: items.length, collection: collectionLabel(collection, t) }), items };
  });
};

/**
 * Field lẻ của `project`: BE ghi tiêu đề dạng "<field>: <giá trị>".
 * `"complexity: small"` ⇒ `"Độ phức tạp: Nhỏ"` / `"Complexity: Small"`; tiêu đề khác giữ nguyên.
 *
 * `t` (namespace `workspace.gateHelpers`) dịch theo ngôn ngữ giao diện.
 */
export const projectFieldText = (title: string, t: GateHelpersT): string => {
  const match = /^([a-z_]+):\s*(.*)$/.exec(title.trim());
  if (!match) return title;
  const [, field, rawValue] = match;
  const value = rawValue.trim();
  if (!t.has(`field.${field}`)) return title;
  return t("fieldText", { label: t(`field.${field}`), value: t.has(`value.${value}`) ? t(`value.${value}`) : rawValue });
};

/** Nối các mục tóm tắt: bỏ dấu câu cuối mỗi mục rồi nối bằng "; " — không còn "nhà nước., Từ…". */
export const joinSummaryTexts = (texts: readonly string[]): string =>
  texts
    .map((text) => text.trim().replace(/[\s.,;:]+$/u, ""))
    .filter((text) => text !== "")
    .join("; ");

/** Chữ cái riêng của tiếng Việt — lý do "không đổi gì" BE viết sẵn bằng đúng một trong hai ngôn ngữ (FLF-260). */
const VIETNAMESE_LETTER = /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i;
/**
 * Câu bọc lý do "không đổi gì" khi lý do KHÁC ngôn ngữ giao diện: lý do đi theo ngôn ngữ AI trả lời trong phiên (FLF-260),
 * câu bọc theo cùng ngôn ngữ đó để không ra câu nửa Việt nửa Anh. Cùng ngôn ngữ thì dùng `fallbackNoChange` của messages.
 */
const NO_CHANGE_IN_REASON_LANGUAGE: Record<"vi" | "en", (reason: string) => string> = {
  vi: (reason) => `Bước này không thay đổi tài liệu: ${reason}. Bạn xem giúp, ổn thì mình đi tiếp nhé.`,
  en: (reason) => `This step doesn't change the document: ${reason}. Take a look — if it looks right, let's move on.`,
};
/** Số nhóm / số mục mỗi nhóm nêu tên trong câu tạm — dài hơn thì user đọc tài liệu. */
const FALLBACK_MAX_GROUPS = 4;
const FALLBACK_MAX_ITEMS = 3;

/**
 * Câu thay cho `message_vi` khi BE chưa gửi (dự án cũ): dựng từ tóm tắt thay đổi thành một câu đọc được. Giả định không
 * kể lần hai — chúng đã được xác nhận cùng lúc user bấm đi tiếp. `locale` là ngôn ngữ giao diện (ngôn ngữ của `t`).
 */
export const fallbackGateMessage = (
  summary: readonly ChangeSummary[],
  noChangeReason: string | undefined,
  t: GateHelpersT,
  locale: string = "vi"
): string => {
  const shown = summary.filter((row) => row.collection !== "assumptions");
  if (shown.length === 0) {
    const reason = noChangeReason?.trim().replace(/[\s.]+$/u, "");
    if (!reason) return t("fallbackDone");
    const reasonLocale = VIETNAMESE_LETTER.test(reason) ? "vi" : "en";
    return reasonLocale === locale ? t("fallbackNoChange", { reason }) : NO_CHANGE_IN_REASON_LANGUAGE[reasonLocale](reason);
  }
  const groups = new Map<string, ChangeSummary[]>();
  for (const row of shown) {
    const key = `${row.kind}|${row.collection}`;
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  const parts = [...groups.entries()].slice(0, FALLBACK_MAX_GROUPS).map(([key, items]) => {
    const [kind, collection] = key.split("|") as [ChangeSummary["kind"], string];
    const titles = joinSummaryTexts(
      items.slice(0, FALLBACK_MAX_ITEMS).map((item) => (item.collection === "project" ? projectFieldText(item.title_vi, t) : item.title_vi))
    );
    const more = items.length > FALLBACK_MAX_ITEMS ? "; …" : "";
    const values = { verb: t(`verb.${kind}`), count: items.length, collection: collectionLabel(collection, t) };
    return titles ? t("fallbackPartTitles", { ...values, titles: `${titles}${more}` }) : t("fallbackPart", values);
  });
  const rest = groups.size > FALLBACK_MAX_GROUPS ? t("fallbackRest") : "";
  return t("fallbackUpdated", { parts: parts.join(", "), rest });
};
