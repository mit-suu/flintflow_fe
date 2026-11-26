"use client";

import { useTranslations } from "next-intl";
import Icon from "@/components/ui/Icon";
import type { TranslationSummary } from "@/types/template-migration";

interface UntranslatedNoticeProps {
  summary: TranslationSummary | null | undefined;
}

/** Sau khi áp dụng có dịch: một số đoạn không dịch được dù đã thử lại, tài liệu giữ chữ gốc ở đó. Chỉ nêu tên mục. */
export default function UntranslatedNotice({ summary }: UntranslatedNoticeProps) {
  const t = useTranslations("mode1.templateMigration");
  if (!summary || summary.untranslated <= 0) return null;
  const titles = summary.sections.map((s) => s.title).join(", ");
  return (
    <p role="status" className="rounded-card bg-accent-gold-soft p-3 text-body text-accent-gold-text flex items-start gap-2">
      <Icon name="warning" size={16} className="mt-0.5 shrink-0" />
      <span>{t("untranslatedNote", { count: summary.untranslated, sections: titles === "" ? "none" : titles })}</span>
    </p>
  );
}
