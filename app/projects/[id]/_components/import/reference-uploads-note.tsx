"use client";

import { useTranslations } from "next-intl";
import Icon from "@/components/ui/Icon";
import { chooseProjectUploadVersion, dismissProjectUpload, retryProjectUpload, useProjectUploads } from "@/lib/project-uploads";
import ReferenceUploadItems from "./reference-upload-items";

/**
 * Tài liệu tham khảo từ hộp Tạo dự án còn đang tải nền (hoặc lỗi) — một dòng gọn trên màn đọc khung / trên ô chat của workspace.
 * Xong hết ⇒ không hiện gì. FLF-398: file có vẻ là bản mới ⇒ thẻ hỏi Thay bản cũ / Giữ cả hai; file trùng hệt ⇒ câu báo đến khi Đóng.
 */
export default function ReferenceUploadsNote({ projectId, className = "" }: { projectId: string; className?: string }) {
  const t = useTranslations("workspace.import.creating");
  const uploads = useProjectUploads(projectId);
  const refs = uploads?.items.filter((i) => i.kind === "reference") ?? [];
  const settled = refs.filter((r) => r.status === "done" || r.status === "skipped").length;
  const pending = refs.filter((r) => r.status === "failed" || r.status === "choosing" || (r.status === "skipped" && r.note));
  if (!refs.length || (settled === refs.length && !pending.length)) return null;
  return (
    <div role="status" aria-live="polite" className={`flex flex-col gap-1 rounded-card bg-surface-container px-3 py-2.5 ${className}`}>
      {refs.some((r) => r.status === "uploading") && (
        <p className="flex items-center gap-2 text-body text-on-surface">
          <Icon name="spinner" size={14} className="text-primary animate-spin" />
          {t("references", { done: settled, total: refs.length })}
        </p>
      )}
      <ReferenceUploadItems
        items={refs}
        onRetry={(key) => retryProjectUpload(projectId, key)}
        onChoose={(key, choice) => chooseProjectUploadVersion(projectId, key, choice)}
        onDismiss={(key) => dismissProjectUpload(projectId, key)}
      />
    </div>
  );
}
