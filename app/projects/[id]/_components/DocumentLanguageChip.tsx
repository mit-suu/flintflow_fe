"use client";

import { useTranslations } from "next-intl";
import Badge from "@/components/ui/Badge";
import Icon from "@/components/ui/Icon";
import { DOCUMENT_LANGUAGE_NAME } from "@/lib/document-language";
import type { DocumentLanguage } from "@/types/project";

/**
 * Chip ngôn ngữ tài liệu (FLF-265) — chỉ đọc: header tài liệu ở workspace và trang xem chỉ đọc. Đổi ngôn ngữ ở menu dự
 * án (hoặc lệnh trong chat), không ở đây. Tên ngôn ngữ mang `lang` của chính nó để trình đọc màn hình đọc đúng giọng
 * ("English" giữa giao diện tiếng Việt).
 *
 * `compact`: chỉ mã ngôn ngữ ("VI" / "EN"), tên đầy đủ ở tooltip + nhãn trợ năng — header pane tài liệu hẹp (tối thiểu
 * 320px) đã chật với nút vấn đề + "Làm mới", tên đầy đủ đẩy nút ra ngoài mép.
 */
export default function DocumentLanguageChip({ language, compact = false }: { language: DocumentLanguage; compact?: boolean }) {
  const t = useTranslations("workspace.languageChip");
  const tLanguage = useTranslations("common.documentLanguage");
  const name = tLanguage(language);
  // `lang` chỉ khi tên viết bằng chính ngôn ngữ đó ("Tiếng Việt" giữa giao diện tiếng Việt, "English" ở mọi nơi)
  const lang = name === DOCUMENT_LANGUAGE_NAME[language] ? language : undefined;
  return (
    <span title={t("title", { name })} className="shrink-0 inline-flex">
      <Badge tone="neutral">
        <Icon name="translate" size={12} />
        {compact ? (
          <span aria-label={name} lang={lang}>
            {language.toUpperCase()}
          </span>
        ) : (
          <span lang={lang}>{name}</span>
        )}
      </Badge>
    </span>
  );
}
