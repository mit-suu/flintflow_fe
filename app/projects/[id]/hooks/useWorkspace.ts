"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { ApiClientError, apiCall, refreshSession } from "@/lib/api";
import { streamChatMessage } from "@/lib/ai-stream";
import { getStoredAuthToken, isAuthenticated, logoutAndRedirect } from "@/lib/auth";
import { fetchOrganization } from "@/lib/api/orgs";
import { getActiveOrgId } from "@/lib/api/token-store";
import type { OrgRole } from "@/types/organization";
import type { ChangeRequiresCrMeta } from "@/types/change-request";
import type { ChatMessage, ChatSession } from "@/types/chat";
import type { Project } from "@/types/project";
import type { User } from "@/types/user";
import { userErrorMessage } from "@/lib/api/error-messages";

const errorMessage = (error: unknown, fallback: string) => userErrorMessage(error, fallback);

/**
 * Dữ liệu chung của workspace: project, user, chat session, gửi tin nhắn/đính kèm.
 * Pipeline (step, gate) nằm ở `useStepRunner`; Spine ở `useSpine`.
 */
export function useWorkspace(projectId: string) {
  const [ready, setReady] = useState(false);
  const [project, setProject] = useState<Project | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSession, setActiveSession] = useState<ChatSession | null>(null);
  const [inputMessage, setInputMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [streamingMessage, setStreamingMessage] = useState<string | null>(null);
  const [pendingAttachments, setPendingAttachments] = useState<File[]>([]);
  /**
   * Mode 1 (G9, BR-03; v3 — BPMN 3.1): lệnh sửa trong chat bị BE chặn `409 CHANGE_REQUIRES_CR` ⇒ thẻ mời tạo CR, mở form
   * 3.1 điền sẵn (BE không tự tạo CR nữa).
   */
  const [crPrefill, setCrPrefill] = useState<(ChangeRequiresCrMeta["prefill"] & { instruction: string }) | null>(null);
  const didInit = useRef(false);
  /** Thông báo lỗi hiện ở pill toast của trang (thay `alert()` — FLF-244). */
  const [notice, setNotice] = useState<string | null>(null);
  /** Vai trò trong org đang mở — Viewer chỉ đọc (FLF-244). `null` khi chưa biết: không khoá gì, BE vẫn chặn. */
  const [orgRole, setOrgRole] = useState<OrgRole | null>(null);

  const refreshUser = useCallback(() => {
    apiCall<User>("/users/me")
      .then((res) => res.data && setUser(res.data))
      .catch(() => undefined);
  }, []);

  /** Tải đủ lịch sử một phiên (`GET /chats` chỉ kèm tin cuối — FLF-244). */
  const fetchSession = useCallback(
    async (sessionId: string): Promise<ChatSession | null> => {
      const res = await apiCall<ChatSession>(`/projects/${projectId}/chats/${sessionId}`);
      return res.data ?? null;
    },
    [projectId]
  );

  const selectSession = useCallback(
    async (session: ChatSession) => {
      try {
        const full = await fetchSession(session._id);
        if (full) setActiveSession(full);
      } catch (err) {
        setNotice(errorMessage(err, "Không thể tải cuộc trò chuyện"));
      }
    },
    [fetchSession]
  );

  /**
   * Phiên mới. Đã có phiên phụ chưa nhắn gì ⇒ mở lại phiên đó thay vì tạo thêm phiên rỗng (FLF-244). `quiet`: lúc vào
   * workspace mà Viewer không được tạo phiên (403) thì im lặng — khung chat chỉ để đọc.
   */
  const createSession = useCallback(
    async (options: { quiet?: boolean } = {}) => {
      const empty = sessions.find((s) => s.is_pipeline === false && (s.messages?.length ?? 0) === 0);
      if (empty) return selectSession(empty);
      try {
        const res = await apiCall<ChatSession>(`/projects/${projectId}/chats`, { method: "POST" });
        if (res.data) {
          const created = res.data;
          setSessions((prev) => [created, ...prev]);
          setActiveSession(created);
        }
      } catch (err) {
        if (options.quiet && err instanceof ApiClientError && err.status === 403) return;
        setNotice(errorMessage(err, "Không thể tạo cuộc trò chuyện mới"));
      }
    },
    [projectId, sessions, selectSession]
  );

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
        await logoutAndRedirect();
        return;
      }

      // Vai trò tải song song với phần còn lại nhưng PHẢI xong trước khi bật `ready` (xem finally): trước đây
      // `canEdit` mặc định true trong lúc chờ ⇒ Viewer thấy nút soạn thảo chớp lên, và `useSpine` gọi /resume
      // trước khi biết vai trò ⇒ 403. Lỗi thì coi như được sửa (BE vẫn chặn Viewer — viewerReadOnly).
      const orgId = getActiveOrgId();
      const rolePromise = orgId
        ? fetchOrganization(orgId)
            .then((org) => org.role)
            .catch(() => null)
        : Promise.resolve(null);

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
        // FLF-244: vào workspace luôn mở phiên chính (quy trình chạy ở đó), không phải phiên mới nhất
        const preferred = list.find((s) => s.is_pipeline) ?? list[0];
        if (preferred) setActiveSession((await fetchSession(preferred._id).catch(() => null)) ?? preferred);
        // Viewer không tạo được phiên (chỉ đọc) — đừng gửi một request chắc chắn 403
        else if ((await rolePromise) !== "viewer") await createSession({ quiet: true });
      } catch (err) {
        console.error("Workspace init failed:", err);
        if ((err as { status?: number }).status === 401) {
          if (!getStoredAuthToken()) {
            await logoutAndRedirect();
          } else if (isAuthenticated()) {
            // Token còn hạn mà BE vẫn 401 ⇒ phiên thật sự không hợp lệ
            await logoutAndRedirect();
          } else {
            // Token hết hạn nhưng refresh chỉ lỗi mạng / 5xx ⇒ giữ phiên
            setNotice("Không kết nối được máy chủ. Vui lòng tải lại trang.");
          }
        }
      } finally {
        setOrgRole(await rolePromise);
        setReady(true);
      }
    };
    void init();
  }, [projectId, createSession, fetchSession]);

  const deleteSession = useCallback(
    async (sessionId: string) => {
      try {
        await apiCall(`/projects/${projectId}/chats/${sessionId}`, { method: "DELETE" });
        const remaining = sessions.filter((s) => s._id !== sessionId);
        setSessions(remaining);
        if (activeSession?._id === sessionId) {
          // Về phiên chính; không còn phiên nào (dữ liệu cũ) ⇒ tạo phiên mới để khung chat không trống
          const next = remaining.find((s) => s.is_pipeline) ?? remaining[0];
          if (next) await selectSession(next);
          else {
            setActiveSession(null);
            await createSession();
          }
        }
      } catch (err) {
        setNotice("Không thể xoá cuộc trò chuyện: " + errorMessage(err, "Lỗi"));
      }
    },
    [projectId, sessions, activeSession, selectSession, createSession]
  );

  /** Phiên chạy quy trình (bất biến 7) — step runner luôn gửi id này, kể cả khi user đang xem phiên phụ. */
  const pipelineSession = useMemo(() => sessions.find((s) => s.is_pipeline) ?? null, [sessions]);
  /** Phiên đang mở là phiên chính (thiếu cờ ⇒ coi như chính, giữ hành vi cũ). Phiên phụ chỉ hỏi đáp và nhận lệnh sửa. */
  const isPipelineActive = activeSession?.is_pipeline !== false;
  /** Viewer không gửi tin, không chạy bước, không tạo/xoá phiên — ẩn các thao tác đó thay vì để bấm rồi 403. */
  const canEdit = orgRole !== "viewer";

  /**
   * Tải các tệp đang đính kèm lên `/documents` (dùng chung cho chat hỏi đáp và chat khởi động bước — FLF-221). Lỗi ⇒
   * `false`, giữ nguyên danh sách đính kèm để user thử lại; không có tệp nào ⇒ `true`.
   */
  const uploadPendingAttachments = useCallback(async (): Promise<boolean> => {
    if (pendingAttachments.length === 0) return true;
    try {
      for (const file of pendingAttachments) {
        const formData = new FormData();
        formData.append("file", file);
        await apiCall(`/projects/${projectId}/documents`, { method: "POST", body: formData });
      }
      setPendingAttachments([]);
      return true;
    } catch (err) {
      setNotice(errorMessage(err, "Không thể tải tệp đính kèm lên"));
      return false;
    }
  }, [pendingAttachments, projectId]);

  /**
   * Hiện ngay tin user vừa gửi khi tin đó đi thẳng vào lượt chạy bước (BE ghi transcript, FLF-221) — không chờ tải lại
   * phiên chat.
   */
  const appendLocalMessage = useCallback((content: string, step: string | null, role: ChatMessage["role"] = "user") => {
    const message: ChatMessage = { role, content, step: step ?? "chat", createdAt: new Date().toISOString() };
    setActiveSession((prev) => (prev ? { ...prev, messages: [...prev.messages, message] } : prev));
  }, []);

  /**
   * Tải lại phiên đang mở từ BE (lỗi ⇒ giữ nguyên, không báo) — sau lệnh sửa tài liệu, BE đã ghi lệnh + kết quả vào
   * phiên; tải lại thay tin hiện tạm bằng đúng transcript. Người dùng đã chuyển phiên khác thì bỏ qua.
   */
  const reloadActiveSession = useCallback(
    async (sessionId: string) => {
      try {
        const res = await apiCall<ChatSession>(`/projects/${projectId}/chats/${sessionId}`);
        if (res.data) setActiveSession((prev) => (prev?._id === sessionId ? res.data! : prev));
      } catch {
        // Tin hiện tạm vẫn còn — lần mở phiên sau sẽ thấy transcript đầy đủ
      }
    },
    [projectId]
  );

  /**
   * Gỡ tin vừa hiện tạm khi lượt gửi không đi tới đâu (chữ trả về ô nhập) — không để tin "ma" trong khung chat.
   * `role` để gỡ được cả tin AI hiện tạm (tin cổng chốt), không chỉ tin user.
   */
  const dropLocalMessage = useCallback((content: string, role: ChatMessage["role"] = "user") => {
    setActiveSession((prev) => {
      if (!prev) return prev;
      const index = prev.messages.findLastIndex((m) => m.role === role && m.content === content);
      return index < 0 ? prev : { ...prev, messages: prev.messages.filter((_, i) => i !== index) };
    });
  }, []);

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
        if (!(await uploadPendingAttachments())) {
          // Tệp chưa lên được (đã báo lỗi): gỡ tin tạm, trả chữ về ô chat để user gửi lại
          setActiveSession((prev) => (prev ? { ...prev, messages: prev.messages.filter((m) => m !== optimistic) } : prev));
          setInputMessage(text);
          return;
        }

        setStreamingMessage("");
        await streamChatMessage({
          projectId,
          chatId: activeSession._id,
          content,
          step,
          onTextDelta: (delta) => setStreamingMessage((prev) => (prev ?? "") + delta),
          onFinish: ({ session }) => {
            // User đã chuyển/tạo phiên khác giữa chừng ⇒ không kéo khung chat về phiên cũ; chỉ cập nhật xem trước
            setActiveSession((prev) => (prev?._id === session._id ? session : prev));
            setSessions((prev) => prev.map((s) => (s._id === session._id ? { ...s, messages: session.messages.slice(-1) } : s)));
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
        if (meta?.prefill) setCrPrefill({ ...meta.prefill, instruction: content });
        else setNotice(errorMessage(err, "Không thể gửi tin nhắn"));
      } finally {
        setSending(false);
      }
    },
    [activeSession, inputMessage, pendingAttachments, projectId, refreshUser, sending, uploadPendingAttachments]
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
    void logoutAndRedirect();
  }, []);

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
      pipelineSession,
      isPipelineActive,
      canEdit,
      sendMessage,
      uploadPendingAttachments,
      appendLocalMessage,
      dropLocalMessage,
      reloadActiveSession,
      selectAttachment,
      removeAttachment,
      refreshUser,
      logout,
      crPrefill,
      dismissCrPrefill: () => setCrPrefill(null),
      notice,
      clearNotice: () => setNotice(null),
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
      pipelineSession,
      isPipelineActive,
      canEdit,
      sendMessage,
      uploadPendingAttachments,
      appendLocalMessage,
      dropLocalMessage,
      reloadActiveSession,
      selectAttachment,
      removeAttachment,
      refreshUser,
      logout,
      crPrefill,
      notice,
    ]
  );
}
