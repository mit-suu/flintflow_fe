/**
 * Nhãn cho tab "Nguồn" (FLF-292): path phần tử Spine ⇒ loại + tên người đọc được; mã đoạn ⇒ "đoạn 3".
 */
import type { Spine } from "@/types/spine";

const KIND_LABEL: Record<string, string> = {
  use_cases: "Use case",
  functions: "Chức năng",
  nfrs: "Yêu cầu phi chức năng",
  business_rules: "Quy tắc nghiệp vụ",
  actors: "Tác nhân",
  roles: "Vai trò",
  features: "Tính năng",
  screens: "Màn hình",
  entities: "Thực thể dữ liệu",
  common_requirements: "Yêu cầu chung",
  messages: "Thông báo",
  other_requirements: "Yêu cầu khác",
  glossary: "Thuật ngữ",
  addendum: "Ghi chú Brief",
  project: "Thông tin dự án",
};

/** Thứ tự nhóm trong tab — yêu cầu chính trước. */
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
];

const PROJECT_FIELD_LABEL: Record<string, string> = {
  vision: "Tầm nhìn",
  goals: "Mục tiêu",
  release_scope: "Phạm vi bản 1.0",
  system_name: "Tên hệ thống",
  name: "Tên dự án",
};

/** Field mang chữ người đọc được của từng loại phần tử. */
const TEXT_FIELDS = ["name", "statement", "text", "term", "topic"] as const;

export interface SourceEntityLabel {
  kind: string;
  kindLabel: string;
  /** `UC03`, `N03`, … — rỗng với field của project. */
  id: string;
  title: string;
}

export function sourceEntityLabel(spine: Spine, path: string): SourceEntityLabel {
  const item = /^([a-z_]+)\[id=(.+)\]$/.exec(path);
  if (item) {
    const [, kind, id] = item;
    const list = (spine as unknown as Record<string, Array<Record<string, unknown>> | undefined>)[kind] ?? [];
    const el = list.find((e) => e.id === id);
    const title = el ? TEXT_FIELDS.map((f) => el[f]).find((v): v is string => typeof v === "string" && v.trim() !== "") ?? "" : "";
    return { kind, kindLabel: KIND_LABEL[kind] ?? kind, id, title };
  }
  const field = /^project\.([a-z_]+)$/.exec(path)?.[1] ?? path;
  return { kind: "project", kindLabel: KIND_LABEL.project, id: "", title: PROJECT_FIELD_LABEL[field] ?? field };
}

/** `D1-P03` ⇒ `đoạn 3`; sai khuôn ⇒ nguyên mã. */
export function paragraphLabel(paraId: string): string {
  const m = /^D\d+-P(\d+)$/.exec(paraId);
  return m ? `đoạn ${Number(m[1])}` : paraId;
}
