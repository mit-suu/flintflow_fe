"use client";

import { useState, useRef, useEffect } from "react";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import type { ChatMessage, KnowledgeCitation } from "@/types/chat";
import { parseChatQuestion, replyContainsQuestion } from "@/lib/question-options";
import { displayUserText } from "./user-text";
import KnowledgeAnswer from "./KnowledgeAnswer";

type KnowledgeShape = { reply: string; grounded: boolean; citations: KnowledgeCitation[] };

/**
 * Tin của lượt hỏi tri thức (`pipeline-contract.md` §1.2): tin CHAT mang thêm `grounded` + `citations`.
 * Nhận theo hình dữ liệu, vì transcript lưu đúng object đó — tin cũ và tin mới cùng một đường đọc.
 */
export const knowledgeShapeOf = (data: object): KnowledgeShape | null => {
  const d = data as { reply?: unknown; grounded?: unknown; citations?: unknown };
  if (typeof d.reply !== "string" || typeof d.grounded !== "boolean" || !Array.isArray(d.citations)) return null;
  return { reply: d.reply, grounded: d.grounded, citations: d.citations as KnowledgeCitation[] };
};

interface ChatBubbleProps {
  message: ChatMessage;
  messageIndex?: number;
  onRequestRollback?: (index: number) => void;
  disabled?: boolean;
  isStreaming?: boolean;
  /** Bong bóng hỏi của step đang chạy: nhãn "Chỉ trao đổi" không có nghĩa gì ở đây. */
  hideBadge?: boolean;
}

/** Nhãn của một tin AI — key trong `workspace.chatBubble.badge`, component dịch lúc render. */
export type WriteBadgeKey = "chatOnly" | "pending" | "nothingWritten" | "applied" | "unchanged" | "knowledge" | "crCreated";

export interface WriteBadge {
  key: WriteBadgeKey;
  /** Số thay đổi thật (`pending` / `applied`). */
  count?: number;
  /** FLF-318: mã change request đã tạo từ bản xem trước (`crCreated`). */
  crId?: string;
  wrote: boolean;
}

/**
 * BUG-09: chat từng nói "đã thêm UC18, UC19" trong khi Spine không đổi gì. Mỗi tin nhắn của AI nay mang
 * một nhãn nói rõ nó đã GHI hay chỉ TRAO ĐỔI: chỉ tin nhắn mang bản xem trước thay đổi (`change_preview`)
 * mới được nói là có ghi, và con số là số thay đổi thật trong bản xem trước đó.
 */
export const writeBadgeOf = (message: ChatMessage): WriteBadge | null => {
  if (message.role !== "ai") return null;
  const raw = (message.content ?? "").trim();
  if (!raw.startsWith("{")) return { key: "chatOnly", wrote: false };
  try {
    const data = JSON.parse(raw) as { kind?: unknown; changes?: unknown; change_count?: unknown };
    if (data.kind === "change_preview") {
      // FLF-244: BE chỉ lưu `change_count`; tin cũ còn mảng `changes`
      const count = typeof data.change_count === "number" ? data.change_count : Array.isArray(data.changes) ? data.changes.length : 0;
      // FLF-300: bản xem trước lỗi / rỗng không có gì để xác nhận
      return count > 0 ? { key: "pending", count, wrote: false } : { key: "nothingWritten", wrote: false };
    }
    // FLF-318: bản xem trước đã thành change request — không còn chờ xác nhận (tài liệu đổi khi CR được ghi)
    if (data.kind === "change_cr") {
      const crId = (data as { cr_id?: unknown }).cr_id;
      const count = typeof data.change_count === "number" ? data.change_count : 0;
      return { key: "crCreated", count, crId: typeof crId === "string" ? crId : "CR", wrote: false };
    }
    if (data.kind === "change_applied") {
      const count = typeof (data as { count?: unknown }).count === "number" ? (data as { count: number }).count : 0;
      return count > 0 ? { key: "applied", count, wrote: true } : { key: "unchanged", wrote: false };
    }
    if (data.kind === "change_clarification" || data.kind === "change_error") return { key: "nothingWritten", wrote: false };
    // FLF-279: lượt tri thức cũng không ghi gì vào Spine, nhưng "Chỉ trao đổi" không nói được nó đã tra
    // kho tri thức. Phải xét TRƯỚC nhánh `questions` bên dưới: tin tri thức mang `questions: []` nên
    // nhánh đó sẽ nuốt nó và trả `null` ⇒ mất nhãn.
    // Cùng một nhãn cho cả hai trạng thái: khối trả lời đã tự nói "Không đủ căn cứ", nhãn nhắc lại thì
    // một tin hiện câu đó hai lần.
    if (typeof (data as { grounded?: unknown }).grounded === "boolean") {
      return { key: "knowledge", wrote: false };
    }
    // Lượt hỏi của bước (lời đáp + câu hỏi): không phải hỏi đáp tự do, nhãn "Chỉ trao đổi" không có nghĩa gì
    if (Array.isArray((data as { questions?: unknown }).questions)) return null;
  } catch {
    return { key: "chatOnly", wrote: false };
  }
  return { key: "chatOnly", wrote: false };
};

