import type { IconName } from "@/components/ui/Icon";

/**
 * Ô "kho" của màn đọc khung (business-flow §3.1.2): nhóm nội dung FlintFlow nắm sau khi đọc file. Mỗi mục của file (mã mục do
 * BE trả trong `structure_preview.sections[].section_id`) chảy vào đúng một ô; mục riêng của file vào khay giữ nguyên văn.
 * Chỉ để hiển thị — trạng thái thật của mục vẫn do BE tính.
 */
export const SECTION_BINS = [
  { key: "overview", icon: "book" },
  { key: "actors", icon: "users" },
  { key: "usecases", icon: "layers" },
  { key: "screens", icon: "sidebar" },
  { key: "permissions", icon: "shield-check" },
  { key: "functions", icon: "toolbox" },
  { key: "entities", icon: "building" },
  { key: "nfr", icon: "clock" },
  { key: "rules", icon: "check-circle" },
  { key: "messages", icon: "mail" },
  { key: "common", icon: "translate" },
  { key: "verbatim", icon: "archive" },
] as const satisfies readonly { key: string; icon: IconName }[];

export type SectionBinKey = (typeof SECTION_BINS)[number]["key"];

const SLOT_BINS: Record<string, SectionBinKey> = {
  business_rules: "rules",
  high_rules: "rules",
  messages: "messages",
  features: "functions",
  functional_requirements: "functions",
  security: "nfr",
};

/** Hàm thuần: ô kho của một mục theo mã mục (`fixed:2.1`, `feature:F01`, `function:FR-3.2.1`, `slot:messages`, `custom:CS01`). */
export const binOfSection = (sectionId: string): SectionBinKey => {
  if (sectionId.startsWith("custom:")) return "verbatim";
  if (sectionId.startsWith("feature:") || sectionId.startsWith("function:")) return "functions";
  if (sectionId.startsWith("slot:")) return SLOT_BINS[sectionId.slice(5)] ?? "overview";
  const num = sectionId.startsWith("fixed:") ? sectionId.slice(6) : sectionId;
  if (num === "1" || num.startsWith("1.")) return "overview";
  if (num === "2.1") return "actors";
  if (num.startsWith("2.2")) return "usecases";
  if (num === "3.1.1" || num === "3.1.2") return "screens";
  if (num === "3.1.3") return "permissions";
  if (num === "3.1.4") return "functions";
  if (num === "3.1.5") return "entities";
  if (num === "4" || num.startsWith("4.")) return "nfr";
  if (num === "5.1") return "rules";
  if (num === "5.3") return "messages";
  if (num.startsWith("5.")) return "common";
  return "overview";
};
