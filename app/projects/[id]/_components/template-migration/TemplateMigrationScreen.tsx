"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import Button from "@/components/ui/Button";
import type { OrgRole } from "@/types/organization";
import type { Flag } from "@/types/spine";
import type { Migration, TemplateCurrent } from "@/types/template-migration";
import { isOpenMigration } from "@/types/template-migration";
import { useTemplateMigration } from "../../hooks/useTemplateMigration";
import type { MigrationTargetQuery } from "./href";
import { migrationMissingLabel, openMigrationMissing } from "./missing-flags";
import MissingSectionsCard from "./MissingSectionsCard";
import ReviewStep from "./ReviewStep";
import RevertMigrationButton from "./RevertMigrationButton";
import SummaryStep from "./SummaryStep";
import TargetPicker from "./TargetPicker";

interface TemplateMigrationScreenProps {
  projectId: string;
  orgRole: OrgRole | null;
  /** Org của dự án — nguồn danh sách mẫu để chọn. */
  /** `undefined` = dự án chưa tải xong, chưa biết org. */
  orgId: string | null | undefined;
  /** Cờ đang mở của dự án: mục thiếu sau đổi mẫu lấy từ cờ đỏ, không từ ảnh chụp lúc áp dụng. */
  flags: readonly Flag[];
  sectionName: (sectionId: string) => string;
  /** Đích điền sẵn (nút "Cập nhật" của thông báo bản mới). */
  preselect?: MigrationTargetQuery | null;
  /** Áp dụng / hoàn tác xong: tài liệu, cờ, project cần đọc lại. */
  onChanged?: () => void;
  /** Mẫu + bản dự án đang theo (`GET /projects/:id` → `template_current`) — bước chọn mẫu không cho chọn lại đúng bản đó. */
  currentTemplate?: TemplateCurrent | null;
}

const STEPS = ["target", "review", "apply"] as const;
type Step = (typeof STEPS)[number];

/** `mapping_review` / `decisions` cùng là bước Xem lại thay đổi; bấm Tiếp tục chỉ chuyển màn (`viewApply`), chốt `ready` lúc Áp dụng. */
const stepOf = (m: Migration | null, viewApply: boolean): Step | "applying" | "failed" | "applied" => {
  if (!m || !isOpenMigration(m.state)) return m?.state === "applied" ? "applied" : "target";
  if (m.state === "mapping_review" || m.state === "decisions") return viewApply ? "apply" : "review";
  if (m.state === "ready") return "apply";
  return m.state === "apply_failed" ? "failed" : "applying";
};

/**
 * Màn đổi mẫu (popup `panel=template`), 3 bước: chọn mẫu đích → xem lại thay đổi (ghép cặp + quyết định, chọn sẵn phương án miễn phí;
 * đổi ngược: Giữ / Hoàn tác) → áp dụng từ dàn tiêu đề tài liệu sau khi đổi. Mọi bước đọc/ghi qua `useTemplateMigration` (BE là nguồn sự
 * thật); 409 dữ liệu đổi giữa chừng đưa về bước xem lại kèm thông báo.
 */
