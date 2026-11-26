import type { ProjectStreamEvent } from "@/types/project-events";
import { consumeSseBody } from "../ai-stream";
import { ApiClientError, authFetch, ensureFreshToken, STREAM_MIN_TOKEN_TTL_MS } from "./client";

/**
 * Mở luồng SSE `GET /projects/:id/events` (pipeline-contract #56) và phát từng sự kiện tới khi luồng đóng
 * (server gửi `bye`, mất mạng) hoặc bị huỷ bằng `signal` (kết thúc im lặng). HTTP lỗi ⇒ ném `ApiClientError`.
 */
export const openProjectEvents = async (
  projectId: string,
  onEvent: (event: ProjectStreamEvent) => void,
  signal: AbortSignal
): Promise<void> => {
  // Luồng sống tới 10 phút: refresh trước khi mở để token không hết hạn ngay đầu luồng
  await ensureFreshToken(STREAM_MIN_TOKEN_TTL_MS);
  const res = await authFetch(`/projects/${projectId}/events`, { method: "GET", signal, headers: { Accept: "text/event-stream" } });
  if (!res.ok) throw new ApiClientError(res.status, "STREAM_FAILED", `HTTP ${res.status}`);
  if (!res.body) throw new Error("Response body is not readable");
  await consumeSseBody<ProjectStreamEvent>(res.body, onEvent, signal);
};
