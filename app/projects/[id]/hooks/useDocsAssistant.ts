"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ApiClientError } from "@/lib/api/client";
import { userErrorMessage } from "@/lib/api/error-messages";
import {
  streamDocsAgentMessage,
  type DocsAgentEvent,
  type DocsAgentPendingAction,
  type DocsAgentTurn,
} from "@/lib/api/google-docs-agent";

/** BE nhận tối đa 12 tin gần nhất làm ngữ cảnh — FE giữ hội thoại, BE không lưu. */
export const DOCS_ASSISTANT_HISTORY_MAX = 12;

export interface AssistantToolCall {
  name: string;
  args: { heading?: string; query?: string; afterHeading?: string };
}

export interface AssistantMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  toolCalls: AssistantToolCall[];
  pendingActions: DocsAgentPendingAction[];
  status: "streaming" | "done" | "error";
  error?: string;
}

let seq = 0;
const nextId = () => `m${++seq}`;

/**
 * Hội thoại với trợ lý Google Docs cho MỘT tài liệu. Đổi tài liệu ⇒ component gọi hook này được dựng lại (`key`), hội thoại
 * mới. Rời panel / dừng ⇒ huỷ luồng (BE hoàn credit khi lượt chưa xong).
 */
export function useDocsAssistant(projectId: string, documentId: string, onReconnectRequired?: () => void) {
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [sending, setSending] = useState(false);
  const controller = useRef<AbortController | null>(null);

  useEffect(() => () => controller.current?.abort(), []);

  const patchAssistant = (id: string, patch: (m: AssistantMessage) => AssistantMessage) =>
    setMessages((prev) => prev.map((m) => (m.id === id ? patch(m) : m)));

  const send = useCallback(
    async (text: string) => {
      const message = text.trim();
      if (!message || controller.current) return;
      const history: DocsAgentTurn[] = messages
        .filter((m) => m.status === "done" && m.content.trim())
        .slice(-DOCS_ASSISTANT_HISTORY_MAX)
        .map((m) => ({ role: m.role, content: m.content }));
      const user: AssistantMessage = { id: nextId(), role: "user", content: message, toolCalls: [], pendingActions: [], status: "done" };
      const reply: AssistantMessage = { id: nextId(), role: "assistant", content: "", toolCalls: [], pendingActions: [], status: "streaming" };
      setMessages((prev) => [...prev, user, reply]);
      setSending(true);
      const abort = new AbortController();
      controller.current = abort;

      const onEvent = (event: DocsAgentEvent) => {
        if (event.type === "text-delta") patchAssistant(reply.id, (m) => ({ ...m, content: m.content + event.delta }));
        else if (event.type === "tool-call") patchAssistant(reply.id, (m) => ({ ...m, toolCalls: [...m.toolCalls, { name: event.name, args: event.args }] }));
        else if (event.type === "finish")
          patchAssistant(reply.id, (m) => ({
            ...m,
            content: event.data.reply || m.content,
            pendingActions: event.data.pending_actions,
            status: "done",
          }));
        else if (event.type === "error")
          // Câu theo mã lỗi đã dịch sẵn ở bảng `errors` (vd INSUFFICIENT_CREDIT), không có thì câu BE gửi
          patchAssistant(reply.id, (m) => ({ ...m, status: "error", error: new ApiClientError(0, event.code ?? "STREAM_FAILED", event.error).message }));
      };

      try {
        await streamDocsAgentMessage(projectId, { documentId, message, history }, { onEvent, signal: abort.signal });
        // Luồng đóng mà không có finish / error (mất mạng giữa chừng, bấm dừng) ⇒ không để bong bóng quay mãi
        patchAssistant(reply.id, (m) => (m.status === "streaming" ? { ...m, status: abort.signal.aborted ? "done" : "error" } : m));
      } catch (err) {
        if (err instanceof ApiClientError && err.code === "GOOGLE_RECONNECT_REQUIRED") onReconnectRequired?.();
        patchAssistant(reply.id, (m) => ({ ...m, status: "error", error: userErrorMessage(err) }));
      } finally {
        controller.current = null;
        setSending(false);
      }
    },
    [messages, projectId, documentId, onReconnectRequired]
  );

  const stop = useCallback(() => controller.current?.abort(), []);

  return { messages, sending, send, stop };
}
