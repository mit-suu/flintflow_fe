"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type ReactNode
} from "react";
import type { ChatMessage, DiscoveryQuestion } from "@/types/chat";
import type { ChatSession } from "@/types/chat";
import { workspaceStepLabel as stepLabelOf } from "./phase-labels";
import Icon from "@/components/ui/Icon";
import ChatBubble from "./ChatBubble";
import ChatInput from "./ChatInput";
import QuestionStepperInput, { formatAnswers } from "./QuestionStepperInput";
import { parseChatQuestion } from "@/lib/question-options";

interface ChatPaneProps {
  width?: number;
  /** Không có khung bên phải (Brief chưa có dữ liệu) ⇒ khung chat giãn hết chỗ còn lại. */
  fill?: boolean;
  session: ChatSession | null;
  /** Nhãn step hiện tại, tên đời thường (`Actor`) — không hiện mã B-x.y / S-x.y. */
  stepLabel?: string | null;
  /** Mã step (`S-3.1`) — chỉ để trong tooltip của nhãn. */
  stepCode?: string | null;
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
  /**
   * Nhận lệnh sửa tài liệu (UC 6.8) — gửi khi chip "Sửa tài liệu" đang bật. Phiên phụ (`is_pipeline === false`) vẫn
   * hỏi đáp như thường; trước FLF-244 ô chat ở đó bị ép thành lệnh sửa.
   */
  onEditInstruction?: (instruction: string) => void;
  /** Phiên phụ: nút "Về phiên chính" trên dải thông báo (quy trình soạn tài liệu chạy ở phiên chính). */
  onGoToPipeline?: () => void;
  /** Có ⇒ chế độ chỉ đọc (Viewer): thay ô nhập và thẻ hỏi bằng dòng thông báo này (FLF-244). */
  readOnlyNotice?: string;
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
  /** Placeholder khi chip "Sửa tài liệu" bật (mode 1: theo bước của change request trong chat). */
  editPlaceholder?: string;
  /** Đầu thanh tiêu đề, trước tên pane (vd. nút lịch sử phiên chat). */
  headerStart?: ReactNode;
  /** Khung sát mép trái màn hình (rail tiến độ ẩn / mở rộng trang) ⇒ chỉ bo góc bên phải; còn lại bo hai góc trên. */
  flushLeft?: boolean;
  /**
   * Ẩn tin AI cuối của lịch sử: nó là lời đáp của lượt hỏi đang chờ và đã được gộp vào bong bóng câu hỏi (children) —
   * hiện cả hai là một câu trả lời bị tách làm đôi.
   */
  hideTrailingAiMessage?: boolean;
}

/**
 * BUG-24: chat trộn lẫn giữa các bước — ở S-5.3 của màn S05 vẫn thấy nguyên đoạn nói về màn S04, còn ở
 * S-8 vẫn thấy lịch sử từ S-5. Phân đoạn theo `step` của từng tin nhắn và chèn một dòng tiêu đề mỗi khi
 * đổi bước, để đọc tới đâu biết mình đang đọc về cái gì.
 */
export const stepDividers = (
  messages: readonly ChatMessage[]
): (number | null)[] => {
  let previous: string | undefined;
  return messages.map((msg) => {
    const changed = msg.step !== undefined && msg.step !== previous;
    if (msg.step !== undefined) previous = msg.step;
    return changed ? 1 : null;
  });
};

/**
 * Câu hỏi CÓ lựa chọn trong tin nhắn AI cuối (hỏi đáp tự do, không phải Elicit của step) — vào thẻ hỏi. Câu mở
 * hiện trong bong bóng AI (`ChatBubble`). Đọc cả tin nhắn cũ (`suggestedAnswers`) lẫn mới (`options`).
 */
const parseQuestions = (content: string): DiscoveryQuestion[] => {
  try {
    const parsed: unknown = JSON.parse(content);
    const questions = (parsed as { questions?: unknown }).questions;
    if (!Array.isArray(questions)) return [];
    return questions.flatMap((q) => {
      const question = parseChatQuestion(q);
      return question && question.options.length > 0 ? [question] : [];
    });
  } catch {
    return [];
  }
};

