"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import Button from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";
import Icon from "@/components/ui/Icon";
import IconButton from "@/components/ui/IconButton";
import Skeleton from "@/components/ui/Skeleton";
import Tabs from "@/components/ui/Tabs";
import {
  COMMENT_ACTION,
  COMMENT_CARD,
  COMMENT_TEXTAREA,
  CommentCardShell,
  CommentCounter,
  CommentError,
  CommentKeepForm,
  CommentReplies,
  CommentReplyBox,
  CommentResolutionNote,
  CommentResolveMenu,
  CommentStatusBadge,
  CommentText,
  useResolveNote,
  PANEL_STICKY,
} from "./comment-parts";
import { COMMENT_TEXT_MAX, type SrsComment, type CommentResolutionInput, type PendingCommentAnchor } from "@/types/comment";

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
  /** Trả lời trong chuỗi trao đổi của comment; không truyền ⇒ không có ô trả lời. */
  onReply?: (commentId: string, text: string) => Promise<void>;
  /** Cuộn tài liệu tới mục được ghim. */
  onShowSection?: (sectionId: string) => void;
  /** FLF-271 (UC-40): nhờ AI sửa theo góp ý — mở ô chat sửa với câu điền sẵn; áp xong comment tự đóng. */
  onFixByChat?: (comment: SrsComment) => void;
  /** Chỉ hiện đúng các mã này (lượt từ chối baseline chuyển sang). */
  focusCommentIds?: readonly string[] | null;
  onClearFocus?: () => void;
  onClose: () => void;
}

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
  const t = useTranslations("workspace.comments");
  const [text, setText] = useState("");
  const trimmed = text.trim();

  return (
    <section className={`${COMMENT_CARD} ring-2 ring-primary-fixed`}>
      <div className="flex items-start justify-between gap-2">
        <p className="flex items-start gap-1.5 text-caption text-primary min-w-0">
          <Icon name="comment-add" size={13} className="shrink-0 mt-px" />
          <span className="min-w-0 break-words">
            {t.rich("composeTo", { label: anchor.label, b: (chunks) => <span className="font-bold">{chunks}</span> })}
            {anchor.blockIndex !== undefined && <span>{t("paragraph", { n: anchor.blockIndex + 1 })}</span>}
          </span>
        </p>
        <IconButton icon="close" size="sm" label={t("cancelCompose")} onClick={onCancel} />
      </div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value.slice(0, COMMENT_TEXT_MAX))}
        rows={3}
        autoFocus
        placeholder={t("placeholder")}
        aria-label={t("textAria")}
        className={COMMENT_TEXTAREA}
      />
      <div className="flex items-center justify-between gap-2">
        <CommentCounter length={text.length} />
        <Button size="sm" loading={busy} disabled={trimmed.length === 0} onClick={() => void onSubmit(trimmed)} className={COMMENT_ACTION}>
          {t("pin")}
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
  onReply,
  onShowSection,
  onFixByChat,
}: {
  comment: SrsComment;
  canResolve: boolean;
  busy: boolean;
  onResolve: (commentId: string, resolution: CommentResolutionInput) => Promise<void>;
  onReply?: (commentId: string, text: string) => Promise<void>;
  onShowSection?: (sectionId: string) => void;
  onFixByChat?: (comment: SrsComment) => void;
}) {
  const t = useTranslations("workspace.comments");
  const resolveNote = useResolveNote(comment);
  const [keeping, setKeeping] = useState(false);
  const open = comment.status === "open";

  return (
    <CommentCardShell
      as="article"
      ariaLabel={comment.comment_id}
      context={{ label: comment.anchor.label, meta: comment.comment_id, excerpt: comment.anchor.excerpt }}
      author={{ person: comment.author, role: comment.author_role, at: comment.created_at, fallbackName: t("defaultAuthor") }}
      // Workspace chỉ gắn nhãn khi đã đóng: lọc mặc định là "Đang mở", nhãn "Đang mở" trên mọi thẻ là thừa
      badge={<CommentStatusBadge comment={comment} showOpen={false} />}
      headerActions={
        open && canResolve ? (
          <CommentResolveMenu
            note={resolveNote}
            busy={busy}
            onFixByChat={onFixByChat ? () => onFixByChat(comment) : undefined}
            onFixed={() => void onResolve(comment.comment_id, { kind: "fixed" })}
            onKeep={() => setKeeping(true)}
          />
        ) : null
      }
      onLocate={onShowSection ? () => onShowSection(comment.anchor.section_id) : undefined}
      locateLabel={t("showInDocument")}
    >
      <CommentText text={comment.text} />
      {/* Đã xử lý rồi thì Lead phải đọc được kết luận — đây là lý do tách hai nhánh ngay từ đầu */}
      <CommentResolutionNote comment={comment} />
      <CommentReplies replies={comment.replies} fallbackName={t("defaultAuthor")} />
      {keeping && (
        <CommentKeepForm
          id={comment.comment_id}
          busy={busy}
          onCancel={() => setKeeping(false)}
          onSave={(reason) =>
            onResolve(comment.comment_id, { kind: "kept", reason })
              .then(() => setKeeping(false))
              // Lỗi đã hiện ở đầu panel (state của hook); giữ ô lý do để sửa rồi lưu lại
              .catch(() => {})
          }
        />
      )}
      {onReply && <CommentReplyBox onSubmit={(text) => onReply(comment.comment_id, text)} />}
    </CommentCardShell>
  );
}

