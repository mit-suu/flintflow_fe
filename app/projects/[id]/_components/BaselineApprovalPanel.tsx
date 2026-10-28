"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import Button from "@/components/ui/Button";
import Icon from "@/components/ui/Icon";
import Modal from "@/components/ui/Modal";
import RejectBaselineModal from "./RejectBaselineModal";
import type { SrsComment } from "@/types/comment";
import type { BlockingFlag } from "./gate-helpers";
import type { BaselineSubmission } from "@/types/spine";
import type { OrgRole } from "@/types/organization";
import type { Locale } from "@/lib/i18n";

interface BaselineApprovalPanelProps {
  role: OrgRole | null;
  submission: BaselineSubmission | null;
  /** Số vấn đề phải xử lý trước khi chốt (cờ đỏ + mục cần viết lại) — từ `issueCounts`. */
  blocking: number;
  /**
   * Cờ đỏ chặn lượt vừa rồi, lấy từ `meta.flags[]` của 422 `BASELINE_BLOCKED`. Đây là nguồn chuẩn cho
   * đúng lượt đó: lượt quét ở mức ký mở ra cờ mà danh sách cờ đang hiển thị chưa có, nên nói "còn cờ đỏ"
   * mà không chỉ ra cái nào thì người dùng không tin được.
   */
  blockingFlags: BlockingFlag[];
  comments: SrsComment[];
  busy: boolean;
  error: string | null;
  onSubmit: () => Promise<void>;
  onApprove: () => Promise<void>;
  onReject: (reason: string, commentIds: readonly [string, ...string[]]) => Promise<void>;
  /** Mở panel Góp ý; truyền mã để lọc đúng góp ý của lượt từ chối. */
  onOpenComments: (commentIds?: readonly string[]) => void;
}

