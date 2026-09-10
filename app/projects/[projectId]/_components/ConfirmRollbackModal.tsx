"use client";

import { useEffect } from "react";

interface ConfirmRollbackModalProps {
  isOpen: boolean;
  messageSnippet?: string;
  onConfirm: () => void;
  onCancel: () => void;
  isRollingBack?: boolean;
}

export default function ConfirmRollbackModal({
  isOpen,
  messageSnippet,
  onConfirm,
  onCancel,
  isRollingBack = false,
}: ConfirmRollbackModalProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen && !isRollingBack) {
        onCancel();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isRollingBack, onCancel]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px] flex items-center justify-center p-4">
      <div
        className="bg-white rounded-[20px] max-w-md w-full p-6 shadow-2xl border border-[#ECEAE5] flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with Icon */}
        <div className="flex items-start gap-3.5">
          <div className="w-10 h-10 rounded-[12px] bg-[#F4F3FE] text-[#4F46E5] border border-[#DDD9F6] flex items-center justify-center shrink-0">
            <svg
              className="w-5 h-5"
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
          </div>
          <div>
            <h3 className="font-extrabold text-[#191817] text-[15px]">
              Xác nhận hoàn tác cuộc trò chuyện
            </h3>
            <p className="text-[#8A867E] text-[12.5px] mt-0.5 leading-relaxed">
              Thao tác này sẽ thu hồi các câu hỏi và phản hồi sau thời điểm này.
            </p>
          </div>
        </div>

        {/* Message Snippet Box */}
        {messageSnippet && (
          <div className="bg-[#FAF9F7] border border-[#ECEAE5] rounded-[12px] p-3 text-[12.5px] text-[#4B4842] flex flex-col gap-1">
            <span className="text-[10px] font-bold text-[#8A867E] uppercase tracking-wider">
              Tin nhắn được chọn để hoàn tác:
            </span>
            <p className="italic line-clamp-3 leading-relaxed text-[#191817]">
              &ldquo;{messageSnippet}&rdquo;
            </p>
          </div>
        )}

        {/* Info Note */}
        <div className="p-3 bg-[#F0FDF4] border border-[#BBF7D0] rounded-[12px] text-[12px] text-[#15803D] flex items-start gap-2 leading-relaxed">
          <span className="shrink-0 text-sm">💡</span>
          <span>
            Các tin nhắn và dữ liệu phát sinh sau tin nhắn này sẽ được thu hồi. Tiến trình khảo sát sẽ tự động đồng bộ lùi lại theo thời điểm này.
          </span>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-2.5 pt-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={isRollingBack}
            className="px-4 py-2 rounded-[10px] border border-[#ECEAE5] hover:bg-[#FAF9F7] text-[12.5px] font-bold text-[#6B6862] transition-colors cursor-pointer disabled:opacity-50"
          >
            Hủy bỏ
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isRollingBack}
            className="px-4 py-2 rounded-[10px] bg-[#4F46E5] hover:bg-[#4338CA] text-white text-[12.5px] font-bold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer disabled:opacity-50"
          >
            {isRollingBack ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Đang hoàn tác...</span>
              </>
            ) : (
              <>
                <span>↩</span>
                <span>Xác nhận hoàn tác</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
