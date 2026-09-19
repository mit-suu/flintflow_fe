"use client";

import { useEffect, useMemo, useRef, useState, type ChangeEvent, type ReactNode } from "react";
import type { DiscoveryQuestion } from "@/types/chat";
import type { ChatSession } from "@/types/chat";
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
  /** Thay ô nhập chat, ví dụ ElicitPanel khi step chờ câu trả lời. */
  footer?: ReactNode;
  /**
   * Session hiện tại không phải pipeline session (`is_pipeline === false`) — ô lệnh sửa chuyển
   * hướng vào Change panel (UC 6.8) thay vì gửi chat thường.
   */
  onEditInstruction?: (instruction: string) => void;
}

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
  footer,
  onEditInstruction,
}: ChatPaneProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messages = useMemo(() => session?.messages ?? [], [session?.messages]);
  const [dismissedKey, setDismissedKey] = useState<string | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: streamingMessage !== null ? "auto" : "smooth" });
  }, [messages, streamingMessage, children]);

  const last = messages[messages.length - 1];
  const questionKey = last?.role === "ai" ? `${messages.length}:${last.content}` : null;
  const latestQuestions = useMemo(() => (last?.role === "ai" ? parseQuestions(last.content) : []), [last]);
  const showQuestions = !footer && latestQuestions.length > 0 && dismissedKey !== questionKey;

  // Không có session ⇒ coi như pipeline (không đủ căn cứ chuyển hướng); session._id vắng field
  // mới thì mặc định pipeline để không phá luồng chat hiện có.
  const isNonPipelineSession = session?.is_pipeline === false;
  const redirectToChangePanel = isNonPipelineSession && Boolean(onEditInstruction);

  return (
    <section
      id="flintflow-chat-pane"
      style={width ? { width: `${width}px` } : undefined}
      className={`${width ? "" : "w-[460px]"} flex-none bg-[#F5F3F0] flex flex-col overflow-hidden`}
    >
      <div className="px-5 py-3 border-b border-[#ECEAE5] flex justify-between items-center bg-white shrink-0 h-[52px]">
        <div className="flex items-center gap-2">
          <span className="text-[#6A62C4] text-sm">✦</span>
          <h2 className="font-extrabold text-[#191817] text-[13px]">Hội thoại & Duyệt bước</h2>
        </div>
        {stepLabel && (
          <div className="text-[11px] font-bold text-[#6A62C4] bg-[#F2F1FB] border border-[#DCD8F0] px-2.5 py-0.5 rounded-full truncate max-w-[200px]">
            {stepLabel}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-4 flex flex-col">
        {messages.length === 0 && !children && (
          <div className="my-auto max-w-sm text-center py-8 flex flex-col items-center gap-3 bg-white border border-[#ECEAE5] rounded-[20px] p-6 shadow-2xs">
            <div className="w-10 h-10 rounded-[12px] bg-[#F2F1FB] text-[#6A62C4] flex items-center justify-center text-[18px]">💡</div>
            <h3 className="font-extrabold text-[#191817] text-[14px]">Bắt đầu bước hiện tại</h3>
            <p className="text-[#8A867E] text-[12px] leading-relaxed">
              Bấm “Chạy bước này” để AI hỏi phần còn thiếu và soạn nháp, hoặc trò chuyện tự do và đính kèm tài liệu tham khảo.
            </p>
          </div>
        )}

        {messages.map((msg, idx) => (
          <ChatBubble key={idx} message={msg} messageIndex={idx} onRequestRollback={onRequestRollback} disabled={sending} />
        ))}

        {isStreaming && (
          <ChatBubble message={{ role: "ai", content: streamingMessage ?? "", createdAt: new Date().toISOString() }} isStreaming />
        )}

        {redirectToChangePanel && (
          <div className="bg-[#F2F1FB] border border-[#DCD8F0] rounded-[14px] p-3 text-[12px] text-[#554DB0]">
            Phiên này không phải phiên pipeline — lệnh sửa gõ bên dưới sẽ gửi thẳng vào Change panel để xem trước rồi xác nhận.
          </div>
        )}

        {children}

        <div ref={messagesEndRef} />
      </div>

      {footer ??
        (showQuestions ? (
          <QuestionStepperInput
            key={questionKey ?? "questions"}
            questions={latestQuestions}
            onSendAnswers={(answer) => onSendMessage(answer)}
            onDismiss={() => setDismissedKey(questionKey)}
            sending={sending}
          />
        ) : (
          <ChatInput
            inputMessage={inputMessage}
            setInputMessage={setInputMessage}
            onSendMessage={() => {
              if (redirectToChangePanel && onEditInstruction) {
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
            actionType="chat"
            placeholder={redirectToChangePanel ? "Nhập lệnh sửa — gửi vào Change panel…" : undefined}
          />
        ))}
    </section>
  );
}
