"use client";

import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";
import Icon from "@/components/ui/Icon";
import IconButton from "@/components/ui/IconButton";
import Tabs from "@/components/ui/Tabs";
import { crPrefillHref, titleFromInstruction } from "./mode1/prefill";
import {
  COMMENT_ACTION,
  COMMENT_CARD,
  COMMENT_TEXTAREA,
  CommentCardShell,
  CommentCounter,
  CommentError,
  CommentKeepForm,
  CommentMoreMenu,
  CommentReplies,
  CommentReplyBox,
  CommentResolutionNote,
  CommentResolveMenu,
  CommentStatusBadge,
  CommentText,
  useResolveNote,
  validateCommentText,
  PANEL_STICKY,
} from "./comment-parts";
import { COMMENT_TEXT_MAX, type CommentPerson, type CommentResolutionInput, type SrsComment } from "@/types/comment";
import type { OrgRole } from "@/types/organization";

/** Chỗ đang soạn comment mới — section, hoặc một block trong section. */
export interface CommentTarget {
  section_id: string;
  block_index: number | null;
  label: string;
}

interface CommentPanelProps {
  projectId: string;
  comments: SrsComment[];
  /** `null` khi chưa biết vai trò: ẩn nút chỉ dành cho Analyst/Lead, BE vẫn chặn. */
  role: OrgRole | null;
  /** "Tạo CR từ comment": dự án có luồng change request (mode 1) và đã có baseline (BR-03). */
  canCreateCr: boolean;
  /** Lý do không viết comment được ở bản đang đọc (vd Viewer trên bản nháp); `null` = được. */
  commentBlockedReason: string | null;
  versionLabel: string;
  /** Chỗ ghim còn tồn tại trong bản đang đọc không. */
  anchorExists: (comment: SrsComment) => boolean;
  target: CommentTarget | null;
  /** Đang lọc theo một chỗ ghim (bấm số comment cạnh section/block). */
  focus: { section_id: string; block_index: number | null } | null;
  highlightId: string | null;
  tab: CommentTab;
  onTabChange: (tab: CommentTab) => void;
  onClearFocus: () => void;
  onCancelTarget: () => void;
  onPost: (text: string) => Promise<void>;
  onReply: (commentId: string, text: string) => Promise<void>;
  onResolve: (commentId: string, resolution: CommentResolutionInput) => Promise<void>;
  /** Cuộn tài liệu tới chỗ ghim của comment (chỉ gọi khi chỗ ghim còn trong bản đang đọc). */
  onLocate?: (comment: SrsComment) => void;
  /** Có ⇒ panel đang là sheet trên màn hẹp, hiện nút đóng. */
  onClose?: () => void;
  /** Lỗi tải danh sách comment (câu cho người dùng). */
  loadError?: string | null;
}

/** Hai tab của panel: việc còn phải làm, và lịch sử (đã xử lý hoặc đã thành CR). */
export type CommentTab = "open" | "closed";

export const commentTab = (c: SrsComment): CommentTab => (c.status === "open" ? "open" : "closed");

/** `formerMember`: tên thay cho thành viên đã rời dự án. */
const personName = (p: CommentPerson | null, formerMember: string): string => p?.name || p?.email || formerMember;

