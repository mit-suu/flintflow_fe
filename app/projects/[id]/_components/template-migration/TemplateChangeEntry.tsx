"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import Button from "@/components/ui/Button";
import { listBaselines } from "@/lib/api/export";
import { getReviewPackage } from "@/lib/api/versions";
import type { Flag } from "@/types/spine";
import type { OrgRole } from "@/types/organization";
import { useTemplateMigration } from "../../hooks/useTemplateMigration";
import { templateMigrationHref } from "./href";
import { openMigrationMissing } from "./missing-flags";
import MissingSectionsCard from "./MissingSectionsCard";
import RevertMigrationButton from "./RevertMigrationButton";

interface TemplateChangeEntryProps {
  projectId: string;
  orgRole: OrgRole | null;
  flags: readonly Flag[];
  /** Tên mục dễ đọc theo `section_id` (cùng nguồn với panel cờ). */
  sectionName: (sectionId: string) => string;
  /** Đổi giá trị ⇒ đọc lại điều kiện (gói duyệt, baseline, lần đổi mẫu). */
  refreshToken?: number;
  /** Hoàn tác xong: tài liệu, cờ, project cần đọc lại. */
  onChanged?: () => void;
}

/**
 * Lối vào "Đổi mẫu" trong panel công cụ của workspace. Disable kèm lý do: chưa có baseline, bản nháp đang chờ Lead duyệt, lần đổi mẫu
 * đang áp dụng. Đang có lần đổi mẫu mở ⇒ nút thành "Tiếp tục đổi mẫu". Sau khi áp dụng: hoàn tác (khi còn được) + mục thiếu có nút viết.
 * Viewer không thấy (BE chặn 403).
 */
export default function TemplateChangeEntry({ projectId, orgRole, flags, sectionName, refreshToken = 0, onChanged }: TemplateChangeEntryProps) {
  const t = useTranslations("mode1.templateMigration.entry");
  const allowed = orgRole === "lead" || orgRole === "analyst";
  const m = useTemplateMigration(projectId, { enabled: allowed, fallbackError: t("loadFailed") });
  const [hasBaseline, setHasBaseline] = useState<boolean | null>(null);
  const [draftLocked, setDraftLocked] = useState(false);
  const { reload } = m;

  useEffect(() => {
    if (!allowed) return;
    let cancelled = false;
    void Promise.all([listBaselines(projectId).then((r) => (r.data ?? []).length > 0), getReviewPackage(projectId).then((r) => r.data?.status === "pending")])
      .then(([baseline, locked]) => {
        if (cancelled) return;
        setHasBaseline(baseline);
        setDraftLocked(locked);
      })
      // Không đọc được điều kiện ⇒ không tự chặn: BE kiểm lại và trả đúng mã lỗi khi bắt đầu
      .catch(() => !cancelled && setHasBaseline(true));
    return () => {
      cancelled = true;
    };
  }, [projectId, refreshToken, allowed]);

  // Hook đã tải lần đầu; chỉ đọc lại khi token đổi sau đó
  const lastToken = useRef(refreshToken);
  useEffect(() => {
    if (lastToken.current === refreshToken) return;
    lastToken.current = refreshToken;
    void reload();
  }, [refreshToken, reload]);

  if (!allowed) return null;

  const running = m.open?.state === "applying" || m.open?.state === "reverting";
  const failed = m.open?.state === "apply_failed";
  const reason = hasBaseline === false ? t("noBaseline") : draftLocked ? t("draftLocked") : running ? t("applying") : null;
  const missing = openMigrationMissing(flags);

  const restore = async () => {
    if (await m.restore()) onChanged?.();
  };

  const revert = async () => {
    if (await m.revert()) onChanged?.();
  };

  return (
    <section aria-label={t("aria")} className="flex flex-col gap-2.5">
      <h4 className="text-body font-extrabold text-on-surface">{t("title")}</h4>
      <p className="text-caption text-on-surface-muted leading-relaxed">{m.open ? t("openHelp") : t("help")}</p>
      <div className="flex flex-wrap items-center gap-2">
        {reason ? (
          <Button size="sm" variant="secondary" disabled title={reason}>
            {m.open ? t("resume") : t("change")}
          </Button>
        ) : (
          <Link
            href={templateMigrationHref(projectId)}
            scroll={false}
            className="h-8 px-3.5 inline-flex items-center rounded-control bg-primary text-on-primary hover:bg-primary-hover text-body font-bold"
          >
            {m.open ? t("resume") : t("change")}
          </Link>
        )}
        {m.latestApplied && !m.open && <RevertMigrationButton busy={m.busy === "revert"} blocked={m.revertBlocked} revertable={m.latestApplied.revertable} reason={m.latestApplied.revert_blocked_reason} onRevert={() => void revert()} />}
      </div>
      {reason && <p className="text-caption text-accent-gold-text">{reason}</p>}
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
        items={missing.map((f) => ({ id: f.id, label: sectionName(f.section_id), sectionId: f.section_id }))}
      />
    </section>
  );
}
