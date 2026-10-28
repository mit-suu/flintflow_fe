"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { ApiClientError, apiCall, refreshSession } from "@/lib/api";
import { ChatStreamError, streamChatMessage } from "@/lib/ai-stream";
import { isAiErrorCode } from "@/lib/ai-error-codes";
import { getStoredAuthToken, isAuthenticated, logoutAndRedirect } from "@/lib/auth";
import { fetchOrganization } from "@/lib/api/orgs";
import { getActiveOrgId } from "@/lib/api/token-store";
import type { OrgRole } from "@/types/organization";
import type { ChangeRequiresCrMeta } from "@/types/change-request";
import type { ChatMessage, ChatSession } from "@/types/chat";
import type { Project } from "@/types/project";
import type { User } from "@/types/user";
import { userErrorMessage } from "@/lib/api/error-messages";

/** Thông báo ở pill toast của trang — có thể là: */
export type SessionNoticeKey =
  | "loadFailed"
  | "createFailed"
  | "offline"
  | "deleteFailed"
  | "uploadFailed"
  | "knowledgeFailed"
  | "stopped"
  | "knowledgeDisabled"
  | "sendFailed";

/**
 * Hook không gọi `useTranslations` (lỗi ghi trong callback/effect, test `renderHook` không có provider — xem
 * `lib/hook-errors.ts`) nên thông báo là MÃ: `{ key }` ⇒ trang dịch `workspace.session.<key>`; `{ text }` ⇒ câu BE đã dịch
 * sẵn, hiện nguyên văn. `deleteFailed` kèm `error` là câu BE (thiếu ⇒ câu "Lỗi" chung).
 */
export type WorkspaceNotice = { key: SessionNoticeKey; error?: string } | { text: string };

const NO_MESSAGE = "@";
const errorNotice = (error: unknown, key: SessionNoticeKey): WorkspaceNotice => {
  const message = userErrorMessage(error, NO_MESSAGE);
  return message === NO_MESSAGE ? { key } : { text: message };
};

/** Nội dung tin khi chỉ gửi đính kèm — câu FE gửi thay user, theo ngôn ngữ giao diện (nơi gọi truyền vào). */
const DEFAULT_ATTACHMENT_ONLY_TEXT = "[Đính kèm tài liệu]";

/**
 * Dữ liệu chung của workspace: project, user, chat session, gửi tin nhắn/đính kèm.
 * Pipeline (step, gate) nằm ở `useStepRunner`; Spine ở `useSpine`.
 */
export interface UseWorkspaceOptions {
  attachmentOnlyText?: string;
  /**
   * FLF-332: cổng cứng credit trước khi tải tài liệu đính kèm lên (mỗi tệp một lượt đọc tốn credit). Trả `false` ⇒ không tải,
   * không gửi; tệp và chữ giữ nguyên trong ô chat.
   */
  confirmAttachments?: (files: File[]) => Promise<boolean>;
}

/** Lượt chat gãy vì AI lỗi (FLF-332): giữ lại để "Thử lại ngay" gửi lại đúng tin đó. */
export interface ChatAiError {
  code: string;
  message: string;
  step: string | null;
  text: string;
  knowledge: boolean;
}