export default function ChatBubble({
  message,
  messageIndex,
  onRequestRollback,
  disabled = false,
  isStreaming = false,
  hideBadge = false,
}: ChatBubbleProps) {
  const t = useTranslations("workspace.chatBubble");
  const locale = useLocale();
  const format = useFormatter();
  const isUser = message.role === "user";
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (!message.content) return;
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formatTimestamp = (dateStr?: string) => {
    if (!dateStr) return "";
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return "";
      return format.dateTime(d, { hour: "numeric", minute: "2-digit" });
    } catch (_) {
      return "";
    }
  };

  /**
   * T20: BE trả `reply` sạch — luồng SSE stream `text-delta` rồi đóng bằng `finish` mang object đã parse,
   * và transcript lưu chính object đó. Nên chỉ còn MỘT tầng: parse JSON, lấy `reply`; không parse được
   * thì hiển thị nguyên văn.
   *
   * Bốn tầng cũ (regex vớt `"reply"` khi JSON bị cắt giữa chừng) tồn tại vì prompt Discovery cũ bắt model
   * trả một object lớn kèm khối tự chấm tiến độ, và FE đọc từng mẩu trong lúc stream. Discovery giờ là
   * step chạy qua step runner, tiến độ đọc từ Spine — không còn gì để vớt.
   */
  const parseAiMessage = (content: string): { reply: string; openQuestions: string[]; knowledge: KnowledgeShape | null } => {
    const raw = (content ?? "").trim();
    if (!raw) return { reply: "", openQuestions: [], knowledge: null };
    if (!raw.startsWith("{")) return { reply: raw, openQuestions: [], knowledge: null };
    try {
      const data: unknown = JSON.parse(raw);
      if (data && typeof data === "object" && typeof (data as { reply?: unknown }).reply === "string") {
        // FLF-279: nhận ra lượt tri thức bằng HÌNH của dữ liệu, không bằng một cờ riêng — transcript lưu
        // đúng object này, nên tin tải lại từ phiên cũ đi cùng một đường với tin vừa về.
        const knowledge = knowledgeShapeOf(data);
        if (knowledge) return { reply: knowledge.reply, openQuestions: [], knowledge };
        // FLF-220: câu mở (không có lựa chọn) nằm ngay trong tin nhắn AI; câu `inline` chỉ bỏ khi `reply` đã chứa nó; trả lời bằng ô chat; câu có lựa chọn ở thẻ hỏi
        const questions = (data as { questions?: unknown }).questions;
        const reply = (data as { reply: string }).reply;
        const openQuestions = (Array.isArray(questions) ? questions : [])
          .map(parseChatQuestion)
          .flatMap((q) => (q && q.options.length === 0 && !(q.inline && replyContainsQuestion(reply, q.question)) ? [q.question] : []));
        return { reply, openQuestions, knowledge: null };
      }
    } catch (_) {
      // JSON chưa đủ (đang stream) — hiện nguyên văn, ticker bên dưới vẫn chạy
    }
    return { reply: raw, openQuestions: [], knowledge: null };
  };

  const parsed = parseAiMessage(message.content);
  const writeBadge = hideBadge ? null : writeBadgeOf(message);

  // Smooth continuous typewriter ticker for streaming
  const [displayedReply, setDisplayedReply] = useState(parsed.reply);
  const targetReplyRef = useRef(parsed.reply);

  useEffect(() => {
    targetReplyRef.current = parsed.reply;
  }, [parsed.reply]);

  // Khi không stream, UI dùng thẳng parsed.reply (activeReply) nên ticker chỉ chạy lúc stream
  useEffect(() => {
    if (!isStreaming) return;

    let animationFrameId: number;
    let lastTick = performance.now();

    const tick = (now: number) => {
      const elapsed = now - lastTick;
      // Run smoothly at ~16ms (60 FPS)
      if (elapsed >= 16) {
        lastTick = now;
        setDisplayedReply((current) => {
          const target = targetReplyRef.current;
          if (current.length >= target.length) return current;

          const diff = target.length - current.length;
          // Smooth adaptive speed: flows continuously, speeds up gracefully if far behind
          let step = 1;
          if (diff > 80) step = 5;
          else if (diff > 40) step = 3;
          else if (diff > 15) step = 2;

          return target.slice(0, current.length + step);
        });
      }
      animationFrameId = requestAnimationFrame(tick);
    };

    animationFrameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animationFrameId);
  }, [isStreaming]);

  const activeReply = isStreaming ? displayedReply : parsed.reply;

  const renderMarkdown = (text: string, showCursor: boolean = false) => {
    const lines = text.split("\n");
    return lines.map((line, i) => {
      const isLastLine = i === lines.length - 1;
      let formatted = line;
      // Auto-close incomplete bold tag while streaming
      const starCount = (line.match(/\*\*/g) || []).length;
      if (starCount % 2 !== 0) {
        formatted += "**";
      }
      // Bold text **text**
      formatted = formatted.replace(
        /\*\*(.*?)\*\*/g,
        "<strong>$1</strong>"
      );

      const cursorElement = showCursor && isLastLine ? (
        <span
          className=""
          style={{ verticalAlign: "-2px" }}
        />
      ) : null;

      if (line.trim().startsWith("- ") || line.trim().startsWith("* ")) {
        return (
          <li
            key={i}
            className="ml-5 list-disc text-heading text-on-surface leading-7"
          >
            <span dangerouslySetInnerHTML={{ __html: formatted.replace(/^[-*]\s+/, "") }} />
            {cursorElement}
          </li>
        );
      }
      if (line.trim() === "") {
        if (cursorElement) {
          return (
            <div key={i} className="h-4 flex items-center">
              {cursorElement}
            </div>
          );
        }
        return <div key={i} className="h-1.5" />;
      }
      return (
        <p
          key={i}
          className="text-heading text-on-surface leading-7"
        >
          <span dangerouslySetInnerHTML={{ __html: formatted }} />
          {cursorElement}
        </p>
      );
    });
  };

  if (isUser) {
    const formattedTime = formatTimestamp(message.createdAt);
    return (
      <div className="flex flex-col items-end group">
        <div className="relative bg-primary-soft text-on-surface px-4 py-2.5 rounded-[20px] max-w-[80%] text-heading leading-6">
          <p className="whitespace-pre-wrap">{displayUserText(message.content, locale)}</p>

          {/* Action bar: Timestamp, Copy, Rollback — nổi bên trái bong bóng khi hover, không chiếm chiều cao bong bóng */}
          <div className="absolute right-full top-1/2 -translate-y-1/2 mr-1.5 flex items-center gap-1.5 text-caption text-[#8A867E] select-none whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-150 pointer-events-none group-hover:pointer-events-auto">
            {formattedTime && (
              <span className="text-caption text-[#8A867E] leading-none">{formattedTime}</span>
            )}

            {/* Nút Sao chép */}
            <button
              type="button"
              onClick={handleCopy}
              className="p-1 hover:bg-[#E8E5F8] text-[#8A867E] hover:text-[#191817] rounded-[5px] transition-colors cursor-pointer flex items-center justify-center"
              title={copied ? t("copied") : t("copy")}
            >
              {copied ? (
                <span className="text-[#15803D] font-bold text-caption leading-none">✓</span>
              ) : (
                <svg
                  className="w-3.5 h-3.5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
                  <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
                </svg>
              )}
            </button>

            {/* Nút Hoàn tác */}
            {typeof messageIndex === "number" && onRequestRollback && (
              <button
                type="button"
                disabled={disabled}
                onClick={() => onRequestRollback(messageIndex)}
                className="p-1 hover:bg-[#E8E5F8] text-[#8A867E] hover:text-[#6A62C4] rounded-[5px] transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center"
                title={t("rollback")}
              >
                <svg
                  className="w-3.5 h-3.5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M9 14 4 9l5-5" />
                  <path d="M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5a5.5 5.5 0 0 1-5.5 5.5H11" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex">

      {/* Lời AI nằm thẳng trên nền khung chat như trả lời của một trợ lý, không bong bóng; tin user mới có bong bóng */}
      <div className="flex flex-col gap-1.5 flex-1 min-w-0">
        {(isStreaming || writeBadge) && (
        <div className="flex items-center gap-2">
          {isStreaming && (
            <span className="inline-flex items-center gap-1 text-caption font-bold text-[#6A62C4] bg-[#F2F1FB] px-2 py-0.5 rounded-full border border-[#DCD8F0] animate-pulse">
              <span className="w-1.5 h-1.5 rounded-full bg-[#6A62C4]" />
              {t("responding")}
            </span>
          )}
          {!isStreaming && writeBadge && (
            <span
              title={t("badgeHint")}
              className={`text-caption font-bold px-2 py-0.5 rounded-full border ${
                writeBadge.wrote ? "text-[#1F7A45] bg-[#EAF6EE] border-[#BEE3C8]" : "text-[#6B6862] bg-[#F5F3F0] border-[#ECEAE5]"
              }`}
            >
              {t(`badge.${writeBadge.key}`, { count: writeBadge.count ?? 0, crId: writeBadge.crId ?? "" })}
            </span>
          )}
        </div>
        )}
        <div className="space-y-3">
          <div className="text-[#191817] space-y-1.5 relative">
            {/* Lượt tri thức: không stream chữ nên ticker không có việc gì làm; chip trích dẫn phải là
                phần tử bấm được, không thể đi qua renderMarkdown. */}
            {parsed.knowledge ? (
              <KnowledgeAnswer
                reply={parsed.knowledge.reply}
                grounded={parsed.knowledge.grounded}
                citations={parsed.knowledge.citations}
              />
            ) : activeReply ? (
              renderMarkdown(activeReply, isStreaming)
            ) : isStreaming ? (
              <div className="flex items-center gap-2 py-1.5 text-[#6B6862] text-body">
                <span className="w-2 h-2 rounded-full bg-[#6A62C4] animate-ping" />
              </div>
            ) : null}
          </div>

          {!isStreaming && parsed.openQuestions.length > 0 && (
            <ol className="flex flex-col gap-1.5" aria-label={t("openQuestions")}>
              {parsed.openQuestions.map((question, i) => (
                <li key={i} className="flex items-baseline gap-2.5 text-heading text-on-surface leading-7">
                  <span className="w-5 h-5 shrink-0 inline-grid place-items-center rounded-[6px] bg-primary-soft text-primary-hover text-caption leading-none font-bold tabular-nums">
                    {i + 1}
                  </span>
                  {/* Câu hỏi để nét thường như thân chữ: bốn dòng cùng đậm thì không còn dòng nào nổi, và chúng
                      tranh mắt với nhãn bước + thẻ hỏi bên dưới. Số thứ tự đã đủ cho việc quét nhanh. */}
                  <span className="flex-1 min-w-0">{question}</span>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </div>
  );
}
