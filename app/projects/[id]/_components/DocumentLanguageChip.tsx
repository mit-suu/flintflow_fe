"use client";

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
  const name = DOCUMENT_LANGUAGE_NAME[language];
  return (
    <span title={`Ngôn ngữ tài liệu: ${name}`} className="shrink-0 inline-flex">
      <Badge tone="neutral">
        <Icon name="translate" size={12} />
        {compact ? (
          <span aria-label={name} lang={language}>
            {language.toUpperCase()}
          </span>
        ) : (
          <span lang={language}>{name}</span>
        )}
      </Badge>
    </span>
  );
}
