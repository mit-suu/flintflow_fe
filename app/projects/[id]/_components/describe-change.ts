/**
 * Đổi một thay đổi thô của Spine (`set actors[id=A03].name`) thành câu người đọc được
 * ("Sửa Actor A03 · name: Admin → Administrator"). Dùng cho thẻ sửa trong chat và "Lịch sử sửa".
 */
import { createTranslator } from "next-intl";
import { DEFAULT_LOCALE, type Locale } from "@/lib/i18n";
import en from "@/messages/en.json";
import vi from "@/messages/vi.json";
import type { Mode1T } from "./mode1/i18n";
import { spineLabels } from "./mode1/spine-labels";

const MESSAGES = { vi, en } as const;
const translatorFor = (locale: Locale) => createTranslator({ locale, messages: MESSAGES[locale], namespace: "workspace.describeChange" });
/** Tên trường / giá trị đời thường dùng chung với mode 1 (`mode1.spine.*`). */
const spineFor = (locale: Locale) =>
  spineLabels(createTranslator({ locale, messages: MESSAGES[locale], namespace: "mode1" }) as unknown as Mode1T, locale);

interface ChangeLike {
  op: string;
  path: string;
  before: unknown;
  value: unknown;
}

const COLLECTIONS = new Set([
  "project", "actors", "use_cases", "features", "screens", "functions", "entities", "nfrs",
  "business_rules", "messages", "glossary", "permissions", "assumptions", "decisions",
] as const);
type KnownCollection = typeof COLLECTIONS extends Set<infer K> ? K : never;
const OPS = new Set(["set", "add", "remove", "renumber"] as const);
type KnownOp = typeof OPS extends Set<infer K> ? K : never;

/** Rút gọn giá trị để hiện trên một dòng. */
export const shortValue = (value: unknown, max = 60, locale: Locale = DEFAULT_LOCALE): string => {
  if (value === null || value === undefined) return "—";
  // Không JSON: object/mảng thành "Tên: …; Mô tả: …" (FLF-247)
  const text = spineFor(locale).readableValue(value);
  return text.length > max ? `${text.slice(0, max)}…` : text;
};

/** Đầu câu: "Sửa Actor A03 · name". */
export const describeTarget = (change: ChangeLike, locale: Locale = DEFAULT_LOCALE): string => {
  const t = translatorFor(locale);
  const spine = spineFor(locale);
  const [root, ...rest] = change.path.split(".");
  const collection = root.replace(/\[.*$/, "");
  const key = /\[(?:[a-z_]+=)?([^\],]+)/.exec(root)?.[1];
  const label = COLLECTIONS.has(collection as KnownCollection) ? t(`collections.${collection as KnownCollection}`) : collection;
  // Tên trường đời thường (`actor_ids` ⇒ "Tác nhân"); khoá trong ngoặc giữ lại (`flows[id=F1]` ⇒ "… F1")
  const field = rest
    .map((part) => part.replace(/^[a-z_]+/, (name) => spine.fieldLabel(name)).replace(/\[(?:[a-z_]+=)?([^\]]+)\]/g, " $1"))
    .join(" › ");
  const verb = t(`ops.${OPS.has(change.op as KnownOp) ? (change.op as KnownOp) : "set"}`);
  return [`${verb} ${label}${key ? ` ${key}` : ""}`, field].filter(Boolean).join(" · ");
};

/** Câu đầy đủ kèm giá trị trước → sau. */
export const describeChange = (change: ChangeLike, locale: Locale = DEFAULT_LOCALE): string => {
  const target = describeTarget(change, locale);
  if (change.op === "add") return `${target}: ${shortValue(change.value, 60, locale)}`;
  if (change.op === "remove") return target;
  return `${target}: ${shortValue(change.before, 60, locale)} → ${shortValue(change.value, 60, locale)}`;
};
