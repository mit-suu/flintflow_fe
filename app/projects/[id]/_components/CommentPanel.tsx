"use client";

import { useState, type FormEvent } from "react";
import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import { crPrefillHref, titleFromInstruction } from "./mode1/prefill";
import { COMMENT_TEXT_MAX, type CommentPerson, type CommentStatus, type SrsComment } from "@/types/comment";
import type { OrgRole } from "@/types/organization";
import type { Locale } from "@/lib/i18n";

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
  onResolve: (commentId: string) => Promise<void>;
}

/** Chữ của nhãn: `workspace.comments.thread.status.<status>`. */
const STATUS_STYLE: Record<CommentStatus, string> = {
  open: "bg-accent-gold-soft text-accent-gold-text",
  resolved: "bg-success-soft text-success",
  converted: "bg-primary-soft text-primary-hover",
};

/** Hai tab của panel: việc còn phải làm, và lịch sử (đã xử lý hoặc đã thành CR). */
export type CommentTab = "open" | "closed";

export const commentTab = (c: SrsComment): CommentTab => (c.status === "open" ? "open" : "closed");

/** `formerMember`: tên thay cho thành viên đã rời dự án. */
const personName = (p: CommentPerson | null, formerMember: string): string => p?.name || p?.email || formerMember;

const formatTime = (iso: string, locale: Locale): string =>
  new Date(iso).toLocaleString(locale === "en" ? "en-US" : "vi-VN", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

const inputClass =
  "w-full px-3 py-2 rounded-control border-[1.5px] border-outline focus:border-primary outline-none text-body text-on-surface bg-surface-container-low";

/** Kiểm như BE (`createCommentSchema`) để khỏi tốn một lượt gọi; thông báo theo đặc tả UC-49 (trả key để component dịch). */
const validate = (text: string): "emptyText" | "tooLong" | null => {
  if (!text.trim()) return "emptyText";
  if (text.trim().length > COMMENT_TEXT_MAX) return "tooLong";
  return null;
};

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
    const invalid = validate(text);
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
    <form onSubmit={(e) => void submit(e)} className="flex flex-col gap-1.5">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={3}
        maxLength={COMMENT_TEXT_MAX + 100}
        placeholder={placeholder}
        aria-label={placeholder}
        autoFocus={autoFocus}
        className={inputClass}
      />
      <div className="flex items-center justify-between gap-2">
        <span className={`text-caption ${text.trim().length > COMMENT_TEXT_MAX ? "text-error" : "text-on-surface-subtle"}`}>
          {text.trim().length}/{COMMENT_TEXT_MAX}
        </span>
        <div className="flex gap-1.5">
          {onCancel && (
            <button type="button" onClick={onCancel} className="px-2.5 py-1 rounded-control border border-outline bg-white text-body font-semibold text-on-surface-medium">
              {t("cancel")}
            </button>
          )}
          <button type="submit" disabled={busy} className="px-2.5 py-1 rounded-control bg-on-surface text-white text-body font-bold disabled:opacity-50 cursor-pointer">
            {busy ? t("sending") : submitLabel}
          </button>
        </div>
      </div>
      {error && (
        <p role="alert" className="text-body text-error">
          {error}
        </p>
      )}
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
}: {
  projectId: string;
  comment: SrsComment;
  role: OrgRole | null;
  canCreateCr: boolean;
  anchorMissing: boolean;
  highlighted: boolean;
  onReply: (commentId: string, text: string) => Promise<void>;
  onResolve: (commentId: string) => Promise<void>;
}) {
  const t = useTranslations("workspace.comments.thread");
  const tRole = useTranslations("workspace.comments.role");
  const locale = useLocale();
  const formerMember = t("formerMember");
  const [replying, setReplying] = useState(false);
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

  return (
    <li
      id={`comment-${comment.comment_id}`}
      aria-label={t("cardAria", { id: comment.comment_id })}
      className={`p-3 rounded-card border bg-white flex flex-col gap-1.5 ${highlighted ? "border-primary ring-2 ring-outline-purple" : "border-outline-variant"}`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-caption font-bold text-on-surface-variant">
          {t("pinnedHeader", { id: comment.comment_id, label: comment.anchor.label, version: comment.version.label })}
        </span>
        <span className={`text-caption font-bold px-2 py-0.5 rounded-full shrink-0 ${STATUS_STYLE[comment.status]}`}>
          {comment.status === "converted" && comment.cr_id ? t("convertedTo", { cr: comment.cr_id }) : t(`status.${comment.status}`)}
        </span>
      </div>
      {anchorMissing && <p className="text-caption text-accent-gold-text italic">{t("anchorMissing")}</p>}
      {comment.anchor.excerpt && (
        <blockquote className="text-caption text-on-surface-variant border-l-2 border-outline pl-2 line-clamp-2">{comment.anchor.excerpt}</blockquote>
      )}
      <p className="text-body text-on-surface whitespace-pre-wrap break-words">{comment.text}</p>
      <span className="text-caption text-on-surface-subtle">
        {personName(comment.author, formerMember)} ({tRole(comment.author_role)}) · {formatTime(comment.created_at, locale)}
      </span>

      {comment.replies.length > 0 && (
        <ul className="flex flex-col gap-1.5 border-l-2 border-outline-subtle pl-2.5 mt-1" aria-label={t("repliesAria")}>
          {comment.replies.map((r, i) => (
            <li key={i} className="flex flex-col">
              <p className="text-body text-on-surface-dark whitespace-pre-wrap break-words">{r.text}</p>
              <span className="text-caption text-on-surface-subtle">
                {personName(r.author, formerMember)} ({tRole(r.author_role)}) · {formatTime(r.at, locale)}
              </span>
            </li>
          ))}
        </ul>
      )}

      {replying ? (
        <Composer
          placeholder={t("replyPlaceholder")}
          submitLabel={t("reply")}
          autoFocus
          onSubmit={async (text) => {
            await onReply(comment.comment_id, text);
            setReplying(false);
          }}
          onCancel={() => setReplying(false)}
        />
      ) : (
        <div className="flex flex-wrap gap-1.5 mt-0.5">
          <button type="button" onClick={() => setReplying(true)} className="px-2 py-0.5 rounded-control border border-outline bg-white text-caption font-semibold text-on-surface-medium">
            {t("reply")}
          </button>
          {open && handler && (
            <button
              type="button"
              onClick={() => {
                setResolveError(null);
                onResolve(comment.comment_id).catch((err: unknown) =>
                  setResolveError(err instanceof Error && err.message ? err.message : t("resolveFailed"))
                );
              }}
              className="px-2 py-0.5 rounded-control border border-outline bg-white text-caption font-semibold text-success"
            >
              {t("markResolved")}
            </button>
          )}
          {open && handler && canCreateCr && (
            <Link href={crHref} className="px-2 py-0.5 rounded-control bg-primary-soft text-caption font-bold text-primary-hover">
              {t("createCr")}
            </Link>
          )}
        </div>
      )}
      {resolveError && (
        <p role="alert" className="text-caption text-error">
          {resolveError}
        </p>
      )}
    </li>
  );
}

/**
 * UC-49 Comment on SRS Content — panel bên phải trang đọc tài liệu. Comment không đổi nội dung (BR-05): Analyst/Lead
 * "Đánh dấu đã xử lý", hoặc sau baseline "Tạo CR từ comment" (mở form UC-41 điền sẵn nguồn "Góp ý của người xem",
 * người yêu cầu = tác giả comment).
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
    <aside aria-label={t("title")} className="flex flex-col gap-3 bg-surface-container-low border border-outline-variant rounded-card p-3.5">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-extrabold text-body text-on-surface">{t("title")}</h2>
        <div role="tablist" aria-label={t("filterAria")} className="flex p-0.5 rounded-control bg-surface-container-high">
          {(["open", "closed"] as const).map((value) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={tab === value}
              onClick={() => onTabChange(value)}
              className={`px-2.5 py-1 rounded-inner text-caption font-bold cursor-pointer transition-colors ${
                tab === value ? "bg-white text-on-surface shadow-sm" : "text-on-surface-muted hover:text-on-surface"
              }`}
            >
              {t("tabCount", { label: t(`tab.${value}`), count: counts[value] })}
            </button>
          ))}
        </div>
      </div>

      {target ? (
        <div className="flex flex-col gap-1.5 bg-white border border-outline-purple rounded-card p-3" aria-label={t("newAria")}>
          <span className="text-caption font-bold text-primary-hover">
            {t("pinTarget", { label: target.label, version: versionLabel })}
          </span>
          <Composer placeholder={t("writePlaceholder")} submitLabel={t("post")} autoFocus onSubmit={onPost} onCancel={onCancelTarget} />
        </div>
      ) : commentBlockedReason ? (
        <p className="text-body text-accent-gold-text bg-accent-gold-soft border border-accent-gold-border rounded-control px-3 py-2">{commentBlockedReason}</p>
      ) : (
        <p className="text-body text-on-surface-variant">{t("hint")}</p>
      )}

      {focus && (
        <button type="button" onClick={onClearFocus} className="self-start text-caption font-semibold text-primary-hover underline">
          {t("clearFocus")}
        </button>
      )}

      {visible.length === 0 ? (
        <p className="text-body text-on-surface-subtle italic">{tab === "open" ? t("emptyOpen") : t("emptyClosed")}</p>
      ) : (
        <ul className="flex flex-col gap-2">
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
            />
          ))}
        </ul>
      )}
    </aside>
  );
}
