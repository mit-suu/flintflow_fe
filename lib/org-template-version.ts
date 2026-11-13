import type { OrgTemplateSummary } from "@/types/org-library";

/** Tên file + số heading của bản đang chọn (không phải của bản mới nhất); bản không có trong danh sách ⇒ số liệu mức mẫu. */
export const versionFacts = (tpl: OrgTemplateSummary, version: number): { file: string; headings: number } => {
  const v = tpl.versions.find((x) => x.version === version);
  return { file: v?.source_file_name ?? tpl.source_file_name, headings: v?.heading_count ?? tpl.heading_count };
};
