"use client";

import { useTranslations } from "next-intl";
import { DROP_FROM_PRINT_CHOICE, type Migration } from "@/types/template-migration";

/**
 * Nhãn của một lựa chọn trong nhóm thừa / conflict: `keep_custom`, `delete`, `move_to:<mục mới>`, `to:<mục mới>`, `map_by_header`,
 * `keep_old_table`, `ai_resolve`. Lựa chọn lạ (BE thêm sau) ⇒ hiện nguyên mã, không mất thông tin.
 */
const SIMPLE_CHOICES = ["keep_custom", "delete", "map_by_header", "keep_old_table", "ai_resolve"] as const;
type SimpleChoice = (typeof SIMPLE_CHOICES)[number];
const isSimpleChoice = (choice: string): choice is SimpleChoice => (SIMPLE_CHOICES as readonly string[]).includes(choice);

export function useChoiceLabel(migration: Migration): (choice: string) => string {
  const t = useTranslations("mode1.templateMigration.choices");
  const headingOf = (key: string) => migration.to.headings.find((h) => h.key === key)?.heading_text ?? key;
  return (choice) => {
    if (choice === DROP_FROM_PRINT_CHOICE) return t("drop_from_print");
    const sep = choice.indexOf(":");
    if (sep > 0) {
      const kind = choice.slice(0, sep);
      if (kind === "move_to" || kind === "to") return t(kind, { target: headingOf(choice.slice(sep + 1)) });
      return choice;
    }
    return isSimpleChoice(choice) ? t(choice) : choice;
  };
}
