"use client";

import { useMemo, useState } from "react";
import Button from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";
import Icon from "@/components/ui/Icon";
import IconButton from "@/components/ui/IconButton";
import { COMMENT_TEXT_MAX, KEEP_REASON_MIN_LENGTH, type SrsComment, type CommentResolutionInput, type PendingCommentAnchor } from "@/types/comment";

type Filter = "open" | "all";

interface CommentsPanelProps {
  comments: SrsComment[];
  loading: boolean;
  error: string | null;
  busy: boolean;
  /** Lead / Analyst mới xử lý được góp ý (BE chặn bằng `requireRole`, UI chỉ ẩn nút). */
  canResolve: boolean;
  /** Chỗ người dùng vừa bấm "Góp ý" — có thì mở sẵn ô soạn. */
  pendingAnchor: PendingCommentAnchor | null;
  onCancelPending: () => void;
  onSubmit: (text: string) => Promise<void>;
  onResolve: (commentId: string, resolution: CommentResolutionInput) => Promise<void>;
  /** Cuộn tài liệu tới mục được ghim. */
  onShowSection?: (sectionId: string) => void;
  /** Chỉ hiện đúng các mã này (lượt từ chối baseline chuyển sang). */
  focusCommentIds?: readonly string[] | null;
  onClearFocus?: () => void;
  onClose: () => void;
}

const ROLE_LABEL: Record<string, string> = { lead: "Lead", analyst: "Analyst", viewer: "Viewer" };

const STATUS_CHIP: Record<SrsComment["status"], { text: string; style: string } | null> = {
  open: null,
  resolved: { text: "Đã xử lý", style: "bg-success-container text-success" },
  converted: { text: "Đã thành CR", style: "bg-primary-soft text-primary" },
};

const when = (iso: string) => new Date(iso).toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

/** Ô soạn một góp ý cho chỗ vừa chọn. Không đổi nội dung tài liệu (BR-05) — chỉ ghim lời nhắn. */
function CommentComposer({
  anchor,
  busy,
  onCancel,
  onSubmit,
}: {
  anchor: PendingCommentAnchor;
  busy: boolean;
  onCancel: () => void;
  onSubmit: (text: string) => Promise<void>;
}) {
  const [text, setText] = useState("");
  const trimmed = text.trim();

  return (
    <section className="bg-surface-container-high rounded-card p-3 flex flex-col gap-2">
      <div className="flex items-start justify-between gap-2">
        <p className="text-caption text-on-surface-variant min-w-0">
          Góp ý vào <span className="font-bold text-on-surface">{anchor.label}</span>
          {anchor.blockIndex !== undefined && <span> › đoạn {anchor.blockIndex + 1}</span>}
        </p>
        <IconButton icon="close" size="sm" label="Bỏ góp ý đang soạn" onClick={onCancel} />
      </div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value.slice(0, COMMENT_TEXT_MAX))}
        rows={3}
        autoFocus
        placeholder="Chỗ này cần sửa gì?"
        aria-label="Nội dung góp ý"
        className="w-full bg-surface-container-lowest rounded-inner px-3 py-2 text-body text-on-surface placeholder:text-on-surface-subtle resize-y focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      />
      <div className="flex items-center justify-between gap-2">
        <span className="text-caption text-on-surface-subtle">
          {text.length}/{COMMENT_TEXT_MAX}
        </span>
        <Button size="sm" loading={busy} disabled={trimmed.length === 0} onClick={() => void onSubmit(trimmed)}>
          Ghim góp ý
        </Button>
      </div>
    </section>
  );
}

