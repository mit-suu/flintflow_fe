"use client";

import { useEffect, useRef, useState, type ChangeEvent, type KeyboardEvent } from "react";
import { estimateActionCost } from "../../../../lib/api/chat";
import type { ChatActionType } from "@/types/chat";
import Icon from "@/components/ui/Icon";

interface ChatInputProps {
  inputMessage: string;
  setInputMessage: (msg: string) => void;
  onSendMessage: () => void;
  sending: boolean;
  pendingAttachments: File[];
  onSelectAttachment: (e: ChangeEvent<HTMLInputElement>) => void;
  onRemoveAttachment: (fileName: string) => void;
  /** ActionType BE dùng để tính giá credit mỗi tin nhắn. */
  actionType: ChatActionType;
  placeholder?: string;
}

// ChatInput mount lại sau mỗi lượt AI; cache giá theo actionType để chỉ gọi BE một lần mỗi loại.
// Request lỗi bị xoá khỏi cache để lần mount sau thử lại.
const costRequests = new Map<ChatActionType, Promise<number | null>>();

const loadActionCost = (actionType: ChatActionType): Promise<number | null> => {
  let request = costRequests.get(actionType);
  if (!request) {
    request = estimateActionCost(actionType)
      .then((res) => res.data?.cost ?? null)
      .catch(() => {
        costRequests.delete(actionType);
        return null;
      });
    costRequests.set(actionType, request);
  }
  return request;
};

export default function ChatInput({
  inputMessage,
  setInputMessage,
  onSendMessage,
  sending,
  pendingAttachments,
  onSelectAttachment,
  onRemoveAttachment,
  actionType,
  placeholder = "Nhập câu trả lời hoặc lệnh yêu cầu chỉnh sửa…",
}: ChatInputProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [creditEstimate, setCreditEstimate] = useState<number | null>(null);

  // Giá credit lấy từ BE; lỗi thì ẩn thay vì hiện số đoán
  useEffect(() => {
    let cancelled = false;
    loadActionCost(actionType).then((cost) => {
      if (!cancelled) setCreditEstimate(cost);
    });
    return () => {
      cancelled = true;
    };
  }, [actionType]);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if ((inputMessage.trim() || pendingAttachments.length > 0) && !sending) {
        onSendMessage();
      }
    }
  };

  return (
    <div className="px-4 pb-4 pt-2">
      {/* Pending Attachments List */}
      {pendingAttachments.length > 0 && (
        <div className="mb-2.5 flex flex-wrap gap-2">
          {pendingAttachments.map((file) => (
            <div
              key={file.name}
              className="flex items-center gap-1.5 pl-2.5 pr-1.5 h-7 bg-primary-soft rounded-inner text-[11.5px] font-semibold text-primary-hover"
            >
              <Icon name="file" size={14} />
              <span className="truncate max-w-[150px]">{file.name}</span>
              <button
                type="button"
                onClick={() => onRemoveAttachment(file.name)}
                className="w-5 h-5 grid place-items-center rounded-full hover:bg-error-container hover:text-error cursor-pointer transition-colors"
                aria-label={`Bỏ file ${file.name}`}
                title="Bỏ file này"
              >
                <Icon name="close" size={12} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Input box */}
      <div className="rounded-card p-3 flex flex-col gap-2.5 bg-surface-container-lowest shadow-[0_1px_2px_rgba(25,24,23,0.04),0_8px_24px_rgba(25,24,23,0.05)] ring-primary/30 focus-within:ring-2 transition-shadow">
        <textarea
          value={inputMessage}
          onChange={(e) => setInputMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          rows={2}
          disabled={sending}
          className="w-full resize-none outline-none text-[13px] text-on-surface placeholder:text-on-surface-subtle bg-transparent leading-relaxed ff-scroll"
        />

        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-1.5">
            {/* Attachment Button */}
            <input
              type="file"
              ref={fileInputRef}
              onChange={onSelectAttachment}
              multiple
              className="hidden"
              accept=".pdf,.docx,.txt,.md"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-8 h-8 grid place-items-center rounded-control text-on-surface-muted hover:bg-surface-container-high hover:text-on-surface transition-colors cursor-pointer"
              aria-label="Đính kèm tài liệu tham khảo"
              title="Đính kèm tài liệu tham khảo (.pdf, .docx, .txt)"
            >
              <Icon name="attach" size={18} />
            </button>
          </div>

          <div className="flex items-center gap-3">
            {creditEstimate !== null && (
              <span className="text-[11px] text-on-surface-subtle tabular-nums">
                ~{creditEstimate} credit / msg
              </span>
            )}

            <button
              type="button"
              onClick={onSendMessage}
              disabled={
                (!inputMessage.trim() && pendingAttachments.length === 0) ||
                sending
              }
              aria-label="Gửi tin nhắn"
              className={`w-8 h-8 rounded-control flex items-center justify-center text-on-primary transition-[background-color,transform] duration-150 active:scale-95 cursor-pointer ${
                (inputMessage.trim() || pendingAttachments.length > 0) &&
                !sending
                  ? "bg-primary hover:bg-primary-hover"
                  : "bg-surface-container-highest text-on-surface-subtle cursor-not-allowed"
              }`}
              title="Gửi tin nhắn (Enter)"
            >
              {sending ? (
                <span className="w-3.5 h-3.5 rounded-full border-2 border-current border-t-transparent ff-spinner" />
              ) : (
                <Icon name="arrow-up" size={16} weight="bold" />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
