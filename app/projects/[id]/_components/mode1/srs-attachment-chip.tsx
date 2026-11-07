"use client";

import { useTranslations } from "next-intl";
import Button from "@/components/ui/Button";
import Icon from "@/components/ui/Icon";

export interface SrsAttachmentSuggestion {
  key: string;
  file: File;
  /** File mang dấu version của chính dự án này (tải về từ FlintFlow rồi sửa) ⇒ gần như chắc là bản mới. */
  fromThisProject: boolean;
}

interface SrsAttachmentChipProps {
  suggestion: SrsAttachmentSuggestion;
  onUpdateVersion: () => void;
  onKeepAsReference: () => void;
}

/**
 * Business-flow §3.6: file đính kèm trong chat trông như SRS ⇒ hỏi "Đây là phiên bản mới của tài liệu?" — không chặn: file đã
 * vào kho tài liệu tham khảo. Có dấu version của dự án ⇒ chọn sẵn "Cập nhật phiên bản mới"; không ⇒ chọn sẵn "Dùng làm tham khảo".
 */
export default function SrsAttachmentChip({ suggestion, onUpdateVersion, onKeepAsReference }: SrsAttachmentChipProps) {
  const t = useTranslations("workspace.srsAttachment");
  const preferUpdate = suggestion.fromThisProject;
  return (
    <div role="status" className="mx-3 mb-2 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-card bg-surface-container px-3 py-2.5">
      <Icon name="sparkle" size={16} className="shrink-0 text-primary" />
      <p className="flex-1 min-w-[200px] text-body text-on-surface">
        {t("question", { name: suggestion.file.name })}
        {preferUpdate && <span className="block text-caption text-on-surface-muted">{t("stampHint")}</span>}
      </p>
      <span className="flex items-center gap-1.5">
        <Button size="sm" variant={preferUpdate ? "primary" : "ghost"} onClick={onUpdateVersion}>
          {t("update")}
        </Button>
        <Button size="sm" variant={preferUpdate ? "ghost" : "primary"} onClick={onKeepAsReference}>
          {t("keep")}
        </Button>
      </span>
    </div>
  );
}