function Composer({
  placeholder,
  submitLabel,
  onSubmit,
  onCancel,
  autoFocus = false,
}: {
  placeholder: string;
  submitLabel: string;
  onSubmit: (text: string) => Promise<void>;
  onCancel?: () => void;
  autoFocus?: boolean;
}) {
  const t = useTranslations("workspace.comments.thread");
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const invalid = validateCommentText(text);
    if (invalid) return setError(invalid === "tooLong" ? t("tooLong", { max: COMMENT_TEXT_MAX }) : t("emptyText"));
    setBusy(true);
    setError(null);
    try {
      await onSubmit(text.trim());
      setText("");
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : t("sendFailed"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={(e) => void submit(e)} className="flex flex-col gap-2">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={3}
        maxLength={COMMENT_TEXT_MAX + 100}
        placeholder={placeholder}
        aria-label={placeholder}
        aria-invalid={error ? true : undefined}
        autoFocus={autoFocus}
        className={COMMENT_TEXTAREA}
      />
      <div className="flex items-center justify-between gap-2">
        <CommentCounter length={text.trim().length} />
        <div className="flex gap-2">
          {onCancel && (
            <Button size="sm" variant="ghost" onClick={onCancel} className={COMMENT_ACTION}>
              {t("cancel")}
            </Button>
          )}
          <Button size="sm" type="submit" loading={busy} className={COMMENT_ACTION}>
            {busy ? t("sending") : submitLabel}
          </Button>
        </div>
      </div>
      {error && <CommentError>{error}</CommentError>}
    </form>
  );
}

function CommentCard({
  projectId,
  comment,
  role,
  canCreateCr,
  anchorMissing,
  highlighted,
  onReply,
  onResolve,
  onLocate,
}: {
  projectId: string;
  comment: SrsComment;
  role: OrgRole | null;
  canCreateCr: boolean;
  anchorMissing: boolean;
  highlighted: boolean;
  onReply: (commentId: string, text: string) => Promise<void>;
  onResolve: (commentId: string, resolution: CommentResolutionInput) => Promise<void>;
  onLocate?: (comment: SrsComment) => void;
}) {
  const t = useTranslations("workspace.comments.thread");
  const router = useRouter();
  const formerMember = t("formerMember");
  const resolveNote = useResolveNote(comment);
  const [keeping, setKeeping] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [resolveError, setResolveError] = useState<string | null>(null);
  const handler = role === "lead" || role === "analyst";
  const open = comment.status === "open";

  const crHref = crPrefillHref(projectId, {
    title: titleFromInstruction(`${comment.comment_id}: ${comment.anchor.label}`),
    description: t("crDescription", { text: comment.text, label: comment.anchor.label, version: comment.version.label }),
    source: "viewer_comment",
    ref: comment.comment_id,
    requester: personName(comment.author, formerMember),
    comment_id: comment.comment_id,
  });

  const resolve = (resolution: CommentResolutionInput) => {
    setResolveError(null);
    setResolving(true);
    onResolve(comment.comment_id, resolution)
      .then(() => setKeeping(false))
      .catch((err: unknown) => setResolveError(err instanceof Error && err.message ? err.message : t("resolveFailed")))
      .finally(() => setResolving(false));
  };

  return (
    <CommentCardShell
      id={`comment-${comment.comment_id}`}
      ariaLabel={t("cardAria", { id: comment.comment_id })}
      highlighted={highlighted}
      context={{
        label: comment.anchor.label,
        meta: t("cardMeta", { id: comment.comment_id, version: comment.version.label }),
        excerpt: comment.anchor.excerpt,
        missing: anchorMissing,
      }}
      author={{ person: comment.author, role: comment.author_role, at: comment.created_at, fallbackName: formerMember }}
      badge={<CommentStatusBadge comment={comment} />}
      headerActions={
        open && handler ? (
          <>
            <CommentResolveMenu note={resolveNote} busy={resolving} onFixed={() => resolve({ kind: "fixed" })} onKeep={() => setKeeping(true)} />
            <CommentMoreMenu items={canCreateCr ? [{ label: t("createCr"), icon: "arrow-right", onSelect: () => router.push(crHref) }] : []} />
          </>
        ) : null
      }
      onLocate={onLocate ? () => onLocate(comment) : undefined}
      locateLabel={t("locate")}
    >
      <CommentText text={comment.text} />
      <CommentResolutionNote comment={comment} />
      <CommentReplies replies={comment.replies} fallbackName={formerMember} />
      {keeping && (
        <CommentKeepForm id={comment.comment_id} busy={resolving} onCancel={() => setKeeping(false)} onSave={(reason) => resolve({ kind: "kept", reason })} />
      )}
      {resolveError && <CommentError>{resolveError}</CommentError>}
      <CommentReplyBox onSubmit={(text) => onReply(comment.comment_id, text)} />
    </CommentCardShell>
  );
}

/**
 * UC-49 Comment on SRS Content — panel bên phải trang đọc tài liệu (dưới 1024px là sheet trượt từ đáy). Comment không đổi
 * nội dung (BR-05): Analyst/Lead "Đánh dấu đã xử lý", hoặc sau baseline "Tạo CR từ comment" (mở form UC-41 điền sẵn nguồn
 * "Góp ý của người xem", người yêu cầu = tác giả comment).
 *
 * Panel tự cuộn, đầu panel (tiêu đề + tab) dính trên cùng — tab luôn trong tầm mắt dù tài liệu đang ở đâu.
 */
export default function CommentPanel({
  projectId,
  comments,
  role,
  canCreateCr,
  commentBlockedReason,
  versionLabel,
  anchorExists,
  target,
  focus,
  highlightId,
  tab,
  onTabChange,
  onClearFocus,
  onCancelTarget,
  onPost,
  onReply,
  onResolve,
  onLocate,
  onClose,
  loadError,
}: CommentPanelProps) {
  const t = useTranslations("workspace.comments.thread");
  const counts: Record<CommentTab, number> = { open: 0, closed: 0 };
  for (const c of comments) counts[commentTab(c)] += 1;
  const visible = comments.filter(
    (c) =>
      commentTab(c) === tab &&
      (!focus || (c.anchor.section_id === focus.section_id && (focus.block_index === null || c.anchor.block_index === focus.block_index)))
  );

  return (
    <aside aria-label={t("title")} className="h-full overflow-y-auto ff-scroll bg-surface-container">
      <div className={`${PANEL_STICKY} px-4 pt-3.5 pb-2 flex flex-col gap-3`}>
        <div className="flex items-center justify-between gap-2 min-h-8">
          <h2 className="flex items-center gap-2 font-bold text-heading text-on-surface">
            <Icon name="feedback" size={16} className="text-primary" />
            {t("title")}
          </h2>
          {onClose && <IconButton icon="close" size="md" label={t("closePanel")} onClick={onClose} className="max-lg:w-10 max-lg:h-10" />}
        </div>
        <Tabs
          label={t("filterAria")}
          idBase="view-comments"
          value={tab}
          onChange={onTabChange}
          className="self-start"
          options={(["open", "closed"] as const).map((value) => ({
            value,
            label: t("tabCount", { label: t(`tab.${value}`), count: counts[value] }),
          }))}
        />
      </div>

      <div
        role="tabpanel"
        id="view-comments-panel"
        aria-labelledby={`view-comments-tab-${tab}`}
        className="px-4 pt-4 pb-4 flex flex-col gap-3"
      >
        {loadError && <CommentError>{loadError}</CommentError>}

        {target ? (
          <section className={`${COMMENT_CARD} ring-2 ring-primary-fixed`} aria-label={t("newAria")}>
            <p className="flex items-start gap-1.5 text-caption font-bold text-primary">
              <Icon name="comment-add" size={13} className="shrink-0 mt-px" />
              <span className="min-w-0 break-words">{t("pinTarget", { label: target.label, version: versionLabel })}</span>
            </p>
            <Composer placeholder={t("writePlaceholder")} submitLabel={t("post")} autoFocus onSubmit={onPost} onCancel={onCancelTarget} />
          </section>
        ) : commentBlockedReason ? (
          <div className="flex items-start gap-2 bg-info-soft text-info rounded-control px-3 py-2.5">
            <Icon name="info" size={15} className="shrink-0 mt-0.5" />
            <p className="text-body">{commentBlockedReason}</p>
          </div>
        ) : (
          <p className="text-caption text-on-surface-variant leading-relaxed">{t("hint")}</p>
        )}

        {focus && (
          <div className="flex items-center justify-between gap-2 bg-primary-soft rounded-control pl-3 pr-1 py-1">
            <span className="text-caption font-semibold text-primary-hover">{t("focusing")}</span>
            <Button size="sm" variant="ghost" onClick={onClearFocus} className={COMMENT_ACTION}>
              {t("clearFocus")}
            </Button>
          </div>
        )}

        {visible.length === 0 ? (
          <EmptyState icon="feedback" title={tab === "open" ? t("emptyOpen") : t("emptyClosed")} />
        ) : (
          <ul className="flex flex-col gap-2.5">
            {visible.map((c) => (
              <CommentCard
                key={c.comment_id}
                projectId={projectId}
                comment={c}
                role={role}
                canCreateCr={canCreateCr}
                anchorMissing={!anchorExists(c)}
                highlighted={c.comment_id === highlightId}
                onReply={onReply}
                onResolve={onResolve}
                onLocate={onLocate}
              />
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
}