export default function TemplateMigrationScreen({ projectId, orgId, orgRole, flags, sectionName, preselect = null, onChanged, currentTemplate = null }: TemplateMigrationScreenProps) {
  const t = useTranslations("mode1.templateMigration");
  const m = useTemplateMigration(projectId, { detail: true, fallbackError: t("actionFailed") });
  // Có đích điền sẵn (nút Cập nhật của thông báo) mà chưa có lần đổi mẫu mở ⇒ vào thẳng bước chọn mẫu, không hiện kết quả cũ
  const [pickAgain, setPickAgain] = useState(preselect !== null);
  const [viewApply, setViewApply] = useState(false);
  const isLead = orgRole === "lead";

  if (m.loading) return <p className="text-body text-on-surface-muted">{t("loading")}</p>;

  const current = m.current;
  // 409 STALE đưa lần đổi mẫu về bước xem lại: không giữ màn Áp dụng
  const base = stepOf(current, viewApply && !m.stale);
  const step = pickAgain && base === "applied" ? "target" : base;
  const stepIndex = STEPS.indexOf(step as Step);

  /** Mọi thay đổi trạng thái đều báo ra ngoài để thẻ công cụ và project đọc lại (hai nơi giữ trạng thái riêng). */
  const afterChange = async (run: () => Promise<Migration | null>) => {
    const done = await run();
    if (done) {
      setPickAgain(false);
      setViewApply(false);
      onChanged?.();
    }
  };

  return (
    <div className="flex flex-col gap-5">
      {stepIndex >= 0 && (
        <ol aria-label={t("stepsLabel")} className="flex flex-wrap gap-2">
          {STEPS.map((s, i) => (
            <li
              key={s}
              aria-current={i === stepIndex ? "step" : undefined}
              className={`px-3 py-1 rounded-full text-caption font-bold ${i === stepIndex ? "bg-primary text-on-primary" : i < stepIndex ? "bg-primary-soft text-primary-hover" : "bg-surface-container-high text-on-surface-muted"}`}
            >
              {i + 1}. {t(`steps.${s}`)}
            </li>
          ))}
        </ol>
      )}

      {m.stale && (
        <p role="alert" className="rounded-card bg-accent-gold-soft p-3 text-body text-accent-gold-text">
          {t("stale")}
        </p>
      )}
      {m.error && !m.stale && (
        <p role="alert" className="rounded-card bg-error-container p-3 text-body text-on-error-container">
          {m.error}
        </p>
      )}

      {step === "target" && (
        <TargetPicker
          orgId={orgId}
          canPublish={isLead}
          busy={m.busy === "start"}
          preselect={preselect}
          previous={m.latestApplied?.previous_template ?? null}
          previousStandard={m.latestApplied?.previous_standard === true}
          current={currentTemplate}
          onStart={(input) => void afterChange(() => m.start(input))}
        />
      )}

      {step === "review" && current && (
        <ReviewStep
          migration={current}
          busy={m.busy !== null}
          // Mọi thao tác ở bước xem lại giữ người dùng ở bước này (kể cả sau khi 409 STALE đưa về đây)
          onDecide={(change) => {
            setViewApply(false);
            void m.decide(change);
          }}
          onEditPairs={(edits) => {
            setViewApply(false);
            void m.editPairs(edits);
          }}
          onEditMapping={(edits) => {
            setViewApply(false);
            void m.editMapping(edits);
          }}
          onContinue={() => {
            m.clearNotices();
            setViewApply(true);
          }}
          onCancel={() => void afterChange(m.cancel)}
        />
      )}

      {step === "apply" && current && (
        <SummaryStep
          migration={current}
          applying={m.busy === "apply"}
          busy={m.busy !== null}
          brokenLinks={m.brokenLinks}
          onApply={() => void afterChange(m.readyAndApply)}
          onBack={current.state === "ready" ? undefined : () => setViewApply(false)}
          onCancel={() => void afterChange(m.cancel)}
        />
      )}

      {step === "applying" && (
        <div className="flex flex-col items-start gap-3">
          <p role="status" className="text-body text-on-surface-variant">
            {t(current?.state === "reverting" ? "revertingElsewhere" : "applyingElsewhere")}
          </p>
          <Button variant="secondary" size="sm" onClick={() => void m.reload()}>
            {t("refresh")}
          </Button>
        </div>
      )}

      {step === "failed" && current && (
        <div className="flex flex-col items-start gap-3">
          <p role="alert" className="rounded-card bg-error-container p-3 text-body text-on-error-container">
            {t("applyFailed")}
          </p>
          <Button loading={m.busy === "restore"} disabled={m.busy !== null} onClick={() => void afterChange(m.restore)}>
            {t("restore")}
          </Button>
        </div>
      )}

      {step === "applied" && current && (
        <div className="flex flex-col gap-4">
          <p role="status" className="rounded-card bg-success-soft p-3 text-body font-semibold text-success">
            {t("appliedNote", { name: current.to.name, version: current.to.version })}
          </p>
          <MissingSectionsCard
            projectId={projectId}
            canWrite={orgRole !== "viewer"}
            items={openMigrationMissing(flags).map((f) => ({
              id: f.id,
              // Tài liệu trong workspace có thể chưa đọc lại sau khi áp dụng ⇒ tên lấy từ câu cờ, rồi từ chính lần đổi mẫu (heading của mẫu mới)
              label: migrationMissingLabel(f) ?? current.groups.missing.find((x) => x.section_id === f.section_id)?.heading_text ?? sectionName(f.section_id),
              sectionId: f.section_id,
            }))}
          />
          <div className="flex flex-wrap items-start gap-3">
            <RevertMigrationButton busy={m.busy === "revert"} blocked={m.revertBlocked} revertable={current.revertable} reason={current.revert_blocked_reason} onRevert={() => void afterChange(m.revert)} />
            <Button size="sm" variant="secondary" disabled={m.busy !== null} onClick={() => setPickAgain(true)}>
              {t("changeAgain")}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