/**
 * Panel "Góp ý" (UC-49) — ghim lời nhắn vào mục / đoạn của tài liệu, xem và đánh dấu đã xử lý. Dùng chung mảnh giao diện
 * với panel comment của trang đọc (`comment-parts.tsx`) để hai nơi nhìn như một tính năng.
 *
 * Ghim theo mục / đoạn, chuỗi trả lời một tầng (dùng chung với trang đọc), xử lý bằng nút ✓ ở đầu thẻ.
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
  onReply,
  onShowSection,
  onFixByChat,
  focusCommentIds,
  onClearFocus,
  onClose,
}: CommentsPanelProps) {
  const t = useTranslations("workspace.comments");
  const tThread = useTranslations("workspace.comments.thread");
  const [filter, setFilter] = useState<Filter>("open");

  const shown = useMemo(() => {
    const byFocus = focusCommentIds ? comments.filter((c) => focusCommentIds.includes(c.comment_id)) : comments;
    // Lọc theo mã từ chối baseline thì hiện cả đã xử lý — người dùng cần thấy còn bao nhiêu chưa xong
    const byStatus = focusCommentIds || filter === "all" ? byFocus : byFocus.filter((c) => c.status === "open");
    return [...byStatus].sort((a, b) => b.created_at.localeCompare(a.created_at));
  }, [comments, filter, focusCommentIds]);

  const openCount = comments.filter((c) => c.status === "open").length;

  return (
    <aside className="w-full h-full bg-surface-container overflow-y-auto ff-scroll" aria-label={t("title")}>
      <div className={`${PANEL_STICKY} flex flex-col`}>
        <div className="h-12 pl-4 pr-2 flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <Icon name="feedback" size={16} className="text-primary" />
            <h3 className="font-bold text-body text-on-surface truncate">{t("title")}</h3>
          </div>
          <IconButton icon="close" size="sm" label={t("close")} onClick={onClose} />
        </div>
        <div className="px-4 pb-2">
          {focusCommentIds ? (
            <div className="flex items-center justify-between gap-2 bg-primary-soft rounded-control pl-3 pr-1 py-1">
              <p className="text-caption font-semibold text-primary-hover">{t("rejectionFocus")}</p>
              {onClearFocus && (
                <Button size="sm" variant="ghost" onClick={onClearFocus} className={COMMENT_ACTION}>
                  {t("showAll")}
                </Button>
              )}
            </div>
          ) : (
            <Tabs
              label={tThread("filterAria")}
              idBase="workspace-comments"
              value={filter}
              onChange={setFilter}
              options={[
                { value: "open", label: tThread("tabCount", { label: t("filter.open"), count: openCount }) },
                { value: "all", label: tThread("tabCount", { label: t("filter.all"), count: comments.length }) },
              ]}
            />
          )}
        </div>
      </div>

      <div
        {...(focusCommentIds ? {} : { role: "tabpanel", id: "workspace-comments-panel", "aria-labelledby": `workspace-comments-tab-${filter}` })}
        className="px-4 pt-4 pb-4 flex flex-col gap-3"
      >
        {pendingAnchor && <CommentComposer anchor={pendingAnchor} busy={busy} onCancel={onCancelPending} onSubmit={onSubmit} />}

        {error && <CommentError>{error}</CommentError>}

        {loading ? (
          <div role="status" aria-busy="true" className="flex flex-col gap-2.5">
            <span className="sr-only">{t("loading")}</span>
            {[0, 1, 2].map((i) => (
              <div key={i} className={COMMENT_CARD}>
                <Skeleton className="h-4 w-2/5" />
                <Skeleton className="h-3 w-3/5" />
                <Skeleton className="h-3 w-full" />
              </div>
            ))}
          </div>
        ) : shown.length === 0 ? (
          <EmptyState
            icon="feedback"
            title={filter === "open" && !focusCommentIds ? t("emptyOpen") : t("empty")}
            description={t("emptyHint")}
          />
        ) : (
          shown.map((comment) => (
            <CommentCard
              key={comment.comment_id}
              comment={comment}
              canResolve={canResolve}
              busy={busy}
              onResolve={onResolve}
              onReply={onReply}
              onShowSection={onShowSection}
              onFixByChat={onFixByChat}
            />
          ))
        )}
      </div>
    </aside>
  );
}
