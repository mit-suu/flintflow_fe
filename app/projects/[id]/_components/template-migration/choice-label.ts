"use client";

import { useTranslations } from "next-intl";
import { DROP_FROM_PRINT_CHOICE, type Migration } from "@/types/template-migration";

/**
 * Nhãn của một lựa chọn trong nhóm thừa / conflict: `keep_custom`, `delete`, `move_to:<mục mới>`, `to:<mục mới>`, `map_by_header`,
 * `keep_old_table`, `ai_resolve`, `keep_pair`, `distribute`. Lựa chọn lạ (BE thêm sau) ⇒ hiện nguyên mã, không mất thông tin.
 */
const SIMPLE_CHOICES = ["keep_custom", "delete", "map_by_header", "keep_old_table", "ai_resolve", "keep_pair", "distribute"] as const;
type SimpleChoice = (typeof SIMPLE_CHOICES)[number];
const isSimpleChoice = (choice: string): choice is SimpleChoice => (SIMPLE_CHOICES as readonly string[]).includes(choice);

/**
 * Mục của mẫu mới làm đích "chuyển vào": `empty` = mục trống, `filled` = mục đã có nội dung (phần chuyển vào nối sau nội dung đang
 * có), `group` = heading nhóm có mục con (phần chuyển vào thành mục con cuối của nhóm).
 */
export type MoveTargetKind = "empty" | "filled" | "group";

export function moveTargetKindOf(migration: Migration): (key: string) => MoveTargetKind {
  const headings = migration.to.headings;
  // Heading nhóm: heading ngay sau sâu hơn (cùng quy tắc BE). Thiếu `level` ⇒ không suy được, coi như mục thường
  const groups = new Set(headings.filter((h, i) => h.level !== undefined && headings[i + 1]?.level !== undefined && headings[i + 1].level! > h.level).map((h) => h.key));
  const filled = new Set<string>();
  for (const p of migration.pairing.pairs) if (p.new_key) filled.add(p.new_key);
  for (const s of migration.pairing.split) for (const k of s.new_keys) filled.add(k);
  for (const m of migration.groups.missing) if (m.filled_from_spine) filled.add(m.new_key);
  return (key) => (groups.has(key) ? "group" : filled.has(key) ? "filled" : "empty");
}

/** Khoá chuỗi (nhãn lựa chọn và câu hậu quả dùng chung tên khoá) của "chuyển vào" theo loại mục đích. */
export const MOVE_KEY: Record<MoveTargetKind, "move_to" | "move_to_filled" | "move_to_group"> = { empty: "move_to", filled: "move_to_filled", group: "move_to_group" };

export function useChoiceLabel(migration: Migration): (choice: string) => string {
  const t = useTranslations("mode1.templateMigration.choices");
  const headingOf = (key: string) => migration.to.headings.find((h) => h.key === key)?.heading_text ?? key;
  const kindOf = moveTargetKindOf(migration);
  return (choice) => {
    if (choice === DROP_FROM_PRINT_CHOICE) return t("drop_from_print");
    const sep = choice.indexOf(":");
    if (sep > 0) {
      const kind = choice.slice(0, sep);
      const key = choice.slice(sep + 1);
      if (kind === "move_to") return t(MOVE_KEY[kindOf(key)], { target: headingOf(key) });
      if (kind === "to") return t(kind, { target: headingOf(key) });
      return choice;
    }
    return isSimpleChoice(choice) ? t(choice) : choice;
  };
}