function CommentCard({
  comment,
  canResolve,
  busy,
  onResolve,
  onShowSection,
}: {
  comment: SrsComment;
  canResolve: boolean;
  busy: boolean;
  onResolve: (commentId: string, resolution: CommentResolutionInput) => Promise<void>;
  onShowSection?: (sectionId: string) => void;
}) {
  const [keeping, setKeeping] = useState(false);
  const [reason, setReason] = useState("");
  const chip = STATUS_CHIP[comment.status];
  const author = comment.author?.name || comment.author?.email || "Người dùng";

  return (
    <article className="bg-surface-container-low rounded-card p-3 flex flex-col gap-1.5">
      <div className="flex items-start justify-between gap-2">
        <button
          type="button"
          onClick={onShowSection ? () => onShowSection(comment.anchor.section_id) : undefined}
          disabled={!onShowSection}
          className="text-caption font-bold text-primary text-left min-w-0 truncate enabled:hover:underline enabled:cursor-pointer disabled:text-on-surface-variant"
        >
          {comment.anchor.label}
        </button>
        {chip && <span className={`shrink-0 text-caption font-extrabold px-2 py-0.5 rounded-full ${chip.style}`}>{chip.text}</span>}
      </div>

      {comment.anchor.excerpt && (
        <p className="text-caption text-on-surface-subtle italic line-clamp-2">“{comment.anchor.excerpt}”</p>
      )}

      <p className="text-body text-on-surface whitespace-pre-wrap">{comment.text}</p>

      <div className="flex items-center justify-between gap-2 flex-wrap">
        <span className="text-caption text-on-surface-variant">
          {comment.comment_id} · {author} ({ROLE_LABEL[comment.author_role] ?? comment.author_role}) · {when(comment.created_at)}
        </span>
        {comment.status === "open" && canResolve && (
          <span className="flex items-center gap-1">
            <Button
              size="sm"
              variant="ghost"
              loading={busy}
              onClick={() => void onResolve(comment.comment_id, { kind: "fixed" })}
              // Hệ quả thật: bước đã Accept sở hữu mục này sẽ mở lại (UC-47) — nói trước để người dùng
              // không ngạc nhiên khi tiến độ lùi một nấc.
              title="Đã nhờ AI sửa theo góp ý này. Mục có bước đã duyệt thì bước đó mở lại để soạn lại."
            >
              Đã sửa
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setKeeping(true)} title="Không sửa — nêu lý do để Lead đọc khi duyệt lại">
              Giữ nguyên
            </Button>
          </span>
        )}
        {comment.status === "converted" && comment.cr_id && (
          <span className="text-caption font-bold text-primary">{comment.cr_id}</span>
        )}
      </div>

      {/* Giữ nguyên thì lý do là BẮT BUỘC (§3.5) — nó là thứ duy nhất Lead có để hiểu vì sao không sửa */}
      {keeping && (
        <div className="flex flex-col gap-1.5 bg-surface-container-high rounded-inner p-2.5">
          <label htmlFor={`keep-${comment.comment_id}`} className="text-caption font-bold text-on-surface-variant">
            Vì sao giữ nguyên?
          </label>
          <textarea
            id={`keep-${comment.comment_id}`}
            value={reason}
            onChange={(e) => setReason(e.target.value.slice(0, COMMENT_TEXT_MAX))}
            rows={2}
            autoFocus
            placeholder="vd: Khách đã xác nhận giữ cách gọi này trong hợp đồng."
            className="w-full bg-surface-container-lowest rounded-inner px-2.5 py-1.5 text-body text-on-surface placeholder:text-on-surface-subtle resize-y focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          />
          <div className="flex items-center justify-end gap-1.5">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setKeeping(false);
                setReason("");
              }}
            >
              Huỷ
            </Button>
            <Button
              size="sm"
              loading={busy}
              disabled={reason.trim().length < KEEP_REASON_MIN_LENGTH}
              onClick={() => void onResolve(comment.comment_id, { kind: "kept", reason: reason.trim() })}
            >
              Lưu lý do
            </Button>
          </div>
        </div>
      )}

      {/* Đã xử lý rồi thì Lead phải đọc được kết luận — đây là lý do tách hai nhánh ngay từ đầu */}
      {comment.resolution && (
        <p className="text-caption text-on-surface-variant">
          {comment.resolution.kind === "fixed" ? "Đã sửa theo góp ý." : `Giữ nguyên — ${comment.resolution.reason}`}
        </p>
      )}
    </article>
  );
}

