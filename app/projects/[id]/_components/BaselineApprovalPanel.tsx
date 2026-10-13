"use client";

import { useState } from "react";
import Button from "@/components/ui/Button";
import Icon from "@/components/ui/Icon";
import Modal from "@/components/ui/Modal";
import RejectBaselineModal from "./RejectBaselineModal";
import type { Comment } from "@/types/comment";
import type { BlockingFlag } from "./gate-helpers";
import type { BaselineSubmission } from "@/types/spine";
import type { OrgRole } from "@/types/organization";

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
  comments: Comment[];
  busy: boolean;
  error: string | null;
  onSubmit: () => Promise<void>;
  onApprove: () => Promise<void>;
  onReject: (reason: string, commentIds: readonly [string, ...string[]]) => Promise<void>;
  /** Mở panel Góp ý; truyền mã để lọc đúng góp ý của lượt từ chối. */
  onOpenComments: (commentIds?: readonly string[]) => void;
}

const when = (iso: string) => new Date(iso).toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

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
  return (
    <Modal open={open} onClose={onClose} title={fromSubmission ? "Duyệt baseline?" : "Chốt baseline?"}>
      <div className="flex flex-col gap-3">
        <p className="text-body text-on-surface">
          Bản SRS hiện tại sẽ được đóng dấu version và <span className="font-bold">khoá vĩnh viễn</span>. Đây là bản gửi
          ra ngoài được.
        </p>
        <p className="text-body text-on-surface-variant">
          Sau khi khoá thì không sửa vào bản này được nữa — mọi thay đổi về sau phải đi qua change request và phát hành
          version mới.
        </p>
        <div className="flex items-center justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Huỷ
          </Button>
          <Button loading={busy} onClick={() => void onConfirm()}>
            {fromSubmission ? "Duyệt và khoá" : "Chốt và khoá"}
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
  const [rejecting, setRejecting] = useState(false);
  const [approving, setApproving] = useState(false);

  // Viewer không chốt cũng không gửi (BE chặn bằng viewerReadOnly / requireRole)
  if (role !== "lead" && role !== "analyst") return null;

  const isLead = role === "lead";
  const openComments = comments.filter((c) => c.status === "open");
  const rejectionIds = submission?.rejection_comment_ids ?? [];
  const unresolved = rejectionIds.filter((id) => comments.find((c) => c.comment_id === id)?.status === "open");

  const blocked = blocking > 0;
  const blockedHint = `Còn ${blocking} vấn đề cần xử lý trước khi chốt`;

  return (
    <section className="bg-surface-container-high rounded-card p-3 flex flex-col gap-2">
      {/* Version đã khoá hiện ở chip breadcrumb trên header — không nhắc lại ở đây cho khỏi hai chỗ nói một thứ */}
      <div className="flex items-center gap-2">
        <Icon name="check-circle" size={14} className="text-on-surface-variant" />
        <h4 className="font-bold text-body text-on-surface">Chốt baseline</h4>
      </div>

      {error && <p className="text-body text-error">{error}</p>}

      {blockingFlags.length > 0 && (
        <ul className="flex flex-col gap-1">
          {blockingFlags.map((flag) => (
            <li key={flag.id} className="bg-surface-container-lowest rounded-inner px-2.5 py-1.5 flex flex-col gap-0.5">
              <span className="text-body text-on-surface">{flag.message}</span>
              {flag.remediation_step && (
                <span className="text-caption text-on-surface-variant">Xử lý ở bước {flag.remediation_step}</span>
              )}
            </li>
          ))}
        </ul>
      )}

      {submission?.status === "pending" ? (
        isLead ? (
          <>
            <p className="text-body text-on-surface">
              Analyst đã gửi bản này lúc {when(submission.submitted_at)} và đang chờ bạn duyệt.
            </p>
            <div className="flex items-center gap-2">
              <Button size="sm" loading={busy} disabled={blocked} title={blocked ? blockedHint : undefined} onClick={() => setApproving(true)}>
                Duyệt
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setRejecting(true)}>
                Từ chối
              </Button>
            </div>
            {blocked && <p className="text-caption text-on-surface-variant">{blockedHint}.</p>}
          </>
        ) : (
          <p className="text-body text-on-surface-variant">Đã gửi Lead duyệt lúc {when(submission.submitted_at)}. Chờ Lead quyết.</p>
        )
      ) : submission?.status === "rejected" ? (
        <>
          <p className="text-body text-on-surface">
            <span className="font-bold">Lead chưa duyệt:</span> {submission.reason}
          </p>
          <button
            type="button"
            onClick={() => onOpenComments(rejectionIds)}
            className="self-start text-caption font-bold text-primary hover:underline cursor-pointer"
          >
            {rejectionIds.length - unresolved.length}/{rejectionIds.length} góp ý đã xử lý — xem
          </button>
          {!isLead && (
            <Button size="sm" loading={busy} onClick={() => void onSubmit()}>
              Gửi lại
            </Button>
          )}
          {isLead && (
            <Button size="sm" loading={busy} disabled={blocked} title={blocked ? blockedHint : undefined} onClick={() => setApproving(true)}>
              Chốt baseline
            </Button>
          )}
        </>
      ) : isLead ? (
        <>
          <Button size="sm" loading={busy} disabled={blocked} title={blocked ? blockedHint : undefined} onClick={() => setApproving(true)}>
            Chốt baseline
          </Button>
          {blocked && <p className="text-caption text-on-surface-variant">{blockedHint}.</p>}
        </>
      ) : (
        <>
          <Button size="sm" loading={busy} disabled={blocked} title={blocked ? blockedHint : undefined} onClick={() => void onSubmit()}>
            Gửi Lead duyệt
          </Button>
          {blocked && <p className="text-caption text-on-surface-variant">{blockedHint}.</p>}
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
