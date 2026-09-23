"use client";

import { useEffect, useMemo, useRef, useState, type ChangeEvent, type ReactNode } from "react";
import type { ChatMessage, DiscoveryQuestion } from "@/types/chat";
import type { ChatSession } from "@/types/chat";
import { stepLabel as stepLabelOf } from "@/lib/constants/step-registry";
import Icon from "@/components/ui/Icon";
import ChatBubble from "./ChatBubble";
import ChatInput from "./ChatInput";
import QuestionStepperInput from "./QuestionStepperInput";

interface ChatPaneProps {
  width?: number;
  session: ChatSession | null;
  /** Nhãn step hiện tại (`S-3.1 · Actor`). */
  stepLabel?: string | null;
  inputMessage: string;
  setInputMessage: (msg: string) => void;
  onSendMessage: (customContent?: string) => void;
  sending: boolean;
  pendingAttachments: File[];
  onSelectAttachment: (e: ChangeEvent<HTMLInputElement>) => void;
  onRemoveAttachment: (name: string) => void;
  onRequestRollback?: (messageIndex: number) => void;
  streamingMessage?: string | null;
  isStreaming?: boolean;
  /** Thẻ của pipeline (nhật ký step, cổng chốt) hiển thị sau tin nhắn. */
  children?: ReactNode;
  /** Thẻ câu hỏi đặt ngay trên ô nhập (ô nhập vẫn giữ), ví dụ ElicitPanel khi step chờ câu trả lời. */
  questionCard?: ReactNode;
  /** Có ⇒ gõ ở ô nhập là trả lời thẳng thẻ câu hỏi ở trên thay vì gửi chat thường. */
  onDirectReply?: (text: string) => void;
  /**
   * Nhận lệnh sửa tài liệu (UC 6.8) — gửi khi chip "Sửa tài liệu" đang bật, hoặc khi session hiện tại không phải
   * pipeline session (`is_pipeline === false`: ô chat khi đó chỉ nhận lệnh sửa).
   */
  onEditInstruction?: (instruction: string) => void;
  /** Chip "Sửa tài liệu" trên ô nhập. */
  editMode?: boolean;
  onToggleEditMode?: () => void;
  /** Lý do chưa sửa được lúc này (vd. step đang chạy) — chip bị khoá. */
  editDisabledReason?: string | null;
  /** Nút thêm trên thanh công cụ ô nhập (menu cách AI làm việc). */
  inputTools?: ReactNode;
  /** Tiêu đề pane — mặc định của workspace pipeline (mode 2). */
  title?: string;
  /** Thay khung gợi ý khi chưa có tin nhắn (vd mode 1: chat chỉ để hỏi đáp). */
  emptyState?: ReactNode;
  /** Placeholder ô nhập — mặc định của ChatInput. */
  inputPlaceholder?: string;
  /** Đầu thanh tiêu đề, trước tên pane (vd. nút lịch sử phiên chat). */
  headerStart?: ReactNode;
  /** Số dư credit — hiện trong ô nhập. */
  creditBalance?: number | null;
  /** Khung sát mép trái màn hình (rail tiến độ ẩn / mở rộng trang) ⇒ chỉ bo góc bên phải; còn lại bo hai góc trên. */
  flushLeft?: boolean;
}

/**
 * BUG-24: chat trộn lẫn giữa các bước — ở S-5.3 của màn S05 vẫn thấy nguyên đoạn nói về màn S04, còn ở
 * S-8 vẫn thấy lịch sử từ S-5. Phân đoạn theo `step` của từng tin nhắn và chèn một dòng tiêu đề mỗi khi
 * đổi bước, để đọc tới đâu biết mình đang đọc về cái gì.
 */
export const stepDividers = (messages: readonly ChatMessage[]): (number | null)[] => {
  let previous: string | undefined;
  return messages.map((msg) => {
    const changed = msg.step !== undefined && msg.step !== previous;
    if (msg.step !== undefined) previous = msg.step;
    return changed ? 1 : null;
  });
};

