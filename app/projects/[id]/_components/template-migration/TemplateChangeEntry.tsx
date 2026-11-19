"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import Button from "@/components/ui/Button";
import Icon from "@/components/ui/Icon";
import Skeleton from "@/components/ui/Skeleton";
import { listBaselines } from "@/lib/api/export";
import { getReviewPackage } from "@/lib/api/versions";
import type { Flag } from "@/types/spine";
import type { OrgRole } from "@/types/organization";
import type { TemplateCurrent } from "@/types/template-migration";
import { useTemplateMigration } from "../../hooks/useTemplateMigration";
import { templateMigrationHref } from "./href";
import { migrationMissingLabel, openMigrationMissing } from "./missing-flags";
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
  /** `GET /projects/:id` → `template_current`: mẫu đang theo; `null` = file mẫu của chính dự án; `undefined` = chưa tải ⇒ không ghi gì. */
  current?: TemplateCurrent | null;
}

/** Dòng "đang theo mẫu …" của thẻ. */
const currentKey = (c: TemplateCurrent | null) => (c === null ? "currentOwnFile" : c.kind === "project" ? "currentProject" : c.kind === "skeleton" ? "currentSkeleton" : "currentOrg");

/**
 * Lối vào "Đổi mẫu" trong panel công cụ của workspace. Disable kèm lý do: chưa có baseline, bản nháp đang chờ Lead duyệt, lần đổi mẫu
 * đang áp dụng. Đang có lần đổi mẫu mở ⇒ nút thành "Tiếp tục đổi mẫu". Sau khi áp dụng: hoàn tác (khi còn được) + mục thiếu có nút viết.
 * Viewer không thấy (BE chặn 403).
 */
export default function TemplateChangeEntry({ projectId, orgRole, flags, sectionName, refreshToken = 0, onChanged, current }: TemplateChangeEntryProps) {
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
    // Thẻ phẳng nền trắng trên panel xám: icon + tên + mẫu đang theo một khối, nút "Đổi mẫu" dạng nhạt ở góc (panel đã có nút
    // chính của gói thay đổi, không để hai nút tím đặc tranh nhau)
    <section aria-label={t("aria")} className="flex flex-col gap-3 rounded-card bg-surface-container-lowest p-4">
      <div className="flex items-start gap-3">
        <span className="shrink-0 w-9 h-9 rounded-control bg-primary-soft text-primary flex items-center justify-center">
          <Icon name="file-template" size={18} />
        </span>
        <div className="flex-1 min-w-0 flex flex-col gap-1">
          <h4 className="text-caption font-bold uppercase tracking-wide text-on-surface-muted">{t("title")}</h4>
          {current === undefined ? (
            <Skeleton className="h-5 w-56 max-w-full" />
          ) : (
            <p className="text-body font-semibold text-on-surface break-words">{t(currentKey(current), { name: current?.name ?? "", version: current?.version ?? 0 })}</p>
          )}
        </div>
        {reason ? (
          <Button size="sm" variant="secondary" disabled title={reason} className="shrink-0">
            {m.open ? t("resume") : t("change")}
          </Button>
        ) : (
          <Link
            href={templateMigrationHref(projectId)}
            scroll={false}
            className="shrink-0 h-8 px-3.5 inline-flex items-center gap-1.5 rounded-control bg-primary-soft text-primary hover:bg-primary-fixed text-body font-bold transition-colors"
          >
            {m.open ? t("resume") : t("change")}
            <Icon name="arrow-right" size={14} />
          </Link>
        )}
      </div>
      <p className="text-caption text-on-surface-muted leading-relaxed">{m.open ? t("openHelp") : t("help")}</p>
      {m.latestApplied && !m.open && (
        <div className="flex flex-wrap items-center gap-2">
          <RevertMigrationButton busy={m.busy === "revert"} blocked={m.revertBlocked} revertable={m.latestApplied.revertable} reason={m.latestApplied.revert_blocked_reason} onRevert={() => void revert()} />
        </div>
      )}
      {reason && (
        <p className="flex items-start gap-1.5 rounded-control bg-accent-gold-soft px-3 py-2 text-caption text-accent-gold-text">
          <Icon name="info" size={14} className="shrink-0 mt-0.5" />
          {reason}
        </p>
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
