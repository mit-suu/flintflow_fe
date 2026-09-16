"use client";

import { useState, useEffect } from "react";
import type { ChatSession } from "@/types/chat";

interface ChatSessionSidebarProps {
  sessions: ChatSession[];
  activeSessionId: string | null;
  onSelectSession: (session: ChatSession) => void;
  onCreateSession: () => void;
  onDeleteSession: (sessionId: string) => void;
}

export default function ChatSessionSidebar({
  sessions,
  activeSessionId,
  onSelectSession,
  onCreateSession,
  onDeleteSession,
}: ChatSessionSidebarProps) {
  const [openMenuSessionId, setOpenMenuSessionId] = useState<string | null>(
    null
  );
  const [deleteConfirmSessionId, setDeleteConfirmSessionId] = useState<
    string | null
  >(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = () => setOpenMenuSessionId(null);
    if (openMenuSessionId) {
      document.addEventListener("click", handleClickOutside);
    }
    return () => document.removeEventListener("click", handleClickOutside);
  }, [openMenuSessionId]);

  const parseAiPreview = (content: string): string => {
    if (content.startsWith("{") && content.endsWith("}")) {
      try {
        const parsed = JSON.parse(content);
        return parsed.reply || content;
      } catch (_) {
        return content;
      }
    }
    return content;
  };

  return (
    <aside className="w-[230px] border-r border-[#ECEAE5] bg-white flex flex-col shrink-0">
      <div className="p-3.5 border-b border-[#ECEAE5] flex justify-between items-center bg-white shrink-0">
        <span className="font-bold text-[#191817] text-[13px] flex items-center gap-1.5">
          <span className="text-[#4F46E5]">💬</span>
          Lịch sử phiên chat
        </span>
        <button
          onClick={onCreateSession}
          className="p-1 text-[#4F46E5] hover:bg-[#F4F3FE] rounded-[8px] transition-colors cursor-pointer"
          title="Tạo phiên chat mới"
        >
          <span className="material-symbols-outlined text-[18px] font-bold">
            add
          </span>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-2.5 space-y-1.5">
        {sessions.length === 0 ? (
          <div className="text-center text-[12px] text-[#A8A49C] py-8">
            Chưa có phiên chat nào
          </div>
        ) : (
          sessions.map((session) => {
            const isActive = session._id === activeSessionId;
            const lastMsg =
              session.messages && session.messages.length > 0
                ? session.messages[session.messages.length - 1]
                : null;

            let previewText = "Phiên mới";
            if (lastMsg) {
              previewText = parseAiPreview(lastMsg.content);
            }

            const isMenuOpen = openMenuSessionId === session._id;

            return (
              <div
                key={session._id}
                className={`group relative flex items-center justify-between p-2.5 rounded-[10px] transition-all ${
                  isActive
                    ? "bg-[#F4F3FE] text-[#3B34B0] border border-[#DDD9F6]"
                    : "hover:bg-[#FAF9F7] text-[#33312D]"
                }`}
              >
                {/* Session details */}
                <button
                  onClick={() => {
                    setOpenMenuSessionId(null);
                    onSelectSession(session);
                  }}
                  className="flex-1 text-left min-w-0 cursor-pointer"
                >
                  <div className="font-bold text-[12px] truncate">
                    Phiên #{session._id.substring(session._id.length - 4)}
                  </div>
                  <div
                    className={`text-[10.5px] truncate mt-0.5 ${
                      isActive ? "text-[#4F46E5]" : "text-[#8A867E]"
                    }`}
                  >
                    {previewText}
                  </div>
                </button>

                {/* More options menu */}
                <div className="relative shrink-0">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setOpenMenuSessionId(
                        isMenuOpen ? null : session._id
                      );
                    }}
                    className={`p-1 rounded-[6px] transition-colors ${
                      isMenuOpen
                        ? "opacity-100 bg-[#ECEAE5]"
                        : "opacity-0 group-hover:opacity-100 text-[#8A867E] hover:bg-[#ECEAE5]"
                    }`}
                    title="Tùy chọn"
                  >
                    <span className="material-symbols-outlined text-[16px]">
                      more_horiz
                    </span>
                  </button>

                  {/* Dropdown Menu */}
                  {isMenuOpen && (
                    <div
                      className="absolute right-0 top-7 z-30 bg-white border border-[#ECEAE5] rounded-[10px] shadow-[0_8px_20px_rgba(25,24,23,0.12)] py-1 min-w-[140px]"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        onClick={() => {
                          setOpenMenuSessionId(null);
                          setDeleteConfirmSessionId(session._id);
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-[12px] font-bold text-[#B03030] hover:bg-[#FDEDED] transition-colors text-left cursor-pointer"
                      >
                        Xoá phiên chat
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Delete confirmation modal */}
      {deleteConfirmSessionId && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-[18px] p-6 max-w-sm w-full border border-[#ECEAE5] shadow-xl flex flex-col gap-4">
            <div className="flex items-center gap-3 text-[#B03030]">
              <span className="material-symbols-outlined text-[24px]">
                warning
              </span>
              <h3 className="font-extrabold text-[15px] text-[#191817]">
                Xác nhận xoá phiên chat?
              </h3>
            </div>
            <p className="text-[12.5px] text-[#6B6862] leading-relaxed">
              Lịch sử hội thoại trong phiên này sẽ bị xoá vĩnh viễn. Các đặc tả
              đã sinh trong dự án vẫn được giữ nguyên.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmSessionId(null)}
                className="px-4 py-1.5 rounded-full border border-[#ECEAE5] text-[12px] font-semibold text-[#6B6862] hover:bg-[#FAF9F7] cursor-pointer"
              >
                Huỷ
              </button>
              <button
                type="button"
                onClick={() => {
                  if (deleteConfirmSessionId) {
                    onDeleteSession(deleteConfirmSessionId);
                    setDeleteConfirmSessionId(null);
                  }
                }}
                className="px-4 py-1.5 rounded-full bg-[#B03030] text-white text-[12px] font-bold hover:bg-[#9B2A2A] transition-colors cursor-pointer"
              >
                Xoá phiên
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
