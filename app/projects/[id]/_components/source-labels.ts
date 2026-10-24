/**
 * Nhãn cho tab "Nguồn" (FLF-292): path phần tử Spine ⇒ loại + tên người đọc được; mã đoạn ⇒ "đoạn 3".
 */
import type { Spine } from "@/types/spine";

/** Thứ tự nhóm trong tab — yêu cầu chính trước. Nhãn: `workspace.sources.kind.<kind>`. */
export const SOURCE_KIND_ORDER = [
  "use_cases",
  "functions",
  "nfrs",
  "business_rules",
  "actors",
  "roles",
  "features",
  "screens",
  "entities",
  "common_requirements",
  "messages",
  "other_requirements",
  "glossary",
  "addendum",
  "project",
] as const;

type SourceKind = (typeof SOURCE_KIND_ORDER)[number];

/** Field của `project` có nhãn: `workspace.sources.field.<field>`. */
const PROJECT_FIELDS = ["vision", "goals", "release_scope", "system_name", "name"] as const;
type ProjectField = (typeof PROJECT_FIELDS)[number];

/** Translator của `workspace.sources` — truyền thẳng `useTranslations("workspace.sources")`. */
export type SourceLabelsTranslator = (key: `kind.${SourceKind}` | `field.${ProjectField}` | "paragraph", values?: { n: number }) => string;

const isOneOf = <K extends string>(keys: readonly K[], value: string): value is K => (keys as readonly string[]).includes(value);

/** Field mang chữ người đọc được của từng loại phần tử. */
const TEXT_FIELDS = ["name", "statement", "text", "term", "topic"] as const;

export interface SourceEntityLabel {
  kind: string;
  kindLabel: string;
  /** `UC03`, `N03`, … — rỗng với field của project. */
  id: string;
  title: string;
}

export function sourceEntityLabel(spine: Spine, path: string, t: SourceLabelsTranslator): SourceEntityLabel {
  const item = /^([a-z_]+)\[id=(.+)\]$/.exec(path);
  if (item) {
    const [, kind, id] = item;
    const list = (spine as unknown as Record<string, Array<Record<string, unknown>> | undefined>)[kind] ?? [];
    const el = list.find((e) => e.id === id);
    const title = el ? TEXT_FIELDS.map((f) => el[f]).find((v): v is string => typeof v === "string" && v.trim() !== "") ?? "" : "";
    return { kind, kindLabel: isOneOf(SOURCE_KIND_ORDER, kind) ? t(`kind.${kind}`) : kind, id, title };
  }
  const field = /^project\.([a-z_]+)$/.exec(path)?.[1] ?? path;
  return { kind: "project", kindLabel: t("kind.project"), id: "", title: isOneOf(PROJECT_FIELDS, field) ? t(`field.${field}`) : field };
}

/** `D1-P03` ⇒ `đoạn 3` / `paragraph 3`; sai khuôn ⇒ nguyên mã. */
export function paragraphLabel(paraId: string, t: SourceLabelsTranslator): string {
  const m = /^D\d+-P(\d+)$/.exec(paraId);
  return m ? t("paragraph", { n: Number(m[1]) }) : paraId;
}