const when = (iso: string, locale: Locale) => new Date(iso).toLocaleString(locale === "en" ? "en-US" : "vi-VN", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

/**
 * Chốt baseline 1.0 (UC-45, UC-46, UC-47) — đặt ngay dưới `ReadinessSummary` trong panel kiểm tra, vì
 * đó là chỗ người dùng đang hỏi "đã chốt bản được chưa".
 *
 * Phân vai theo `business-flow.md` bảng vai trò: Lead duyệt (kể cả việc của chính mình), Analyst gửi Lead.
 * Mọi điều kiện thật do BE kiểm — panel chỉ tắt nút khi đã biết chắc còn vấn đề chặn, còn lại cứ gửi và
 * hiện lỗi thật trả về.
 */
/**
 * Ký baseline là **không thu hồi được**: BE chụp snapshot bất biến, muốn sửa phải phát hành version mới.
 * Nên hỏi lại trước khi ký — nói rõ hệ quả thay vì một câu "Bạn có chắc không?" rỗng.
 */
function ConfirmApproveModal({
  open,
  onClose,
  busy,
  fromSubmission,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  busy: boolean;
  /** Đang duyệt bản người khác nộp (khác với Lead tự chốt việc của mình). */
  fromSubmission: boolean;
  onConfirm: () => Promise<void>;
}) {
  const t = useTranslations("workspace.baseline");
  return (
    <Modal open={open} onClose={onClose} title={fromSubmission ? t("confirmApproveTitle") : t("confirmLockTitle")}>
      <div className="flex flex-col gap-3">
        <p className="text-body text-on-surface">
          {t.rich("confirmBody", { b: (chunks) => <span className="font-bold">{chunks}</span> })}
        </p>
        <p className="text-body text-on-surface-variant">{t("confirmNote")}</p>
        <div className="flex items-center justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            {t("cancel")}
          </Button>
          <Button loading={busy} onClick={() => void onConfirm()}>
            {fromSubmission ? t("approveAndLock") : t("lockAndLock")}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

export default function BaselineApprovalPanel({
  role,
  submission,
  blocking,
  blockingFlags,
  comments,
  busy,
  error,
  onSubmit,
  onApprove,
  onReject,
  onOpenComments,
}: BaselineApprovalPanelProps) {
  const t = useTranslations("workspace.baseline");
  const locale = useLocale();
  const [rejecting, setRejecting] = useState(false);
  const [approving, setApproving] = useState(false);

  // Viewer không chốt cũng không gửi (BE chặn bằng viewerReadOnly / requireRole)
  if (role !== "lead" && role !== "analyst") return null;

  const isLead = role === "lead";
  const openComments = comments.filter((c) => c.status === "open");
  const rejectionIds = submission?.rejection_comment_ids ?? [];
  const unresolved = rejectionIds.filter((id) => comments.find((c) => c.comment_id === id)?.status === "open");

  const blocked = blocking > 0;
  const blockedHint = t("blockedHint", { count: blocking });
  const blockedSentence = t("blockedHintSentence", { count: blocking });

  return (
    <section className="bg-surface-container-high rounded-card p-3 flex flex-col gap-2">
      {/* Version đã khoá hiện ở chip breadcrumb trên header — không nhắc lại ở đây cho khỏi hai chỗ nói một thứ */}
      <div className="flex items-center gap-2">
        <Icon name="check-circle" size={14} className="text-on-surface-variant" />
        <h4 className="font-bold text-body text-on-surface">{t("title")}</h4>
      </div>

      {error && <p className="text-body text-error">{error}</p>}

      {blockingFlags.length > 0 && (
        <ul className="flex flex-col gap-1">
          {blockingFlags.map((flag) => (
            <li key={flag.id} className="bg-surface-container-lowest rounded-inner px-2.5 py-1.5 flex flex-col gap-0.5">
              <span className="text-body text-on-surface">{flag.message}</span>
              {flag.remediation_step && (
                <span className="text-caption text-on-surface-variant">{t("fixAtStep", { step: flag.remediation_step })}</span>
              )}
            </li>
          ))}
        </ul>
      )}

      {submission?.status === "pending" ? (
        isLead ? (
          <>
            <p className="text-body text-on-surface">{t("pendingForLead", { time: when(submission.submitted_at, locale) })}</p>
            <div className="flex items-center gap-2">
              <Button size="sm" loading={busy} disabled={blocked} title={blocked ? blockedHint : undefined} onClick={() => setApproving(true)}>
                {t("approve")}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setRejecting(true)}>
                {t("reject")}
              </Button>
            </div>
            {blocked && <p className="text-caption text-on-surface-variant">{blockedSentence}</p>}
          </>
        ) : (
          <p className="text-body text-on-surface-variant">{t("pendingForAnalyst", { time: when(submission.submitted_at, locale) })}</p>
        )
      ) : submission?.status === "rejected" ? (
        <>
          <p className="text-body text-on-surface">
            {t.rich("rejected", { reason: submission.reason ?? "", b: (chunks) => <span className="font-bold">{chunks}</span> })}
          </p>
          <button
            type="button"
            onClick={() => onOpenComments(rejectionIds)}
            className="self-start text-caption font-bold text-primary hover:underline cursor-pointer"
          >
            {t("rejectionProgress", { done: rejectionIds.length - unresolved.length, total: rejectionIds.length })}
          </button>
          {!isLead && (
            // FLF-271 (UC-40): gửi lại chỉ khi mọi góp ý đã có kết luận và hết cờ đỏ — BE cũng chặn (REJECTION_COMMENTS_OPEN / BASELINE_BLOCKED)
            <Button
              size="sm"
              loading={busy}
              disabled={unresolved.length > 0 || blocked}
              title={unresolved.length > 0 ? t("resubmitBlockedComments", { count: unresolved.length }) : blocked ? blockedHint : undefined}
              onClick={() => void onSubmit()}
            >
              {t("resubmit")}
            </Button>
          )}
          {!isLead && unresolved.length > 0 && <p className="text-caption text-on-surface-variant">{t("resubmitBlockedComments", { count: unresolved.length })}</p>}
          {isLead && (
            <Button size="sm" loading={busy} disabled={blocked} title={blocked ? blockedHint : undefined} onClick={() => setApproving(true)}>
              {t("title")}
            </Button>
          )}
        </>
      ) : isLead ? (
        <>
          <Button size="sm" loading={busy} disabled={blocked} title={blocked ? blockedHint : undefined} onClick={() => setApproving(true)}>
            {t("title")}
          </Button>
          {blocked && <p className="text-caption text-on-surface-variant">{blockedSentence}</p>}
        </>
      ) : (
        <>
          <Button size="sm" loading={busy} disabled={blocked} title={blocked ? blockedHint : undefined} onClick={() => void onSubmit()}>
            {t("submitToLead")}
          </Button>
          {blocked && <p className="text-caption text-on-surface-variant">{blockedSentence}</p>}
        </>
      )}

      <ConfirmApproveModal
        open={approving}
        onClose={() => setApproving(false)}
        busy={busy}
        fromSubmission={submission?.status === "pending"}
        onConfirm={async () => {
          await onApprove();
          setApproving(false);
        }}
      />

      <RejectBaselineModal
        open={rejecting}
        onClose={() => setRejecting(false)}
        openComments={openComments}
        busy={busy}
        onReject={async (reason, ids) => {
          await onReject(reason, ids);
          setRejecting(false);
        }}
        onOpenComments={() => {
          setRejecting(false);
          onOpenComments();
        }}
      />
    </section>
  );
}
