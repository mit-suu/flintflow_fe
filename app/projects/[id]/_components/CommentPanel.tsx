"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { crPrefillHref, titleFromInstruction } from "./mode1/prefill";
import { COMMENT_TEXT_MAX, type CommentPerson, type CommentStatus, type SrsComment } from "@/types/comment";
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
  onResolve: (commentId: string) => Promise<void>;
}

const STATUS_BADGE: Record<CommentStatus, { text: string; style: string }> = {
  open: { text: "Đang mở", style: "bg-[#FFF4E0] text-[#8A5A00]" },
  resolved: { text: "Đã xử lý", style: "bg-[#E8F5EC] text-[#2D6A3E]" },
  converted: { text: "Đã thành CR", style: "bg-[#EEEDFB] text-[#4A42A8]" },
};

/** Hai tab của panel: việc còn phải làm, và lịch sử (đã xử lý hoặc đã thành CR). */
export type CommentTab = "open" | "closed";

export const commentTab = (c: SrsComment): CommentTab => (c.status === "open" ? "open" : "closed");

const TAB_LABEL: Record<CommentTab, string> = { open: "Đang mở", closed: "Đã đóng" };

const ROLE_LABEL: Record<OrgRole, string> = { lead: "Lead", analyst: "Analyst", viewer: "Viewer" };

const personName = (p: CommentPerson | null): string => p?.name || p?.email || "Thành viên đã rời";

const formatTime = (iso: string): string =>
  new Date(iso).toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

const inputClass =
  "w-full px-3 py-2 rounded-[10px] border-[1.5px] border-[#E4E1DC] focus:border-[#6A62C4] outline-none text-[12.5px] text-[#191817] bg-[#FAF9F7]";

