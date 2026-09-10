import { getStoredAuthToken, decodeJwt } from "./auth";
import { refreshAccessToken } from "./api";
import { ChatSession } from "../app/projects/[projectId]/_components/ChatSessionSidebar";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api/v1";

export interface StreamChatParams {
  projectId: string;
  chatId: string;
  content: string;
  step: string;
  discoveryStep?: number;
  onTextDelta?: (delta: string) => void;
  onFinish?: (payload: {
    session: ChatSession;
    data: any;
    tokensUsed?: any;
    cost?: number;
  }) => void;
  onError?: (error: Error) => void;
  signal?: AbortSignal;
}

export const streamChatMessage = async (params: StreamChatParams): Promise<void> => {
  const {
    projectId,
    chatId,
    content,
    step,
    discoveryStep,
    onTextDelta,
    onFinish,
    onError,
    signal,
  } = params;

  // Proactively refresh token if needed
  let token = getStoredAuthToken();
  if (token) {
    const decoded = decodeJwt(token);
    if (decoded?.exp && Date.now() >= (decoded.exp - 15) * 1000) {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        token = getStoredAuthToken();
      }
    }
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  try {
    const res = await fetch(
      `${API_BASE_URL}/projects/${projectId}/chats/${chatId}/messages/stream`,
      {
        method: "POST",
        headers,
        credentials: "include",
        body: JSON.stringify({
          content,
          step,
          discoveryStep,
        }),
        signal,
      }
    );

    if (!res.ok) {
      let errMsg = `HTTP ${res.status}: Failed to stream AI response`;
      try {
        const errJson = await res.json();
        errMsg = errJson.error?.message || errJson.message || errMsg;
      } catch (_) {}
      const error = new Error(errMsg);
      onError?.(error);
      throw error;
    }

    if (!res.body) {
      const error = new Error("Response body is not readable");
      onError?.(error);
      throw error;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "";

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // SSE lines are separated by double newlines or single newlines
      const lines = buffer.split("\n\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) continue;

        const jsonStr = trimmed.replace(/^data:\s*/, "").trim();
        if (!jsonStr) continue;

        try {
          const event = JSON.parse(jsonStr);

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
            const err = new Error(event.error || "Streaming error occurred");
            onError?.(err);
            throw err;
          }
        } catch (parseErr) {
          console.warn("[ai-stream] Failed to parse SSE event JSON:", jsonStr, parseErr);
        }
      }
    }
  } catch (err: any) {
    if (err.name === "AbortError") {
      console.log("[ai-stream] Stream aborted by user");
      return;
    }
    onError?.(err);
    throw err;
  }
};
