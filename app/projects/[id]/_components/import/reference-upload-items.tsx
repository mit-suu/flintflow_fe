"use client";

import { useTranslations } from "next-intl";
import Button from "@/components/ui/Button";
import Icon from "@/components/ui/Icon";
import DocumentVersionCard from "@/components/project/DocumentVersionCard";
import type { UploadItem } from "@/lib/project-uploads";
import type { DocumentUploadChoice } from "@/types/document";

export interface ReferenceUploadActions {
  onRetry: (key: string) => void;
  /** FLF-398: trả lời file `choosing` (Thay bản cũ / Giữ cả hai / `null` = Bỏ qua). */
  onChoose?: (key: string, choice: DocumentUploadChoice | null) => void;
  /** FLF-398: ẩn dòng báo trùng của một file. */
  onDismiss?: (key: string) => void;
}

/**
 * Các tài liệu tham khảo (tải nền sau khi Tạo dự án) cần người dùng để ý: lỗi ⇒ Thử lại; FLF-398 — có vẻ là bản mới của tài
 * liệu đã có ⇒ thẻ hỏi Thay bản cũ / Giữ cả hai; trùng hệt ⇒ câu báo + Đóng. File đã tải xong / đang tải không hiện.
 */
export default function ReferenceUploadItems({ items, onRetry, onChoose, onDismiss }: { items: UploadItem[] } & ReferenceUploadActions) {
  const t = useTranslations("workspace.import.creating");
  const shown = items.filter((f) => f.status === "failed" || (f.status === "choosing" && f.candidates?.length) || (f.status === "skipped" && f.note));
  if (!shown.length) return null;
  return (
    <ul className="flex flex-col gap-2">
      {shown.map((f) => (
        <li key={f.key}>
          {f.status === "choosing" && f.candidates ? (
            <DocumentVersionCard fileName={f.name} candidates={f.candidates} onChoose={(choice) => onChoose?.(f.key, choice)} busy={!onChoose} />
          ) : f.status === "failed" ? (
            <p className="flex items-center gap-2 text-caption text-on-error-container">
              <Icon name="warning" size={14} />
              <span className="flex-1 min-w-0 truncate">{t("fileFailed", { name: f.name })}</span>
              <Button size="sm" variant="ghost" icon="refresh" onClick={() => onRetry(f.key)}>
                {t("retry")}
              </Button>
            </p>
          ) : (
            <p className="flex items-center gap-2 text-caption text-on-surface-variant">
              <Icon name="info" size={14} />
              <span className="flex-1 min-w-0">{t("fileDuplicate", { name: f.name, message: f.note ?? "" })}</span>
              {onDismiss && (
                <Button size="sm" variant="ghost" onClick={() => onDismiss(f.key)}>
                  {t("dismiss")}
                </Button>
              )}
            </p>
          )}
        </li>
      ))}
    </ul>
  );
}
