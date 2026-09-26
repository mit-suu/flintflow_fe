"use client";

import { useEffect, useRef, useState } from "react";
import Button from "@/components/ui/Button";
import Icon from "@/components/ui/Icon";
import IconButton from "@/components/ui/IconButton";
import Modal from "@/components/ui/Modal";
import { usePresence } from "@/lib/hooks/use-presence";
import type { ChatSession } from "@/types/chat";

interface ChatSessionHistoryProps {
  sessions: ChatSession[];
  activeSessionId: string | null;
  onSelectSession: (session: ChatSession) => void;
  onCreateSession: () => void;
  onDeleteSession: (sessionId: string) => void;
}

/** Tin AI có thể là JSON `{reply, questions}` — xem trước chỉ lấy `reply`. */
const previewOf = (content: string): string => {
  if (content.startsWith("{") && content.endsWith("}")) {
    try {
      const parsed = JSON.parse(content) as { reply?: unknown };
      return typeof parsed.reply === "string" ? parsed.reply : content;
    } catch {
      return content;
    }
  }
  return content;
};

/**
 * Lịch sử phiên chat dạng popover ở đầu khung chat: đóng mặc định, bấm nút mới mở, đè lên nội dung chứ không
 * đẩy bố cục. Đóng khi bấm ra ngoài, Esc, hoặc sau khi chọn/tạo phiên.
 */
export default function ChatSessionHistory({
  sessions,
  activeSessionId,
  onSelectSession,
  onCreateSession,
  onDeleteSession,
}: ChatSessionHistoryProps) {
  const [open, setOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const { mounted, shown } = usePresence(open, 150);

  useEffect(() => {
    if (!open) return;
    const onMouseDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <IconButton
        icon="history"
        label="Lịch sử phiên chat"
        size="sm"
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((v) => !v)}
        className={open ? "bg-primary-fixed text-primary hover:bg-primary-fixed hover:text-primary" : ""}
      />

      {mounted && (
        <div
          role="dialog"
          aria-label="Lịch sử phiên chat"
          aria-hidden={!open || undefined}
          className={`absolute left-0 top-[calc(100%+6px)] z-40 w-[280px] max-h-[420px] flex flex-col bg-surface-container-lowest rounded-card shadow-[0_12px_32px_rgba(25,24,23,0.12)] p-1.5 origin-top-left transition-[opacity,transform] ease-out motion-reduce:transition-none ${
            shown ? "opacity-100 scale-100 translate-y-0 duration-200" : "opacity-0 scale-95 -translate-y-1 duration-150 pointer-events-none"
          }`}
        >
          <div className="flex items-center justify-between px-2 pt-1 pb-1.5">
            <span className="text-[12.5px] font-bold text-on-surface">Lịch sử phiên chat</span>
            <Button
              size="sm"
              variant="ghost"
              icon="plus"
              className="h-7 px-2"
              onClick={() => {
                onCreateSession();
                setOpen(false);
              }}
            >
              Phiên mới
            </Button>
          </div>

          <ul className="flex-1 overflow-y-auto ff-scroll flex flex-col gap-0.5">
            {sessions.length === 0 && <li className="text-center text-[12px] text-on-surface-subtle py-6">Chưa có phiên chat nào</li>}
            {sessions.map((session) => {
              const isActive = session._id === activeSessionId;
              const last = session.messages?.at(-1);
              return (
                <li
                  key={session._id}
                  className={`group flex items-center gap-1 rounded-inner transition-colors ${isActive ? "bg-primary-fixed" : "hover:bg-surface-container"}`}
                >
                  <button
                    type="button"
                    aria-current={isActive || undefined}
                    onClick={() => {
                      onSelectSession(session);
                      setOpen(false);
                    }}
                    className="flex-1 min-w-0 text-left px-2.5 py-2 cursor-pointer rounded-inner focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    <div className={`text-[12px] font-bold truncate ${isActive ? "text-primary" : "text-on-surface-dark"}`}>
                      Phiên #{session._id.slice(-4)}
                    </div>
                    <div className="text-[11px] text-on-surface-muted truncate mt-0.5">{last ? previewOf(last.content) : "Phiên mới"}</div>
                  </button>
                  <IconButton
                    icon="trash"
                    size="sm"
                    label={`Xoá phiên #${session._id.slice(-4)}`}
                    onClick={() => setDeleteId(session._id)}
                    className="mr-1 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 hover:text-error"
                  />
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <Modal open={deleteId !== null} onClose={() => setDeleteId(null)} title="Xoá phiên chat?">
        <p className="text-[13px] text-on-surface-variant leading-relaxed flex gap-2">
          <Icon name="warning" size={18} className="text-error mt-0.5" />
          Lịch sử hội thoại trong phiên này sẽ bị xoá vĩnh viễn. Các đặc tả đã sinh trong dự án vẫn được giữ nguyên.
        </p>
        <div className="flex justify-end gap-2 mt-6">
          <Button variant="secondary" size="sm" onClick={() => setDeleteId(null)}>
            Huỷ
          </Button>
          <Button
            variant="danger"
            size="sm"
            onClick={() => {
              if (deleteId) onDeleteSession(deleteId);
              setDeleteId(null);
            }}
          >
            Xoá phiên
          </Button>
        </div>
      </Modal>
    </div>
  );
}
