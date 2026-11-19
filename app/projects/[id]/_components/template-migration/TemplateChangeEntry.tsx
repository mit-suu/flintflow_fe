"use client";

import { useTranslations } from "next-intl";
import Button from "@/components/ui/Button";
import type { Flag } from "@/types/spine";
import { migrationMissingLabel, openMigrationMissing } from "./missing-flags";
import MissingSectionsCard from "./MissingSectionsCard";
import RevertMigrationButton from "./RevertMigrationButton";
import type { TemplateChangeAvailability } from "./useTemplateChangeAvailability";

interface TemplateChangeEntryProps {
  projectId: string;
  /** Kết quả `useTemplateChangeAvailability` (nơi gọi dùng chung với mục "Đổi mẫu" ở menu ⋯ của header). */
  availability: TemplateChangeAvailability;
  flags: readonly Flag[];
  /** Tên mục dễ đọc theo `section_id` (cùng nguồn với panel cờ). */
  sectionName: (sectionId: string) => string;
  /** Hoàn tác / khôi phục xong: tài liệu, cờ, project cần đọc lại. */
  onChanged?: () => void;
}

/**
 * Thẻ trạng thái đổi mẫu trong panel. Lối vào "Đổi mẫu" nằm ở menu ⋯ của header (dùng hiếm, không chiếm panel); thẻ chỉ hiện
 * khi có việc cần làm: lần đổi mẫu kẹt (Khôi phục), bản vừa áp dụng còn hoàn tác được, mục thiếu sau đổi mẫu, lỗi tải.
 * Viewer không thấy (BE chặn 403).
 */
export default function TemplateChangeEntry({ projectId, availability, flags, sectionName, onChanged }: TemplateChangeEntryProps) {
  const t = useTranslations("mode1.templateMigration.entry");
  const { allowed, migration: m } = availability;
  if (!allowed) return null;

  const failed = m.open?.state === "apply_failed";
  const canRevert = !!m.latestApplied && !m.open;
  const missing = openMigrationMissing(flags);
  if (!failed && !canRevert && missing.length === 0 && !m.error) return null;

  const restore = async () => {
    if (await m.restore()) onChanged?.();
  };

  const revert = async () => {
    if (await m.revert()) onChanged?.();
  };

  return (
    <section aria-label={t("aria")} className="flex flex-col gap-3 rounded-card bg-surface-container-lowest p-4">
      <h4 className="text-caption font-bold uppercase tracking-wide text-on-surface-muted">{t("title")}</h4>
      {canRevert && m.latestApplied && (
        <div className="flex flex-wrap items-center gap-2">
          <RevertMigrationButton busy={m.busy === "revert"} blocked={m.revertBlocked} revertable={m.latestApplied.revertable} reason={m.latestApplied.revert_blocked_reason} onRevert={() => void revert()} />
        </div>
      )}
      {failed && (
        <div role="alert" className="rounded-card bg-error-container p-3 flex flex-col items-start gap-2 text-body text-on-error-container">
          <p>{t("applyFailed")}</p>
          <Button size="sm" loading={m.busy === "restore"} disabled={m.busy !== null} onClick={() => void restore()}>
            {t("restore")}
          </Button>
        </div>
      )}
      {m.error && (
        <p role="alert" className="text-caption text-error">
          {m.error}
        </p>
      )}
      <MissingSectionsCard
        projectId={projectId}
        canWrite
        items={missing.map((f) => ({ id: f.id, label: migrationMissingLabel(f) ?? sectionName(f.section_id), sectionId: f.section_id }))}
      />
    </section>
  );
}
