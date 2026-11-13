"use client";

import { useState, type ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import Avatar from "@/components/ui/Avatar";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import DropdownMenu, { type DropdownMenuItem } from "@/components/ui/DropdownMenu";
import Icon from "@/components/ui/Icon";
import IconButton from "@/components/ui/IconButton";
import { tStep, type Locale } from "@/lib/i18n";
import { COMMENT_TEXT_MAX, KEEP_REASON_MIN_LENGTH, type CommentPerson, type SrsComment } from "@/types/comment";

/**
 * Mảnh giao diện dùng chung của comment ở hai nơi: panel trang đọc (`CommentPanel`) và panel góp ý trong workspace
 * (`CommentsPanel`). Hai panel có luồng xử lý khác nhau nhưng phải nhìn như một tính năng: cùng thẻ, cùng hàng tác giả,
 * cùng nhãn trạng thái, cùng ô soạn. Markup tự viết phẳng, không viền; tách lớp bằng nền.
 */

/**
 * Đầu panel dính trong vùng cuộn của panel (nền xám): cùng kiểu mép dưới mềm với `STICKY_FADE`
 * (`components/ui/sticky-styles.ts`), chỉ khác màu dải = nền panel. Hằng đó tô dải trắng cho trang nền trắng; viết
 * nguyên văn ở đây để Tailwind thấy class. Vùng cuộn không có `pt`: khoảng trống 16px nằm ở nội dung ngay dưới thanh.
 */
export const PANEL_STICKY =
  "sticky top-0 z-10 bg-surface-container after:content-[''] after:absolute after:inset-x-0 after:top-full after:h-4 after:pointer-events-none after:bg-linear-to-b after:from-surface-container after:from-40% after:to-transparent";

/** Khung thẻ comment (chưa có nền) — nền chọn theo trạng thái, đừng ghép hai class nền vào cùng thẻ. */
export const COMMENT_CARD_FRAME = "rounded-card p-3.5 flex flex-col gap-2.5";

/** Thẻ comment: trắng trên nền xám của panel. */
export const COMMENT_CARD = `bg-surface-container-lowest ${COMMENT_CARD_FRAME}`;

/** Ô nhập của ô soạn / trả lời / lý do: nền xám nhạt trong khối trắng, focus ring tím. */
export const COMMENT_TEXTAREA =
  "w-full bg-surface-container-low rounded-inner px-3 py-2 text-body text-on-surface placeholder:text-on-surface-muted resize-y focus:outline-none focus-visible:ring-2 focus-visible:ring-primary";

/** Nút hành động trong thẻ: 32px trên desktop, 40px suốt dải sheet (< 1024px, thường là cảm ứng). */
export const COMMENT_ACTION = "max-lg:h-10";

export const formatCommentTime = (iso: string, locale: Locale): string =>
  new Date(iso).toLocaleString(locale === "en" ? "en-US" : "vi-VN", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

const ROLES = ["lead", "analyst", "viewer"] as const;
const isRole = (role: string): role is (typeof ROLES)[number] => (ROLES as readonly string[]).includes(role);

/**
 * Tác giả: avatar + tên đậm + vai trò, giờ mờ. Mặc định avatar 32px, khoảng 12px (thẳng cột với `BODY_INDENT`);
 * `small` cho trả lời: avatar 24px, khoảng 8px (chữ trả lời thụt `pl-8`).
 */
export function CommentAuthor({
  person,
  role,
  at,
  fallbackName,
  small = false,
}: {
  person: CommentPerson | null;
  role: string;
  at: string;
  /** Tên thay khi người viết đã rời dự án / không có tên. */
  fallbackName: string;
  small?: boolean;
}) {
  const t = useTranslations("workspace.comments");
  const locale = useLocale() as Locale;
  const name = person?.name || person?.email || fallbackName;
  return (
    <div className={`flex items-center min-w-0 ${small ? "gap-2" : "gap-3"}`}>
      <Avatar name={person?.name} email={person?.email} className={small ? "w-6! h-6! text-caption!" : undefined} />
      <p className="min-w-0 flex flex-wrap items-baseline gap-x-1.5 leading-snug">
        <span className={`${small ? "text-caption" : "text-body"} font-bold text-on-surface`}>{name}</span>
        <span className="text-caption text-on-surface-variant">{isRole(role) ? t(`role.${role}`) : role}</span>
        <span aria-hidden className="text-caption text-on-surface-muted">
          ·
        </span>
        <time dateTime={at} className="text-caption text-on-surface-muted tabular-nums whitespace-nowrap">
          {formatCommentTime(at, locale)}
        </time>
      </p>
    </div>
  );
}

/** Nhãn trạng thái. Comment đang mở có nhãn ở panel đọc (hai tab trộn trạng thái), workspace chỉ gắn nhãn khi đã đóng. */
export function CommentStatusBadge({ comment, showOpen = true }: { comment: SrsComment; showOpen?: boolean }) {
  const t = useTranslations("workspace.comments.thread");
  if (comment.status === "open")
    return showOpen ? (
      <Badge tone="warning" dot className="shrink-0">
        {t("status.open")}
      </Badge>
    ) : null;
  if (comment.status === "resolved")
    return (
      <Badge tone="success" dot className="shrink-0">
        {t("status.resolved")}
      </Badge>
    );
  return (
    <Badge tone="primary" dot className="shrink-0">
      {comment.cr_id ? t("convertedTo", { cr: comment.cr_id }) : t("status.converted")}
    </Badge>
  );
}

/** Thụt của thân thẻ = avatar 32px + khoảng 12px: nội dung, trả lời, hành động thẳng cột với tên người viết. */
const BODY_INDENT = "pl-11";

/** Click từ phần tử tự có hành động (nút, link, ô nhập) hoặc khi đang bôi chọn chữ thì không tính là bấm thẻ. */
const isOwnAction = (target: EventTarget | null): boolean =>
  target instanceof Element && !!target.closest("button, a, input, textarea, select, label");

/**
 * Dải ngữ cảnh đầu thẻ: comment ghim vào đâu (mục › đoạn) + mã + đoạn trích. Có `onLocate` thì cả dải là nút (bàn phím và
 * trình đọc màn hình vào được); thẻ bọc ngoài cũng bấm được bằng chuột ở bất kỳ chỗ trống nào.
 */
function CommentContext({
  label,
  meta,
  excerpt,
  missing,
  onLocate,
  locateLabel,
}: {
  label: string;
  meta: string;
  excerpt?: string | null;
  missing: boolean;
  onLocate?: () => void;
  locateLabel: string;
}) {
  const t = useTranslations("workspace.comments.thread");
  const body = (
    <>
      <span className="flex items-start gap-1.5 min-w-0">
        <Icon name="file" size={13} className="shrink-0 mt-[3px]" />
        <span className="min-w-0 flex-1 font-semibold break-words">
          <span className="sr-only">{t("pinnedPrefix")} </span>
          {label}
        </span>
        <span className="shrink-0 text-on-surface-muted font-normal tabular-nums">{meta}</span>
      </span>
      {excerpt && <span className="block pl-[19px] text-on-surface-variant italic line-clamp-2">{excerpt}</span>}
      {missing && (
        <span className="flex items-start gap-1.5 text-accent-gold-text">
          <Icon name="warning" size={13} className="shrink-0 mt-[3px]" />
          <span>{t("anchorMissing")}</span>
        </span>
      )}
    </>
  );
  const frame = "w-full flex flex-col gap-1 rounded-inner px-2.5 py-2 text-left text-caption leading-snug bg-surface-container-low";
  return onLocate ? (
    <button
      type="button"
      onClick={onLocate}
      title={locateLabel}
      className={`${frame} text-on-surface-variant cursor-pointer transition-colors group-hover:bg-primary-soft group-hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary`}
    >
      {body}
    </button>
  ) : (
    <div className={`${frame} text-on-surface-variant`}>{body}</div>
  );
}

/**
 * Khung thẻ comment dùng chung, phân tầng từ ngoài vào trong:
 * 1. dải ngữ cảnh (ghim vào đâu) - nhạt, nhỏ;
 * 2. người viết: avatar + tên đậm + vai trò, giờ mờ; nhãn trạng thái bên phải;
 * 3. thân thụt thẳng cột với tên: nội dung, chuỗi trả lời, hành động (`children`).
 *
 * Bấm vào chỗ trống bất kỳ của thẻ ⇒ `onLocate` (cuộn tài liệu tới chỗ ghim); nút, link, ô nhập bên trong giữ hành động
 * riêng, bôi chọn chữ không kích hoạt.
 */
export function CommentCardShell({
  as: Tag = "li",
  id,
  ariaLabel,
  highlighted = false,
  context,
  author,
  badge,
  headerActions,
  onLocate,
  locateLabel,
  children,
}: {
  as?: "li" | "article";
  id?: string;
  ariaLabel: string;
  highlighted?: boolean;
  context: { label: string; meta: string; excerpt?: string | null; missing?: boolean };
  author: { person: CommentPerson | null; role: string; at: string; fallbackName: string };
  badge?: ReactNode;
  /** Nút biểu tượng cạnh nhãn trạng thái (✓ xử lý, ⋯ thêm) — theo vai trò, không có thì để trống. */
  headerActions?: ReactNode;
  /** Không truyền (hoặc chỗ ghim đã mất) ⇒ thẻ không bấm được. */
  onLocate?: () => void;
  locateLabel: string;
  children: ReactNode;
}) {
  const locatable = !!onLocate && !context.missing;
  return (
    <Tag
      id={id}
      aria-label={ariaLabel}
      onClick={
        locatable
          ? (e) => {
              if (isOwnAction(e.target) || window.getSelection()?.toString()) return;
              onLocate();
            }
          : undefined
      }
      className={`group ${COMMENT_CARD_FRAME} scroll-my-4 ${locatable ? "cursor-pointer" : ""} ${
        highlighted ? "bg-primary-soft ring-2 ring-primary" : "bg-surface-container-lowest"
      }`}
    >
      <CommentContext
        label={context.label}
        meta={context.meta}
        excerpt={context.excerpt}
        missing={!!context.missing}
        onLocate={locatable ? onLocate : undefined}
        locateLabel={locateLabel}
      />
      <div className="flex items-center justify-between gap-2 pt-1">
        <CommentAuthor person={author.person} role={author.role} at={author.at} fallbackName={author.fallbackName} />
        <div className="flex items-center gap-1 shrink-0">
          {badge}
          {headerActions}
        </div>
      </div>
      <div className={`${BODY_INDENT} -mt-1.5 flex flex-col gap-2.5 min-w-0`}>{children}</div>
    </Tag>
  );
}

/** Nội dung comment: chữ thân bài, giữ xuống dòng của người viết. */
export function CommentText({ text }: { text: string }) {
  return <p className="text-body text-on-surface leading-relaxed whitespace-pre-wrap break-words">{text}</p>;
}

/** Chuỗi trả lời: vạch "n trả lời" tách khỏi comment gốc, mỗi trả lời có avatar nhỏ + tên + giờ, chữ thẳng cột với tên. */
export function CommentReplies({ replies, fallbackName }: { replies: { author: CommentPerson | null; author_role: string; at: string; text: string }[]; fallbackName: string }) {
  const t = useTranslations("workspace.comments.thread");
  if (replies.length === 0) return null;
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center gap-2">
        <span className="text-caption font-semibold text-on-surface-variant whitespace-nowrap">{t("replyCount", { count: replies.length })}</span>
        <span aria-hidden className="h-px flex-1 bg-outline-variant" />
      </div>
      <ul className="flex flex-col gap-3" aria-label={t("repliesAria")}>
        {replies.map((r, i) => (
          <li key={i} className="flex flex-col gap-0.5">
            <CommentAuthor person={r.author} role={r.author_role} at={r.at} fallbackName={fallbackName} small />
            <p className="pl-8 text-body text-on-surface-dark leading-relaxed whitespace-pre-wrap break-words">{r.text}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Kiểm như BE (`createCommentSchema`) để khỏi tốn một lượt gọi; trả key để component dịch. */
export const validateCommentText = (text: string): "emptyText" | "tooLong" | null => {
  if (!text.trim()) return "emptyText";
  if (text.trim().length > COMMENT_TEXT_MAX) return "tooLong";
  return null;
};

/**
 * Ô trả lời luôn nằm cuối chuỗi trao đổi (kiểu ClickUp / Google Docs): thu gọn một dòng, bấm vào thì mở ra kèm Gửi / Huỷ.
 * `Ctrl/⌘ + Enter` để gửi, `Esc` để thu lại khi ô trống.
 */
export function CommentReplyBox({ onSubmit }: { onSubmit: (text: string) => Promise<void> }) {
  const t = useTranslations("workspace.comments.thread");
  const [text, setText] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const collapse = () => {
    setText("");
    setError(null);
    setExpanded(false);
  };
  const submit = async () => {
    const invalid = validateCommentText(text);
    if (invalid) return setError(invalid === "tooLong" ? t("tooLong", { max: COMMENT_TEXT_MAX }) : t("emptyText"));
    setBusy(true);
    setError(null);
    try {
      await onSubmit(text.trim());
      collapse();
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : t("sendFailed"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
      className="flex flex-col gap-2"
    >
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onFocus={() => setExpanded(true)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            void submit();
          } else if (e.key === "Escape" && !text.trim()) {
            e.stopPropagation();
            collapse();
            e.currentTarget.blur();
          }
        }}
        rows={expanded ? 3 : 1}
        maxLength={COMMENT_TEXT_MAX + 100}
        placeholder={t("replyPlaceholder")}
        aria-label={t("replyPlaceholder")}
        aria-invalid={error ? true : undefined}
        className={`${COMMENT_TEXTAREA} ${expanded ? "" : "resize-none! overflow-hidden"}`}
      />
      {expanded && (
        <div className="flex items-center justify-between gap-2">
          <CommentCounter length={text.trim().length} />
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={collapse} className={COMMENT_ACTION}>
              {t("cancel")}
            </Button>
            <Button size="sm" type="submit" loading={busy} className={COMMENT_ACTION}>
              {busy ? t("sending") : t("send")}
            </Button>
          </div>
        </div>
      )}
      {error && <CommentError>{error}</CommentError>}
    </form>
  );
}

/** Câu đầu menu xử lý: comment thuộc bước nào thì nói "Đã sửa" sẽ mở lại bước đó (FLF-271), không thì câu chung. */
export function useResolveNote(comment: SrsComment): string {
  const t = useTranslations("workspace.comments");
  const locale = useLocale() as Locale;
  const steps = comment.step_ids ?? [];
  return steps.length > 0 ? t("ownerStep", { steps: steps.map((id) => tStep(id, locale) || id).join(", ") }) : t("thread.resolveNote");
}

/**
 * Nút ✓ ở đầu thẻ: kết luận comment theo hai nhánh của BE. "Đã sửa" mở lại bước sở hữu mục được ghim nếu bước đó đã
 * duyệt (UC-47) ⇒ đầu menu nói trước điều đó; "Giữ nguyên…" mở ô lý do ngay trong thẻ (bắt buộc, ≥ `KEEP_REASON_MIN_LENGTH`).
 */
export function CommentResolveMenu({
  note,
  busy,
  onFixed,
  onKeep,
  onFixByChat,
}: {
  note: string;
  busy: boolean;
  onFixed: () => void;
  onKeep: () => void;
  /** Workspace (bản nháp, không phải mode 1): nhờ AI sửa qua chat — áp xong comment tự thành "Đã sửa". */
  onFixByChat?: () => void;
}) {
  const t = useTranslations("workspace.comments");
  return (
    <DropdownMenu
      header={<p className="text-caption text-on-surface-variant leading-snug">{note}</p>}
      items={[
        ...(onFixByChat ? [{ label: t("fixByChat"), icon: "pencil" as const, onSelect: onFixByChat, disabled: busy }] : []),
        { label: t("fixed"), icon: "check", onSelect: onFixed, disabled: busy },
        { label: t("thread.keepEllipsis"), icon: "info", onSelect: onKeep, disabled: busy },
      ]}
      trigger={(props) => (
        <IconButton {...props} icon="check-circle" size="sm" label={t("thread.resolveMenu")} disabled={busy} className="max-lg:w-10 max-lg:h-10" />
      )}
    />
  );
}

/** Menu "⋯" cho thao tác ít dùng (Tạo CR, Nhờ AI sửa). Không có mục nào thì không vẽ. */
export function CommentMoreMenu({ items }: { items: DropdownMenuItem[] }) {
  const t = useTranslations("workspace.comments.thread");
  if (items.length === 0) return null;
  return (
    <DropdownMenu
      items={items}
      trigger={(props) => <IconButton {...props} icon="more-horizontal" size="sm" label={t("more")} className="max-lg:w-10 max-lg:h-10" />}
    />
  );
}

/** Ô lý do "Giữ nguyên" — lý do là BẮT BUỘC: nó là thứ duy nhất Lead có để hiểu vì sao không sửa. */
export function CommentKeepForm({ id, busy, onCancel, onSave }: { id: string; busy: boolean; onCancel: () => void; onSave: (reason: string) => void }) {
  const t = useTranslations("workspace.comments");
  const [reason, setReason] = useState("");
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={`keep-${id}`} className="text-caption font-bold text-on-surface-variant">
        {t("keepQuestion")}
      </label>
      <textarea
        id={`keep-${id}`}
        value={reason}
        onChange={(e) => setReason(e.target.value.slice(0, COMMENT_TEXT_MAX))}
        rows={2}
        autoFocus
        placeholder={t("keepPlaceholder")}
        className={COMMENT_TEXTAREA}
      />
      <div className="flex items-center justify-end gap-2">
        <Button size="sm" variant="ghost" onClick={onCancel} className={COMMENT_ACTION}>
          {t("cancel")}
        </Button>
        <Button size="sm" loading={busy} disabled={reason.trim().length < KEEP_REASON_MIN_LENGTH} onClick={() => onSave(reason.trim())} className={COMMENT_ACTION}>
          {t("saveReason")}
        </Button>
      </div>
    </div>
  );
}

/** Kết luận của comment đã xử lý (đã sửa / giữ nguyên + lý do) — ai mở lại cũng đọc được vì sao comment đóng. */
export function CommentResolutionNote({ comment }: { comment: SrsComment }) {
  const t = useTranslations("workspace.comments");
  if (!comment.resolution) return null;
  const fixed = comment.resolution.kind === "fixed";
  return (
    <p className="flex items-start gap-1.5 text-caption text-on-surface-variant bg-surface-container-low rounded-inner px-2.5 py-1.5">
      <Icon name={fixed ? "check-circle" : "info"} size={13} className="shrink-0 mt-px" />
      <span>{fixed ? t("resolvedFixed") : t("resolvedKept", { reason: comment.resolution.reason ?? "" })}</span>
    </p>
  );
}

/** Bộ đếm ký tự; vượt trần thì đỏ. */
export function CommentCounter({ length }: { length: number }) {
  return (
    <span className={`text-caption tabular-nums ${length > COMMENT_TEXT_MAX ? "text-error" : "text-on-surface-muted"}`}>
      {length}/{COMMENT_TEXT_MAX}
    </span>
  );
}

/** Dòng lỗi gắn ngay dưới chỗ gây lỗi, đọc lên ngay (`role="alert"`). */
export function CommentError({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="flex items-start gap-1.5 text-caption text-error">
      <Icon name="warning" size={13} className="shrink-0 mt-px" />
      <span>{children}</span>
    </p>
  );
}