export default function ChatPane({
  width,
  fill = false,
  session,
  stepLabel,
  stepCode = null,
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
  onEditInstruction,
  onGoToPipeline,
  readOnlyNotice,
  title = "Trò chuyện và duyệt",
  emptyState,
  inputPlaceholder,
  editPlaceholder,
  headerStart,
  flushLeft = false,
  hideTrailingAiMessage = false,
  editMode = false,
  onToggleEditMode,
  editDisabledReason = null,
  inputTools
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
  const messages = useMemo(() => {
    const all = session?.messages ?? [];
    return hideTrailingAiMessage && all.at(-1)?.role === "ai"
      ? all.slice(0, -1)
      : all;
  }, [session?.messages, hideTrailingAiMessage]);
  const [dismissedKey, setDismissedKey] = useState<string | null>(null);

  useEffect(() => {
    // Cuộn tới đáy vùng cuộn (gồm cả phần chừa cho ô nhập), không phải tới phần tử cuối — nếu không tin nhắn cuối nằm dưới ô nhập
    const el = scrollRef.current;
    if (!el) return;
    if (typeof el.scrollTo === "function")
      el.scrollTo({
        top: el.scrollHeight,
        behavior: streamingMessage !== null ? "auto" : "smooth"
      });
    else el.scrollTop = el.scrollHeight;
  }, [messages, streamingMessage, children, footerHeight]);

  const dividers = useMemo(() => stepDividers(messages), [messages]);
  const last = messages[messages.length - 1];
  const questionKey =
    last?.role === "ai" ? `${messages.length}:${last.content}` : null;
  const latestQuestions = useMemo(
    () => (last?.role === "ai" ? parseQuestions(last.content) : []),
    [last]
  );
  const showQuestions =
    !questionCard && latestQuestions.length > 0 && dismissedKey !== questionKey;

  // Không có session hoặc session vắng field ⇒ coi như pipeline. Phiên phụ chỉ khác ở dải thông báo — gửi là hỏi đáp,
  // bật chip là lệnh sửa, như phiên chính (FLF-244).
  const isNonPipelineSession = session?.is_pipeline === false;
  const sendAsEdit = editMode && Boolean(onEditInstruction);

  return (
    <section
      id="flintflow-chat-pane"
      style={width && !fill ? { width: `${width}px` } : undefined}
      // `border` trần lấy `currentColor` của Tailwind 4 ⇒ viền đen theo màu chữ; chỉ rõ màu hairline
      className={`${fill ? "flex-1" : width ? "" : "w-[460px]"} relative shrink min-w-[320px] border-[0.5px] border-t-0 border-b-0 border-outline flex flex-col overflow-hidden`}>
      {/* Thanh tiêu đề nổi trên nội dung: không có nền riêng, tin nhắn cuộn qua phía dưới và chỉ bị che bởi
          nền của từng thứ trong thanh (nút lịch sử, chip bước) */}
      <div className="absolute inset-x-0 top-0 z-20 px-3 flex justify-between items-center gap-2 h-12 pointer-events-none">
        <div className="flex items-center gap-1.5 min-w-0 pointer-events-auto">
          {headerStart}
          {/* Nhãn tĩnh không mang màu thương hiệu — tím để dành cho trạng thái (chip bước) và hành động.
              Dải mờ của vùng cuộn đã đặc trước khi chạm hàng này nên chữ trần vẫn đọc rõ. */}
          <h2 className="font-bold text-on-surface text-body truncate">
            {title}
          </h2>
        </div>
        {stepLabel && (
          <span
            title={stepCode ?? undefined}
            className="pointer-events-auto text-caption font-bold text-primary-hover bg-primary-soft px-2.5 py-0.5 rounded-full truncate max-w-[200px]">
            {stepLabel}
          </span>
        )}
      </div>

      <div className="relative flex-1 min-h-0">
        {/* Tin nhắn mờ dần ở cả hai mép: trên khi cuộn lên sau thanh tiêu đề, dưới khi chui xuống ô nhập —
            mép mờ thay cho dải nền chắn, nên nền pane liền một khối */}
        <div
          ref={scrollRef}
          style={{ paddingBottom: footerHeight + 32 }}
          // Mép mờ phải TRONG SUỐT HẲN suốt chiều cao thanh tiêu đề (48px) rồi mới hiện dần; để ngưỡng ở 30px như
          // trước thì chữ cuộn qua còn thấy lờ mờ sau chữ "Trò chuyện và duyệt" — đọc ra như hai dòng chồng nhau.
          className="h-full overflow-y-auto ff-scroll px-6 pt-[76px] [mask-image:linear-gradient(to_bottom,transparent_0,transparent_48px,black_72px,black_calc(100%-20px),transparent)]">
          {/* Cột đọc giới hạn bề rộng, khoảng thở rộng giữa các lượt — kiểu ChatGPT */}
          <div className="mx-auto w-full max-w-[720px] min-h-full flex flex-col gap-6">
            {messages.length === 0 &&
              !children &&
              (emptyState ?? (
                <div className="my-auto mx-auto max-w-sm text-center flex flex-col items-center gap-3 bg-surface-container-lowest rounded-card p-6">
                  <div className="w-10 h-10 rounded-control bg-primary-soft text-primary flex items-center justify-center">
                    <Icon
                      name="sparkle"
                      size={20}
                    />
                  </div>
                  <h3 className="font-bold text-on-surface text-heading">
                    Bắt đầu bước hiện tại
                  </h3>
                  <p className="text-on-surface-muted text-body leading-relaxed">
                    Gõ vào ô chat để AI bắt đầu: AI hỏi phần còn thiếu rồi soạn
                    nháp. Có thể đính kèm tài liệu tham khảo.
                  </p>
                </div>
              ))}

            {messages.map((msg, idx) => (
              <div
                key={idx}
                className="contents">
                {dividers[idx] !== null && msg.step && (
                  <div
                    className="flex items-center gap-2 pt-1"
                    title={msg.step}
                    aria-label={`Bắt đầu bước ${stepLabelOf(msg.step)}`}>
                    <span className="h-px flex-1 bg-outline-variant" />
                    <span className="text-caption font-bold uppercase tracking-wider text-on-surface-muted shrink-0">
                      {stepLabelOf(msg.step)}
                    </span>
                    <span className="h-px flex-1 bg-outline-variant" />
                  </div>
                )}
                <ChatBubble
                  message={msg}
                  messageIndex={idx}
                  onRequestRollback={onRequestRollback}
                  disabled={sending}
                />
              </div>
            ))}

            {isStreaming && (
              <ChatBubble
                message={{
                  role: "ai",
                  content: streamingMessage ?? "",
                  createdAt: new Date().toISOString()
                }}
                isStreaming
              />
            )}

            {isNonPipelineSession && (
              <div className="bg-primary-soft rounded-card p-3 text-body text-primary-hover flex flex-wrap items-center gap-2">
                <span className="flex-1 min-w-0">
                  Phiên hỏi đáp — hỏi AI về dự án, hoặc bật &quot;Sửa tài
                  liệu&quot; để sửa. Quy trình soạn tài liệu chạy ở phiên chính.
                </span>
                {onGoToPipeline && (
                  <button
                    type="button"
                    onClick={onGoToPipeline}
                    className="px-2.5 py-1 rounded-full text-body font-bold bg-primary text-on-primary hover:bg-primary-hover transition-colors cursor-pointer">
                    Về phiên chính
                  </button>
                )}
              </div>
            )}

            {children}
          </div>
        </div>

        <div
          ref={footerRef}
          className="absolute inset-x-0 bottom-0 z-10">
          {/* Thẻ hỏi + ô nhập cùng bề rộng với cột tin nhắn (720px + lề 2×24px), không giãn theo khung chat */}
          <div className="mx-auto w-full max-w-[768px]">
            {readOnlyNotice ? (
              <p
                role="note"
                className="mb-4 mx-6 bg-surface-container rounded-card px-4 py-3 text-body text-on-surface-muted">
                {readOnlyNotice}
              </p>
            ) : (
              <>
                {questionCard ??
                  (showQuestions && (
                    <QuestionStepperInput
                      key={questionKey ?? "questions"}
                      questions={latestQuestions}
                      onSubmit={(values) => {
                        // Chữ đang gõ ở ô chat đi cùng lượt gửi (trả lời câu mở trong tin nhắn AI)
                        const draft = inputMessage.trim();
                        onSendMessage(
                          [formatAnswers(values), draft]
                            .filter(Boolean)
                            .join("\n")
                        );
                        if (draft) setInputMessage("");
                      }}
                      onDismiss={() => setDismissedKey(questionKey)}
                      sending={sending}
                    />
                  ))}
                {/* Ô chat luôn hiện — kể cả khi có thẻ câu hỏi, để trả lời thẳng bằng lời của mình */}
                <ChatInput
                  inputMessage={inputMessage}
                  setInputMessage={setInputMessage}
                  onSendMessage={(text) => {
                    if (sendAsEdit && onEditInstruction) {
                      onEditInstruction(text);
                      setInputMessage("");
                    } else {
                      onSendMessage(text);
                    }
                  }}
                  sending={sending}
                  pendingAttachments={pendingAttachments}
                  onSelectAttachment={onSelectAttachment}
                  onRemoveAttachment={onRemoveAttachment}
                  compact={Boolean(questionCard) || showQuestions}
                  onToggleEditMode={onToggleEditMode}
                  editMode={sendAsEdit}
                  editDisabledReason={editDisabledReason}
                  toolbarExtra={inputTools}
                  placeholder={
                    questionCard || showQuestions
                      ? "Hoặc trả lời trực tiếp…"
                      : sendAsEdit
                        ? (editPlaceholder ??
                          "Mô tả chỗ cần sửa, vd: Đổi tên actor A03 thành Administrator")
                        : inputPlaceholder
                  }
                />
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
