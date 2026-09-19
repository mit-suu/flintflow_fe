"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { ApiClientError, apiCall, refreshSession } from "@/lib/api";
import { streamChatMessage } from "@/lib/ai-stream";
import { clearAuthToken, getStoredAuthToken, isAuthenticated } from "@/lib/auth";
import type { ChangeRequiresCrMeta } from "@/types/change-request";
import type { ChatMessage, ChatSession } from "@/types/chat";
import type { Project } from "@/types/project";
import type { User } from "@/types/user";

const errorMessage = (error: unknown, fallback: string) => (error instanceof Error ? error.message || fallback : fallback);

/**
 * Dữ liệu chung của workspace: project, user, chat session, gửi tin nhắn/đính kèm.
 * Pipeline (step, gate) nằm ở `useStepRunner`; Spine ở `useSpine`.
 */
export function useWorkspace(projectId: string) {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [project, setProject] = useState<Project | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSession, setActiveSession] = useState<ChatSession | null>(null);
  const [inputMessage, setInputMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [streamingMessage, setStreamingMessage] = useState<string | null>(null);
  const [pendingAttachments, setPendingAttachments] = useState<File[]>([]);
  /** Mode 1 (G9, BR-03): lệnh sửa trong chat bị BE chặn `409 CHANGE_REQUIRES_CR` ⇒ gợi ý tạo CR điền sẵn. */
  // FLF-186: lệnh sửa trong chat sau v1 ⇒ BE đã tạo CR nguồn chat (`change_request`) — thẻ trỏ thẳng tới CR đó
  const [crPrefill, setCrPrefill] = useState<(ChangeRequiresCrMeta["prefill"] & { instruction: string; change_request?: ChangeRequiresCrMeta["change_request"] }) | null>(null);
  const didInit = useRef(false);

  const refreshUser = useCallback(() => {
    apiCall<User>("/users/me")
      .then((res) => res.data && setUser(res.data))
      .catch(() => undefined);
  }, []);

  const createSession = useCallback(async () => {
    try {
      const res = await apiCall<ChatSession>(`/projects/${projectId}/chats`, { method: "POST" });
      if (res.data) {
        const created = res.data;
        setSessions((prev) => [created, ...prev.map((s) => ({ ...s, isActive: false }))]);
        setActiveSession(created);
      }
    } catch (err) {
      alert(errorMessage(err, "Không thể tạo cuộc trò chuyện mới"));
    }
  }, [projectId]);

  useEffect(() => {
    if (!projectId || didInit.current) return;
    didInit.current = true;

    // T23: workspace luôn chạy trên BE thật. msw chỉ còn dùng trong vitest (`mocks/server.ts`) —
    // không còn đường bật mock ở runtime, nên không có chuyện chạy dev mà tưởng đang nói chuyện với BE.
    const init = async () => {
      // Chỉ về /login khi BE từ chối refresh token (refreshSession đã xoá token). Lỗi mạng / 5xx thì
      // vẫn thử tải dữ liệu — apiCall sẽ tự refresh lại; đăng xuất ở đây sẽ gọi /auth/logout và thu hồi
      // một phiên còn hợp lệ (FLF-137).
      if (!isAuthenticated() && (await refreshSession()) === "rejected") {
        router.push("/login");
        return;
      }

      try {
        const [projectRes, userRes, sessionsRes] = await Promise.all([
          apiCall<Project>(`/projects/${projectId}`),
          apiCall<User>("/users/me"),
          apiCall<ChatSession[]>(`/projects/${projectId}/chats`),
        ]);
        setProject(projectRes.data);
        setUser(userRes.data);
        const list = sessionsRes.data ?? [];
        setSessions(list);
        const active = list.find((s) => s.isActive) ?? list[0];
        if (active) setActiveSession(active);
        else await createSession();
      } catch (err) {
        console.error("Workspace init failed:", err);
        if ((err as { status?: number }).status === 401) {
          if (!getStoredAuthToken()) {
            router.push("/login");
          } else if (isAuthenticated()) {
            // Token còn hạn mà BE vẫn 401 ⇒ phiên thật sự không hợp lệ
            clearAuthToken();
            router.push("/login");
          } else {
            // Token hết hạn nhưng refresh chỉ lỗi mạng / 5xx ⇒ giữ phiên
            alert("Không kết nối được máy chủ. Vui lòng tải lại trang.");
          }
        }
      } finally {
        setReady(true);
      }
    };
    void init();
  }, [projectId, router, createSession]);

  const selectSession = useCallback(
    async (session: ChatSession) => {
      try {
        const res = await apiCall<ChatSession>(`/projects/${projectId}/chats/${session._id}`);
        if (res.data) {
          setActiveSession(res.data);
          setSessions((prev) => prev.map((s) => ({ ...s, isActive: s._id === session._id })));
        }
      } catch (err) {
        alert(errorMessage(err, "Không thể tải cuộc trò chuyện"));
      }
    },
    [projectId]
  );

  const deleteSession = useCallback(
    async (sessionId: string) => {
      try {
        await apiCall(`/projects/${projectId}/chats/${sessionId}`, { method: "DELETE" });
        const remaining = sessions.filter((s) => s._id !== sessionId);
        setSessions(remaining);
        if (activeSession?._id === sessionId) {
          if (remaining[0]) await selectSession(remaining[0]);
          else setActiveSession(null);
        }
      } catch (err) {
        alert("Không thể xoá cuộc trò chuyện: " + errorMessage(err, "Lỗi"));
      }
    },
    [projectId, sessions, activeSession, selectSession]
  );

  /** Hỏi đáp tự do trong chat; step hiện tại gửi kèm để BE lưu transcript theo step. */
  const sendMessage = useCallback(
    async (currentStep: string | null, customContent?: string) => {
      const text = customContent ?? inputMessage;
      if ((!text.trim() && pendingAttachments.length === 0) || !activeSession || sending) return;

      setSending(true);
      setInputMessage("");
      setCrPrefill(null);
      const content = text.trim() || "[Đính kèm tài liệu]";
      const step = currentStep ?? "chat";
      const optimistic: ChatMessage = { role: "user", content, step, createdAt: new Date().toISOString() };
      setActiveSession((prev) => (prev ? { ...prev, messages: [...prev.messages, optimistic] } : prev));

      try {
        for (const file of pendingAttachments) {
          const formData = new FormData();
          formData.append("file", file);
          await apiCall(`/projects/${projectId}/documents`, { method: "POST", body: formData });
        }
        setPendingAttachments([]);

        setStreamingMessage("");
        await streamChatMessage({
          projectId,
          chatId: activeSession._id,
          content,
          step,
          onTextDelta: (delta) => setStreamingMessage((prev) => (prev ?? "") + delta),
          onFinish: ({ session }) => {
            setActiveSession(session);
            setStreamingMessage(null);
            refreshUser();
          },
          onError: (err) => {
            // Mode 1 chặn lệnh sửa bằng 409 CHANGE_REQUIRES_CR — luồng bình thường, xử lý ở catch bên dưới
            if (!(err instanceof ApiClientError && err.code === "CHANGE_REQUIRES_CR")) console.error("[Chat] Stream error:", err);
            setStreamingMessage(null);
          },
        });
      } catch (err) {
        setStreamingMessage(null);
        setActiveSession((prev) => (prev ? { ...prev, messages: prev.messages.filter((m) => m !== optimistic) } : prev));
        const meta = err instanceof ApiClientError && err.code === "CHANGE_REQUIRES_CR" ? (err.meta as ChangeRequiresCrMeta | undefined) : undefined;
        if (meta?.prefill) setCrPrefill({ ...meta.prefill, instruction: content, ...(meta.change_request ? { change_request: meta.change_request } : {}) });
        else alert(errorMessage(err, "Không thể gửi tin nhắn"));
      } finally {
        setSending(false);
      }
    },
    [activeSession, inputMessage, pendingAttachments, projectId, refreshUser, sending]
  );

  const selectAttachment = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    setPendingAttachments((prev) => [...prev, ...Array.from(files)]);
    event.target.value = "";
  }, []);

  const removeAttachment = useCallback(
    (fileName: string) => setPendingAttachments((prev) => prev.filter((f) => f.name !== fileName)),
    []
  );

  const logout = useCallback(() => {
    clearAuthToken();
    router.push("/login");
  }, [router]);

  return useMemo(
    () => ({
      ready,
      project,
      user,
      sessions,
      activeSession,
      inputMessage,
      setInputMessage,
      sending,
      streamingMessage,
      pendingAttachments,
      createSession,
      selectSession,
      deleteSession,
      sendMessage,
      selectAttachment,
      removeAttachment,
      refreshUser,
      logout,
      crPrefill,
      dismissCrPrefill: () => setCrPrefill(null),
    }),
    [
      ready,
      project,
      user,
      sessions,
      activeSession,
      inputMessage,
      sending,
      streamingMessage,
      pendingAttachments,
      createSession,
      selectSession,
      deleteSession,
      sendMessage,
      selectAttachment,
      removeAttachment,
      refreshUser,
      logout,
      crPrefill,
    ]
  );
}
