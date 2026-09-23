import type { ChatSession } from "@/types/chat";
import { ApiClientError, authFetch, ensureFreshToken, readRawErrorMessage, STREAM_MIN_TOKEN_TTL_MS } from "./api/client";

export interface SseHandlers<T> {
  onEvent: (event: T) => void;
  onError?: (error: Error) => void;
  signal?: AbortSignal;
}

/**
 * Lấy payload JSON của một khối SSE. Khối có thể gồm `event: <type>`, một hoặc nhiều dòng `data:`
 * (nối bằng xuống dòng) và comment `: ping`. Khối không có `data:` ⇒ null.
 */
export const readSseData = (block: string): string | null => {
  const data = block
    .split("\n")
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice("data:".length).replace(/^ /, ""));
  if (data.length === 0) return null;
  const joined = data.join("\n").trim();
  return joined || null;
};

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
    // Luồng SSE sống lâu hơn một request thường: refresh trước khi mở nếu token sắp hết hạn (BUG-18),
    // vì giữa luồng thì không còn chỗ nào để thử lại 401.
    await ensureFreshToken(STREAM_MIN_TOKEN_TTL_MS);
    const res = await authFetch(path, {
      method: "POST",
      body: JSON.stringify(body),
      signal,
    });

    if (!res.ok) {
      // ApiClientError mang `code` + `meta` (vd 409 CHANGE_REQUIRES_CR kèm `prefill` ở project mode 1)
      const envelope = res.clone();
      const message = await readRawErrorMessage(res, `HTTP ${res.status}: Failed to stream response`);
      const json = (await envelope.json().catch(() => null)) as { error?: { code?: unknown }; meta?: Record<string, unknown> } | null;
      const code = typeof json?.error?.code === "string" ? json.error.code : "STREAM_FAILED";
      throw new ApiClientError(res.status, code, message, json?.meta);
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

      buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, "\n");

      // SSE events are separated by a blank line
      const chunks = buffer.split("\n\n");
      buffer = chunks.pop() || "";

      for (const chunk of chunks) {
        const jsonStr = readSseData(chunk);
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
