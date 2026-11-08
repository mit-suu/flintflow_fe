"use client";

import { useTranslations } from "next-intl";
import Button from "@/components/ui/Button";
import Icon from "@/components/ui/Icon";
import { retryProjectUpload, useProjectUploads } from "@/lib/project-uploads";

/**
 * Tài liệu tham khảo từ hộp Tạo dự án còn đang tải nền (hoặc lỗi) — một dòng gọn trên màn đọc khung / trên ô chat của workspace.
 * Xong hết ⇒ không hiện gì.
 */
export default function ReferenceUploadsNote({ projectId, className = "" }: { projectId: string; className?: string }) {
  const t = useTranslations("workspace.import.creating");
  const uploads = useProjectUploads(projectId);
  const refs = uploads?.items.filter((i) => i.kind === "reference") ?? [];
  const failed = refs.filter((r) => r.status === "failed");
  const done = refs.filter((r) => r.status === "done").length;
  if (!refs.length || (done === refs.length && !failed.length)) return null;
  return (
    <div role="status" aria-live="polite" className={`flex flex-col gap-1 rounded-card bg-surface-container px-3 py-2.5 ${className}`}>
      {done + failed.length < refs.length && (
        <p className="flex items-center gap-2 text-body text-on-surface">
          <Icon name="spinner" size={14} className="text-primary animate-spin" />
          {t("references", { done, total: refs.length })}
        </p>
      )}
      {failed.map((f) => (
        <p key={f.key} className="flex items-center gap-2 text-caption text-on-error-container">
          <Icon name="warning" size={14} />
          <span className="flex-1 min-w-0 truncate">{t("fileFailed", { name: f.name })}</span>
          <Button size="sm" variant="ghost" icon="refresh" onClick={() => retryProjectUpload(projectId, f.key)}>
            {t("retry")}
          </Button>
        </p>
      ))}
    </div>
  );
}