export function useWorkspace(projectId: string, { attachmentOnlyText = DEFAULT_ATTACHMENT_ONLY_TEXT, confirmAttachments }: UseWorkspaceOptions = {}) {
  const [ready, setReady] = useState(false);
  const [project, setProject] = useState<Project | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSession, setActiveSession] = useState<ChatSession | null>(null);
  const [inputMessage, setInputMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [streamingMessage, setStreamingMessage] = useState<string | null>(null);
  /** Đang chờ câu trả lời tri thức — luồng đó không stream chữ nên `streamingMessage` không nói được gì. */
  const [knowledgePending, setKnowledgePending] = useState(false);
  /** BE trả `409 KNOWLEDGE_DISABLED` ⇒ tính năng tắt ở máy chủ, ẩn chip và đừng thử lại. */
  const [knowledgeDisabled, setKnowledgeDisabled] = useState(false);
  const [pendingAttachments, setPendingAttachments] = useState<File[]>([]);
  /**
   * Mode 1 (G9, BR-03; v3 — BPMN 3.1): lệnh sửa trong chat bị BE chặn `409 CHANGE_REQUIRES_CR` ⇒ thẻ mời tạo CR, mở form
   * 3.1 điền sẵn (BE không tự tạo CR nữa).
   */
  const [crPrefill, setCrPrefill] = useState<(ChangeRequiresCrMeta["prefill"] & { instruction: string }) | null>(null);
  const didInit = useRef(false);
  /** Lượt chat đang stream — `stopMessage` huỷ fetch, BE thấy luồng đóng thì ngắt model và không ghi tin AI. */
  const streamAbortRef = useRef<AbortController | null>(null);
  /** Thông báo lỗi hiện ở pill toast của trang (thay `alert()` — FLF-244). */
  const [notice, setNotice] = useState<WorkspaceNotice | null>(null);
  /** Banner "AI lỗi — Thử lại ngay / Để sau" của chat chính (FLF-332). */
  const [aiError, setAiError] = useState<ChatAiError | null>(null);
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
        setNotice(errorNotice(err, "loadFailed"));
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
        setNotice(errorNotice(err, "createFailed"));
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
            setNotice({ key: "offline" });
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
        const message = userErrorMessage(err, NO_MESSAGE);
        setNotice({ key: "deleteFailed", ...(message === NO_MESSAGE ? {} : { error: message }) });
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
      setNotice(errorNotice(err, "uploadFailed"));
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

  /**
   * Hỏi đáp tự do trong chat; step hiện tại gửi kèm để BE lưu transcript theo step. Trả `data` của sự kiện `finish`
   * (vd. `kind: "change_preview"` kèm `preview` khi tin bị nhận là lệnh sửa) — `undefined` khi không gửi được.
   *
   * `opts.knowledge` ⇒ lượt hỏi tri thức (contract §1.2): BE trả lời từ Knowledge RAG, không stream chữ,
   * và lượt này không thành câu trả lời của step.
   */
  const sendMessage = useCallback(
    async (currentStep: string | null, customContent?: string, opts?: { knowledge?: boolean }): Promise<unknown> => {
      const text = customContent ?? inputMessage;
      if ((!text.trim() && pendingAttachments.length === 0) || !activeSession || sending) return undefined;
      let finishData: unknown;

      setSending(true);
      setInputMessage("");
      setCrPrefill(null);
      setAiError(null);
      const content = text.trim() || attachmentOnlyText;
      const step = currentStep ?? "chat";
      const optimistic: ChatMessage = { role: "user", content, step, createdAt: new Date().toISOString() };
      setActiveSession((prev) => (prev ? { ...prev, messages: [...prev.messages, optimistic] } : prev));

      try {
        // FLF-332: báo credit đọc tài liệu trước khi tải lên — Huỷ thì không gọi AI, tiến độ giữ nguyên
        if (pendingAttachments.length > 0 && confirmAttachments && !(await confirmAttachments(pendingAttachments))) {
          setActiveSession((prev) => (prev ? { ...prev, messages: prev.messages.filter((m) => m !== optimistic) } : prev));
          setInputMessage(text);
          return undefined;
        }
        if (!(await uploadPendingAttachments())) {
          // Tệp chưa lên được (đã báo lỗi): gỡ tin tạm, trả chữ về ô chat để user gửi lại
          setActiveSession((prev) => (prev ? { ...prev, messages: prev.messages.filter((m) => m !== optimistic) } : prev));
          setInputMessage(text);
          return undefined;
        }

        setStreamingMessage("");
        setKnowledgePending(Boolean(opts?.knowledge));
        const abort = new AbortController();
        streamAbortRef.current = abort;
        await streamChatMessage({
          projectId,
          chatId: activeSession._id,
          content,
          step,
          knowledge: opts?.knowledge,
          signal: abort.signal,
          onTextDelta: (delta) => setStreamingMessage((prev) => (prev ?? "") + delta),
          onFinish: ({ session, data }) => {
            finishData = data;
            setKnowledgePending(false);
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
            setKnowledgePending(false);
            // Sự kiện `error` giữa luồng (hết credit, provider lỗi) KHÔNG làm `streamSse` ném, nên
            // `catch` bên dưới không chạy. Chat thường còn phần chữ đã stream để user hiểu chuyện gì
            // xảy ra; lượt tri thức không stream chữ nên nếu im lặng thì chỉ còn cái spinner tắt đi.
            if (opts?.knowledge) {
              setActiveSession((prev) => (prev ? { ...prev, messages: prev.messages.filter((m) => m !== optimistic) } : prev));
              setInputMessage(text);
              setNotice(errorNotice(err, "knowledgeFailed"));
            } else if (err instanceof ChatStreamError && isAiErrorCode(err.code)) {
              // FLF-332: AI lỗi ⇒ credit đã hoàn, BE không ghi tin — gỡ tin tạm, banner mời Thử lại ngay / Để sau
              setActiveSession((prev) => (prev ? { ...prev, messages: prev.messages.filter((m) => m !== optimistic) } : prev));
              setAiError({ code: err.code ?? "AI_EXECUTION_FAILED", message: err.message, step: currentStep, text, knowledge: false });
            }
          },
        });
        // `streamSse` nuốt AbortError ⇒ về đây không có `finish`. BE đã ghi tin user (giữ tin tạm), bỏ chữ dở
        // vì BE không lưu nó — tải lại trang vẫn thấy đúng như vậy.
        if (abort.signal.aborted) {
          setStreamingMessage(null);
          setNotice({ key: "stopped" });
        }
      } catch (err) {
        setStreamingMessage(null);
        setActiveSession((prev) => (prev ? { ...prev, messages: prev.messages.filter((m) => m !== optimistic) } : prev));
        // Tính năng tắt ở máy chủ: BE không ghi gì vào phiên, nên gỡ tin tạm (ở trên) là sạch. Ẩn chip
        // thay vì để user bấm lại một thứ chắc chắn không chạy.
        if (err instanceof ApiClientError && err.code === "KNOWLEDGE_DISABLED") {
          setKnowledgeDisabled(true);
          setNotice({ key: "knowledgeDisabled" });
          setInputMessage(text);
          return undefined;
        }
        const meta = err instanceof ApiClientError && err.code === "CHANGE_REQUIRES_CR" ? (err.meta as ChangeRequiresCrMeta | undefined) : undefined;
        if (meta?.prefill) setCrPrefill({ ...meta.prefill, instruction: content });
        else setNotice(errorNotice(err, "sendFailed"));
      } finally {
        streamAbortRef.current = null;
        setSending(false);
        setKnowledgePending(false);
      }
      return finishData;
    },
    [activeSession, inputMessage, pendingAttachments, projectId, refreshUser, sending, uploadPendingAttachments, attachmentOnlyText, confirmAttachments]
  );

  /** "Thử lại ngay" của banner AI lỗi: gửi lại đúng tin đó (BE kiểm credit lại từ đầu). */
  const retryAiError = useCallback(async () => {
    const failed = aiError;
    if (!failed) return undefined;
    setAiError(null);
    return sendMessage(failed.step, failed.text, failed.knowledge ? { knowledge: true } : undefined);
  }, [aiError, sendMessage]);

  const dismissAiError = useCallback(() => setAiError(null), []);

  /** Nút dừng / Esc: huỷ lượt chat đang chạy. Không có lượt nào thì không làm gì. */
  const stopMessage = useCallback(() => {
    streamAbortRef.current?.abort();
  }, []);

  // Rời trang giữa lượt ⇒ đóng luồng để BE không sinh tiếp
  useEffect(() => () => streamAbortRef.current?.abort(), []);

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

  /**
   * Thay project bằng bản BE vừa trả sau một lượt ghi (`PATCH document-language` từ lệnh chat — FLF-265 §3.7) ⇒ chip ngôn
   * ngữ và khoá tải lại tài liệu theo ngôn ngữ mới, khỏi tải lại cả workspace.
   */
  const replaceProject = useCallback((next: Project) => setProject(next), []);

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
      knowledgePending,
      knowledgeDisabled,
      pendingAttachments,
      createSession,
      selectSession,
      deleteSession,
      pipelineSession,
      isPipelineActive,
      canEdit,
      orgRole,
      sendMessage,
      stopMessage,
      uploadPendingAttachments,
      appendLocalMessage,
      dropLocalMessage,
      reloadActiveSession,
      selectAttachment,
      removeAttachment,
      refreshUser,
      replaceProject,
      logout,
      crPrefill,
      dismissCrPrefill: () => setCrPrefill(null),
      notice,
      clearNotice: () => setNotice(null),
      aiError,
      retryAiError,
      dismissAiError,
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
      knowledgePending,
      knowledgeDisabled,
      pendingAttachments,
      createSession,
      selectSession,
      deleteSession,
      pipelineSession,
      isPipelineActive,
      canEdit,
      orgRole,
      sendMessage,
      stopMessage,
      uploadPendingAttachments,
      appendLocalMessage,
      dropLocalMessage,
      reloadActiveSession,
      selectAttachment,
      removeAttachment,
      refreshUser,
      replaceProject,
      logout,
      crPrefill,
      notice,
      aiError,
      retryAiError,
      dismissAiError,
    ]
  );
}
