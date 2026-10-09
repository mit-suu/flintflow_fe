"use client";

import Badge from "@/components/ui/Badge";
import Icon from "@/components/ui/Icon";
import { DOCUMENT_LANGUAGE_NAME } from "@/lib/document-language";
import type { DocumentLanguage } from "@/types/project";

/**
 * Chip ngôn ngữ tài liệu (FLF-265) — chỉ đọc: header tài liệu ở workspace và trang xem chỉ đọc. Đổi ngôn ngữ ở menu dự
 * án (hoặc lệnh trong chat), không ở đây. Tên ngôn ngữ mang `lang` của chính nó để trình đọc màn hình đọc đúng giọng
 * ("English" giữa giao diện tiếng Việt).
 */
export default function DocumentLanguageChip({ language }: { language: DocumentLanguage }) {
  return (
    <span title="Ngôn ngữ tài liệu" className="shrink-0 inline-flex">
      <Badge tone="neutral">
        <Icon name="translate" size={12} />
        <span lang={language}>{DOCUMENT_LANGUAGE_NAME[language]}</span>
      </Badge>
    </span>
  );
}