/**
 * Panel "Góp ý" (UC-49) — ghim lời nhắn vào mục / đoạn của tài liệu, xem và đánh dấu đã xử lý.
 *
 * Mức tối thiểu theo `business-flow.md §3.5`: ghim theo section / phần nội dung, **không có thread trả lời**.
 * Lead phải ghim ở đây trước khi từ chối baseline (`POST /baseline/reject` đòi ≥ 1 comment).
 */
export default function CommentsPanel({
  comments,
  loading,
  error,
  busy,
  canResolve,
  pendingAnchor,
  onCancelPending,
  onSubmit,
  onResolve,
  onShowSection,
  focusCommentIds,
  onClearFocus,
  onClose,
}: CommentsPanelProps) {
  const [filter, setFilter] = useState<Filter>("open");

  const shown = useMemo(() => {
    const byFocus = focusCommentIds ? comments.filter((c) => focusCommentIds.includes(c.comment_id)) : comments;
    // Lọc theo mã từ chối baseline thì hiện cả đã xử lý — người dùng cần thấy còn bao nhiêu chưa xong
    const byStatus = focusCommentIds || filter === "all" ? byFocus : byFocus.filter((c) => c.status === "open");
    return [...byStatus].sort((a, b) => b.created_at.localeCompare(a.created_at));
  }, [comments, filter, focusCommentIds]);

  const openCount = comments.filter((c) => c.status === "open").length;

  return (
    <aside className="w-full h-full bg-surface-container flex flex-col overflow-hidden" aria-label="Góp ý">
      <div className="ff-fade-below [--ff-fade:var(--color-surface-container)] h-12 pl-4 pr-2 bg-surface-container flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <Icon name="feedback" size={16} className="text-primary" />
          <h3 className="font-bold text-body text-on-surface truncate">Góp ý</h3>
          {openCount > 0 && (
            <span className="text-caption font-extrabold px-2 py-0.5 rounded-full bg-surface-container-high text-on-surface-variant">
              {openCount}
            </span>
          )}
        </div>
        <IconButton icon="close" size="sm" label="Đóng góp ý" onClick={onClose} />
      </div>

      <div className="flex-1 overflow-y-auto ff-scroll p-4 space-y-3">
        {pendingAnchor && <CommentComposer anchor={pendingAnchor} busy={busy} onCancel={onCancelPending} onSubmit={onSubmit} />}

        {error && <p className="text-body text-error">{error}</p>}

        {focusCommentIds ? (
          <div className="flex items-center justify-between gap-2">
            <p className="text-caption text-on-surface-variant">Góp ý của lượt Lead từ chối baseline</p>
            {onClearFocus && (
              <button type="button" onClick={onClearFocus} className="text-caption font-bold text-primary hover:underline cursor-pointer">
                Xem tất cả
              </button>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-1.5">
            {(["open", "all"] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setFilter(value)}
                aria-pressed={filter === value}
                className={`text-caption font-bold px-2.5 py-1 rounded-full cursor-pointer ${
                  filter === value ? "bg-primary-soft text-primary" : "text-on-surface-variant hover:bg-surface-container-high"
                }`}
              >
                {value === "open" ? "Đang mở" : "Tất cả"}
              </button>
            ))}
          </div>
        )}

        {loading ? (
          <div className="flex flex-col items-center justify-center py-12 gap-2 text-on-surface-muted">
            <span className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <span className="text-caption">Đang tải góp ý…</span>
          </div>
        ) : shown.length === 0 ? (
          <EmptyState
            icon="feedback"
            title={filter === "open" && !focusCommentIds ? "Chưa có góp ý nào đang mở" : "Chưa có góp ý nào"}
            description="Bấm “Góp ý” trên một mục của tài liệu để ghim lời nhắn vào đúng chỗ cần sửa."
          />
        ) : (
          shown.map((comment) => (
            <CommentCard
              key={comment.comment_id}
              comment={comment}
              canResolve={canResolve}
              busy={busy}
              onResolve={onResolve}
              onShowSection={onShowSection}
            />
          ))
        )}
      </div>
    </aside>
  );
}