/** Kiểm như BE (`createCommentSchema`) để khỏi tốn một lượt gọi; thông báo theo đặc tả UC-49. */
const validate = (text: string): string | null => {
  if (!text.trim()) return "Comment không được để trống.";
  if (text.trim().length > COMMENT_TEXT_MAX) return `Comment dài quá ${COMMENT_TEXT_MAX} ký tự.`;
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
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const invalid = validate(text);
    if (invalid) return setError(invalid);
    setBusy(true);
    setError(null);
    try {
      await onSubmit(text.trim());
      setText("");
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : "Không gửi được comment. Vui lòng thử lại.");
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
        <span className={`text-[10.5px] ${text.trim().length > COMMENT_TEXT_MAX ? "text-[#B03030]" : "text-[#A8A49C]"}`}>
          {text.trim().length}/{COMMENT_TEXT_MAX}
        </span>
        <div className="flex gap-1.5">
          {onCancel && (
            <button type="button" onClick={onCancel} className="px-2.5 py-1 rounded-[8px] border border-[#E4E1DC] bg-white text-[11.5px] font-semibold text-[#4B4842]">
              Huỷ
            </button>
          )}
          <button type="submit" disabled={busy} className="px-2.5 py-1 rounded-[8px] bg-[#191817] text-white text-[11.5px] font-bold disabled:opacity-50 cursor-pointer">
            {busy ? "Đang gửi…" : submitLabel}
          </button>
        </div>
      </div>
      {error && (
        <p role="alert" className="text-[11.5px] text-[#B03030]">
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
  const [replying, setReplying] = useState(false);
  const [resolveError, setResolveError] = useState<string | null>(null);
  const handler = role === "lead" || role === "analyst";
  const open = comment.status === "open";
  const badge = STATUS_BADGE[comment.status];

  const crHref = crPrefillHref(projectId, {
    title: titleFromInstruction(`${comment.comment_id}: ${comment.anchor.label}`),
    description: `${comment.text}\n\nVị trí ghim: ${comment.anchor.label} (bản ${comment.version.label}).`,
    source: "viewer_comment",
    ref: comment.comment_id,
    requester: personName(comment.author),
    comment_id: comment.comment_id,
  });

  return (
    <li
      id={`comment-${comment.comment_id}`}
      aria-label={`Comment ${comment.comment_id}`}
      className={`p-3 rounded-[12px] border bg-white flex flex-col gap-1.5 ${highlighted ? "border-[#6A62C4] ring-2 ring-[#DCD8F0]" : "border-[#ECEAE5]"}`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10.5px] font-bold text-[#6B6862]">
          {comment.comment_id} · Ghim vào: {comment.anchor.label} · bản {comment.version.label}
        </span>
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${badge.style}`}>
          {comment.status === "converted" && comment.cr_id ? `Đã thành ${comment.cr_id}` : badge.text}
        </span>
      </div>
      {anchorMissing && <p className="text-[11px] text-[#8A5A00] italic">Nội dung được ghim không còn trong phiên bản này.</p>}
      {comment.anchor.excerpt && (
        <blockquote className="text-[11px] text-[#6B6862] border-l-2 border-[#E4E1DC] pl-2 line-clamp-2">{comment.anchor.excerpt}</blockquote>
      )}
      <p className="text-[12.5px] text-[#191817] whitespace-pre-wrap break-words">{comment.text}</p>
      <span className="text-[10.5px] text-[#A8A49C]">
        {personName(comment.author)} ({ROLE_LABEL[comment.author_role]}) · {formatTime(comment.created_at)}
      </span>

      {comment.replies.length > 0 && (
        <ul className="flex flex-col gap-1.5 border-l-2 border-[#F0EEEA] pl-2.5 mt-1" aria-label="Trả lời">
          {comment.replies.map((r, i) => (
            <li key={i} className="flex flex-col">
              <p className="text-[12px] text-[#33312D] whitespace-pre-wrap break-words">{r.text}</p>
              <span className="text-[10.5px] text-[#A8A49C]">
                {personName(r.author)} ({ROLE_LABEL[r.author_role]}) · {formatTime(r.at)}
              </span>
            </li>
          ))}
        </ul>
      )}

      {replying ? (
        <Composer
          placeholder="Trả lời comment"
          submitLabel="Trả lời"
          autoFocus
          onSubmit={async (text) => {
            await onReply(comment.comment_id, text);
            setReplying(false);
          }}
          onCancel={() => setReplying(false)}
        />
      ) : (
        <div className="flex flex-wrap gap-1.5 mt-0.5">
          <button type="button" onClick={() => setReplying(true)} className="px-2 py-0.5 rounded-[7px] border border-[#E4E1DC] bg-white text-[11px] font-semibold text-[#4B4842]">
            Trả lời
          </button>
          {open && handler && (
            <button
              type="button"
              onClick={() => {
                setResolveError(null);
                onResolve(comment.comment_id).catch((err: unknown) =>
                  setResolveError(err instanceof Error && err.message ? err.message : "Không đánh dấu được. Vui lòng thử lại.")
                );
              }}
              className="px-2 py-0.5 rounded-[7px] border border-[#E4E1DC] bg-white text-[11px] font-semibold text-[#2D6A3E]"
            >
              Đánh dấu đã xử lý
            </button>
          )}
          {open && handler && canCreateCr && (
            <Link href={crHref} className="px-2 py-0.5 rounded-[7px] bg-[#EEEDFB] text-[11px] font-bold text-[#4A42A8]">
              Tạo CR từ comment
            </Link>
          )}
        </div>
      )}
      {resolveError && (
        <p role="alert" className="text-[11px] text-[#B03030]">
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
  const counts: Record<CommentTab, number> = { open: 0, closed: 0 };
  for (const c of comments) counts[commentTab(c)] += 1;
  const visible = comments.filter(
    (c) =>
      commentTab(c) === tab &&
      (!focus || (c.anchor.section_id === focus.section_id && (focus.block_index === null || c.anchor.block_index === focus.block_index)))
  );

  return (
    <aside aria-label="Comment" className="flex flex-col gap-3 bg-[#FAF9F7] border border-[#ECEAE5] rounded-[14px] p-3.5">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-extrabold text-[13px] text-[#191817]">Comment</h2>
        <div role="tablist" aria-label="Lọc comment" className="flex p-0.5 rounded-[9px] bg-[#F0EEEA]">
          {(["open", "closed"] as const).map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={tab === t}
              onClick={() => onTabChange(t)}
              className={`px-2.5 py-1 rounded-[7px] text-[11px] font-bold cursor-pointer transition-colors ${
                tab === t ? "bg-white text-[#191817] shadow-sm" : "text-[#8A867E] hover:text-[#191817]"
              }`}
            >
              {TAB_LABEL[t]} ({counts[t]})
            </button>
          ))}
        </div>
      </div>

      {target ? (
        <div className="flex flex-col gap-1.5 bg-white border border-[#DCD8F0] rounded-[12px] p-3" aria-label="Comment mới">
          <span className="text-[11px] font-bold text-[#4A42A8]">
            Ghim vào: {target.label} · bản {versionLabel}
          </span>
          <Composer placeholder="Viết comment" submitLabel="Đăng comment" autoFocus onSubmit={onPost} onCancel={onCancelTarget} />
        </div>
      ) : commentBlockedReason ? (
        <p className="text-[11.5px] text-[#8A5A00] bg-[#FFF8EC] border border-[#F0DFB4] rounded-[10px] px-3 py-2">{commentBlockedReason}</p>
      ) : (
        <p className="text-[11.5px] text-[#6B6862]">Rê chuột lên một mục hoặc đoạn trong tài liệu rồi bấm 💬 để ghim comment.</p>
      )}

      {focus && (
        <button type="button" onClick={onClearFocus} className="self-start text-[11px] font-semibold text-[#4A42A8] underline">
          Đang lọc theo chỗ ghim — xem tất cả comment
        </button>
      )}

      {visible.length === 0 ? (
        <p className="text-[11.5px] text-[#A8A49C] italic">{tab === "open" ? "Không có comment nào đang mở." : "Chưa có comment nào được xử lý hay chuyển thành CR."}</p>
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
