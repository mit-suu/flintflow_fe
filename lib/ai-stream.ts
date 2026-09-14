import type { ChatSession } from "@/types/chat";
import { authFetch, readErrorMessage } from "./api/client";

export interface SseHandlers<T> {
  onEvent: (event: T) => void;
  onError?: (error: Error) => void;
  signal?: AbortSignal;
}

/**
 * POST JSON tới một endpoint SSE và phát từng khối `data: {...}` thành event kiểu `T`.
 * Lỗi HTTP/mạng gọi `onError` rồi ném lại; huỷ bằng `signal` thì kết thúc im lặng.
 */
export const streamSse = async <T>(
  path: string,
  body: unknown,
  { onEvent, onError, signal }: SseHandlers<T>
): Promise<void> => {
  try {
    const res = await authFetch(path, {
      method: "POST",
      body: JSON.stringify(body),
      signal,
    });

    if (!res.ok) {
      throw new Error(await readErrorMessage(res, `HTTP ${res.status}: Failed to stream response`));
    }

    if (!res.body) {
      throw new Error("Response body is not readable");
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "";

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // SSE events are separated by a blank line
      const chunks = buffer.split("\n\n");
      buffer = chunks.pop() || "";

      for (const chunk of chunks) {
        const trimmed = chunk.trim();
        if (!trimmed.startsWith("data:")) continue;

        const jsonStr = trimmed.replace(/^data:\s*/, "").trim();
        if (!jsonStr) continue;

        let event: T;
        try {
          event = JSON.parse(jsonStr) as T;
        } catch (parseErr) {
          console.warn("[ai-stream] Failed to parse SSE event JSON:", jsonStr, parseErr);
          continue;
        }
        onEvent(event);
      }
    }
  } catch (err: unknown) {
    if ((err as { name?: unknown } | null)?.name === "AbortError") {
      return;
    }
    const error = err instanceof Error ? err : new Error(String(err));
    onError?.(error);
    throw error;
  }
};

type ChatStreamEvent =
  | { type: "text-delta"; delta: string }
  | { type: "finish"; session: ChatSession; data?: unknown; tokensUsed?: unknown; cost?: number }
  | { type: "error"; error?: string };

export interface StreamChatParams {
  projectId: string;
  chatId: string;
  content: string;
  step: string;
  discoveryStep?: number;
  onTextDelta?: (delta: string) => void;
  onFinish?: (payload: {
    session: ChatSession;
    data?: unknown;
    tokensUsed?: unknown;
    cost?: number;
  }) => void;
  onError?: (error: Error) => void;
  signal?: AbortSignal;
}

export const streamChatMessage = ({
  projectId,
  chatId,
  content,
  step,
  discoveryStep,
  onTextDelta,
  onFinish,
  onError,
  signal,
}: StreamChatParams): Promise<void> =>
  streamSse<ChatStreamEvent>(
    `/projects/${projectId}/chats/${chatId}/messages/stream`,
    { content, step, discoveryStep },
    {
      signal,
      onError,
      onEvent: (event) => {
        if (event.type === "text-delta" && typeof event.delta === "string") {
          onTextDelta?.(event.delta);
        } else if (event.type === "finish") {
          onFinish?.({
            session: event.session,
            data: event.data,
            tokensUsed: event.tokensUsed,
            cost: event.cost,
          });
        } else if (event.type === "error") {
          // Lỗi trong luồng: báo cho UI nhưng không cắt stream (giữ hành vi cũ)
          onError?.(new Error(event.error || "Streaming error occurred"));
        }
      },
    }
  );
