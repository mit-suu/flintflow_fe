"use client";

import { useLocale, useTranslations } from "next-intl";
import Icon from "@/components/ui/Icon";
import type { Locale } from "@/lib/i18n";
import type { StructurePreview as Preview } from "@/types/import";
import { importSectionTitle } from "./section-titles";

/**
 * FLF-455 (business-flow nguyên tắc 4, §3.1.2): các mục ngoài 29148 trên màn đọc khung. Chỉ liệt kê mục mà bản sơ bộ đã biết
 * trước (mẫu đã khớp); mục chỉ lộ ra sau khi đọc nội dung được báo ở thông báo "kết quả cuối khác bản sơ bộ" trong workspace.
 */
export default function OutOfScopeNote({ sections }: { sections: Preview["sections"] }) {
  const t = useTranslations("workspace.import.outOfScope");
  const locale = useLocale() as Locale;
  const items = sections.filter((s) => s.status === "out_of_scope");
  if (!items.length) return null;
  return (
    <section aria-labelledby="out-of-scope-title" className="flex items-start gap-3 rounded-card bg-surface-container px-4 py-3">
      <Icon name="archive" size={16} className="mt-0.5 shrink-0 text-on-surface-muted" />
      <div className="flex flex-col gap-1.5 min-w-0">
        <h3 id="out-of-scope-title" className="text-body font-bold text-on-surface">
          {t("title")}
        </h3>
        <p className="text-body text-on-surface-variant leading-relaxed">{t("hint", { count: items.length })}</p>
        <ul aria-label={t("listLabel")} className="flex flex-wrap gap-2">
          {items.map((s) => (
            <li key={s.section_id} className="rounded-full bg-surface-container-high px-2.5 h-7 inline-flex items-center text-caption font-semibold text-on-surface-muted">
              {importSectionTitle(s.section_id, s.title, locale)}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
