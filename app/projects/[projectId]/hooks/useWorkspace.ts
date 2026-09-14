"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { apiCall, refreshAccessToken } from "@/lib/api";
import { streamChatMessage } from "@/lib/ai-stream";
import { clearAuthToken, isAuthenticated } from "@/lib/auth";
import type { ChatMessage, ChatSession } from "@/types/chat";
import type { Project } from "@/types/project";
import type { User } from "@/types/user";

const MOCK_ENABLED = process.env.NEXT_PUBLIC_API_MOCK === "1";

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

    const init = async () => {
      if (MOCK_ENABLED) {
        const { startMockWorker } = await import("@/mocks/browser");
        await startMockWorker();
      } else if (!isAuthenticated()) {
        const refreshed = await refreshAccessToken();
        if (!refreshed) {
          clearAuthToken();
          router.push("/login");
          return;
        }
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
          clearAuthToken();
          router.push("/login");
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
            console.error("[Chat] Stream error:", err);
            setStreamingMessage(null);
          },
        });
      } catch (err) {
        setStreamingMessage(null);
        setActiveSession((prev) => (prev ? { ...prev, messages: prev.messages.filter((m) => m !== optimistic) } : prev));
        alert(errorMessage(err, "Không thể gửi tin nhắn"));
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
    ]
  );
}