/** Câu hỏi gợi ý trong tin nhắn AI cuối (hỏi đáp tự do, không phải Elicit của step). */
const parseQuestions = (content: string): DiscoveryQuestion[] => {
  try {
    const parsed: unknown = JSON.parse(content);
    const questions = (parsed as { questions?: unknown }).questions;
    if (!Array.isArray(questions)) return [];
    return questions
      .map((q: unknown): DiscoveryQuestion => {
        if (typeof q === "string") return { question: q, suggestedAnswers: [] };
        const item = (q ?? {}) as { question?: unknown; suggestedAnswers?: unknown; multiple?: unknown };
        return {
          question: typeof item.question === "string" ? item.question : "",
          suggestedAnswers: Array.isArray(item.suggestedAnswers)
            ? item.suggestedAnswers.filter((a: unknown): a is string => typeof a === "string" && a.trim().length > 0)
            : [],
          multiple: typeof item.multiple === "boolean" ? item.multiple : undefined,
        };
      })
      .filter((q) => q.question.trim().length > 0);
  } catch {
    return [];
  }
};

export default function ChatPane({
  width,
  session,
  stepLabel,
  inputMessage,
  setInputMessage,
  onSendMessage,
  sending,
  pendingAttachments,
  onSelectAttachment,
  onRemoveAttachment,
  onRequestRollback,
  streamingMessage,
  isStreaming = false,
  children,
  questionCard,
  onDirectReply,
  onEditInstruction,
  title = "Hội thoại & Duyệt bước",
  emptyState,
  inputPlaceholder,
  headerStart,
  flushLeft = false,
  creditBalance = null,
  editMode = false,
  onToggleEditMode,
  editDisabledReason = null,
  inputTools,
}: ChatPaneProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  // Ô nhập nổi đè lên đáy danh sách tin nhắn ⇒ đo chiều cao của nó để chừa chỗ cho tin nhắn cuối
  const footerRef = useRef<HTMLDivElement>(null);
  const [footerHeight, setFooterHeight] = useState(0);
  useEffect(() => {
    const el = footerRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => setFooterHeight(el.offsetHeight));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  const messages = useMemo(() => session?.messages ?? [], [session?.messages]);
  const [dismissedKey, setDismissedKey] = useState<string | null>(null);

  useEffect(() => {
    // Cuộn tới đáy vùng cuộn (gồm cả phần chừa cho ô nhập), không phải tới phần tử cuối — nếu không tin nhắn cuối nằm dưới ô nhập
    const el = scrollRef.current;
    if (!el) return;
    if (typeof el.scrollTo === "function") el.scrollTo({ top: el.scrollHeight, behavior: streamingMessage !== null ? "auto" : "smooth" });
    else el.scrollTop = el.scrollHeight;
  }, [messages, streamingMessage, children, footerHeight]);

  const dividers = useMemo(() => stepDividers(messages), [messages]);
  const last = messages[messages.length - 1];
  const questionKey = last?.role === "ai" ? `${messages.length}:${last.content}` : null;
  const latestQuestions = useMemo(() => (last?.role === "ai" ? parseQuestions(last.content) : []), [last]);
  const showQuestions = !questionCard && latestQuestions.length > 0 && dismissedKey !== questionKey;

  // Không có session ⇒ coi như pipeline (không đủ căn cứ chuyển hướng); session._id vắng field
  // mới thì mặc định pipeline để không phá luồng chat hiện có.
  const isNonPipelineSession = session?.is_pipeline === false;
  const sendAsEdit = (editMode || isNonPipelineSession) && Boolean(onEditInstruction);

  return (
    <section
      id="flintflow-chat-pane"
      style={width ? { width: `${width}px` } : undefined}
      className={`${width ? "" : "w-[460px]"} shrink min-w-[320px] bg-surface ${flushLeft ? "rounded-r-dialog" : "rounded-t-dialog"} flex flex-col overflow-hidden`}
    >
      <div className="ff-fade-below px-3 bg-surface flex justify-between items-center gap-2 shrink-0 h-12">
        <div className="flex items-center gap-1.5 min-w-0">
          {headerStart}
          <h2 className="font-bold text-on-surface text-[13px] truncate">{title}</h2>
        </div>
        {stepLabel && (
          <span className="text-[11px] font-bold text-primary-hover bg-primary-soft px-2.5 py-0.5 rounded-full truncate max-w-[200px]">{stepLabel}</span>
        )}
      </div>

      <div className="relative flex-1 min-h-0">
      {/* Tin nhắn cuộn chui xuống dưới ô nhập rồi mờ dần ở mép đáy (không có dải nền chắn sau ô nhập) */}
      <div
        ref={scrollRef}
        style={{ paddingBottom: footerHeight + 12 }}
        className="h-full overflow-y-auto ff-scroll p-5 space-y-4 flex flex-col [mask-image:linear-gradient(to_bottom,black_calc(100%-20px),transparent)]"
      >
        {messages.length === 0 && !children && (emptyState ?? (
          <div className="my-auto mx-auto max-w-sm text-center flex flex-col items-center gap-3 bg-surface-container-lowest rounded-card p-6">
            <div className="w-10 h-10 rounded-control bg-primary-soft text-primary flex items-center justify-center">
              <Icon name="sparkle" size={20} />
            </div>
            <h3 className="font-bold text-on-surface text-[14px]">Bắt đầu bước hiện tại</h3>
            <p className="text-on-surface-muted text-[12.5px] leading-relaxed">
              Bấm “Chạy bước này” để AI hỏi phần còn thiếu và soạn nháp, hoặc trò chuyện tự do và đính kèm tài liệu tham khảo.
            </p>
          </div>
        ))}

        {messages.map((msg, idx) => (
          <div key={idx} className="contents">
            {dividers[idx] !== null && msg.step && (
              <div className="flex items-center gap-2 pt-1" aria-label={`Bắt đầu bước ${msg.step}`}>
                <span className="h-px flex-1 bg-outline-variant" />
                <span className="text-[10.5px] font-bold uppercase tracking-wider text-on-surface-muted shrink-0">
                  {msg.step} · {stepLabelOf(msg.step)}
                </span>
                <span className="h-px flex-1 bg-outline-variant" />
              </div>
            )}
            <ChatBubble message={msg} messageIndex={idx} onRequestRollback={onRequestRollback} disabled={sending} />
          </div>
        ))}

        {isStreaming && (
          <ChatBubble message={{ role: "ai", content: streamingMessage ?? "", createdAt: new Date().toISOString() }} isStreaming />
        )}

        {isNonPipelineSession && onEditInstruction && (
          <div className="bg-[#F2F1FB] border border-[#DCD8F0] rounded-[14px] p-3 text-[12px] text-[#554DB0]">
            Phiên này không phải phiên pipeline — gõ bên dưới là lệnh sửa tài liệu, xem trước rồi mới áp dụng.
          </div>
        )}

        {children}
      </div>

      <div ref={footerRef} className="absolute inset-x-0 bottom-0 z-10">
          {questionCard ?? (showQuestions && (
            <QuestionStepperInput
              key={questionKey ?? "questions"}
              questions={latestQuestions}
              onSendAnswers={(answer) => onSendMessage(answer)}
              onDismiss={() => setDismissedKey(questionKey)}
              sending={sending}
            />
          ))}
          {/* Ô chat luôn hiện — kể cả khi có thẻ câu hỏi, để trả lời thẳng bằng lời của mình */}
          <ChatInput
            inputMessage={inputMessage}
            setInputMessage={setInputMessage}
            onSendMessage={() => {
              if (onDirectReply && pendingAttachments.length === 0) {
                onDirectReply(inputMessage.trim());
                setInputMessage("");
              } else if (sendAsEdit && onEditInstruction) {
                onEditInstruction(inputMessage);
                setInputMessage("");
              } else {
                onSendMessage();
              }
            }}
            sending={sending}
            pendingAttachments={pendingAttachments}
            onSelectAttachment={onSelectAttachment}
            onRemoveAttachment={onRemoveAttachment}
            compact={Boolean(questionCard) || showQuestions}
            creditBalance={creditBalance}
            actionType={sendAsEdit ? "change_instruction" : "chat"}
            // Session không pipeline luôn là lệnh sửa ⇒ không cần chip
            onToggleEditMode={isNonPipelineSession ? undefined : onToggleEditMode}
            editMode={sendAsEdit}
            editDisabledReason={editDisabledReason}
            toolbarExtra={inputTools}
            placeholder={
              questionCard || showQuestions
                ? "Hoặc trả lời trực tiếp…"
                : sendAsEdit
                  ? "Mô tả chỗ cần sửa, vd: Đổi tên actor A03 thành Administrator"
                  : inputPlaceholder
            }
          />
      </div>
      </div>
    </section>
  );
}
