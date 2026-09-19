"use client";

import { useEffect, useRef, useState, type ChangeEvent, type KeyboardEvent } from "react";
import { estimateActionCost } from "../../../../lib/api/chat";
import type { ChatActionType } from "@/types/chat";

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
    <div className="p-4 bg-white border-t border-[#ECEAE5] shrink-0">
      {/* Pending Attachments List */}
      {pendingAttachments.length > 0 && (
        <div className="mb-2.5 flex flex-wrap gap-2">
          {pendingAttachments.map((file) => (
            <div
              key={file.name}
              className="flex items-center gap-1.5 px-3 py-1 bg-[#F4F3FE] border border-[#DDD9F6] rounded-full text-[11.5px] font-semibold text-[#3B34B0]"
            >
              <span className="material-symbols-outlined text-[14px]">
                description
              </span>
              <span className="truncate max-w-[150px]">{file.name}</span>
              <button
                type="button"
                onClick={() => onRemoveAttachment(file.name)}
                className="hover:text-[#B03030] ml-0.5 cursor-pointer"
                title="Bỏ file này"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Input box */}
      <div className="border-1.5 border-[#E4E1DC] focus-within:border-[#7C74F0] rounded-[16px] p-3 flex flex-col gap-2.5 transition-all bg-white shadow-2xs">
        <textarea
          value={inputMessage}
          onChange={(e) => setInputMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          rows={2}
          disabled={sending}
          className="w-full resize-none outline-none text-[13px] text-[#191817] placeholder:text-[#A8A49C] bg-transparent leading-relaxed"
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
              className="p-1.5 hover:bg-[#F5F3F0] rounded-[8px] text-[#8A867E] hover:text-[#191817] transition-colors cursor-pointer"
              title="Đính kèm tài liệu tham khảo (.pdf, .docx, .txt)"
            >
              <span className="material-symbols-outlined text-[18px]">
                attach_file
              </span>
            </button>
          </div>

          <div className="flex items-center gap-3">
            {creditEstimate !== null && (
              <span className="text-[10.5px] font-mono text-[#A8A49C]">
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
              className={`w-8 h-8 rounded-full flex items-center justify-center text-white transition-all cursor-pointer ${
                (inputMessage.trim() || pendingAttachments.length > 0) &&
                !sending
                  ? "bg-[#4F46E5] hover:bg-[#4338CA] shadow-[0_2px_8px_rgba(79,70,229,0.3)]"
                  : "bg-[#D6D2CB] cursor-not-allowed opacity-60"
              }`}
              title="Gửi tin nhắn (Enter)"
            >
              {sending ? (
                <span className="w-3.5 h-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />
              ) : (
                <span className="material-symbols-outlined text-[16px] font-bold">
                  arrow_upward
                </span>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
