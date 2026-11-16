"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useGoogleLogin } from "@react-oauth/google";
import { ApiClientError } from "@/lib/api/client";
import {
  connectGoogle,
  disconnectGoogle,
  getGoogleStatus,
  type GoogleConnectionStatus,
} from "@/lib/api/google";

export const GOOGLE_DRIVE_FILE_SCOPE = "https://www.googleapis.com/auth/drive.file";
/** `openid email` để BE đọc được email Google đã nối từ `id_token`. */
const CONNECT_SCOPE = `openid email ${GOOGLE_DRIVE_FILE_SCOPE}`;

/** User đóng / từ chối popup Google, hoặc trình duyệt chặn popup. Không phải lỗi hệ thống. */
export class GoogleConsentCancelledError extends Error {
  constructor(readonly reason: string) {
    super(`google consent cancelled: ${reason}`);
    this.name = "GoogleConsentCancelledError";
  }
}

export type GoogleConnectLoad =
  | { kind: "loading" }
  /** BE chưa bật tích hợp (`GOOGLE_INTEGRATION_DISABLED`) ⇒ ẩn mọi nút Google. */
  | { kind: "unavailable" }
  | { kind: "error"; error: unknown }
  | { kind: "ready"; status: GoogleConnectionStatus };

export interface UseGoogleConnect {
  load: GoogleConnectLoad;
  /** Mở popup đồng ý của Google rồi gửi mã cho BE. Phải gọi trong handler của một cú click (popup blocker). */
  connect: () => Promise<GoogleConnectionStatus>;
  /** Đã nối thì trả ngay, chưa nối / cần nối lại thì mở popup. Dùng trước mỗi thao tác Google (xuất, nhập, trợ lý). */
  ensureConnected: () => Promise<GoogleConnectionStatus>;
  disconnect: () => Promise<void>;
  /** Thao tác Google nhận `GOOGLE_RECONNECT_REQUIRED` ⇒ gọi để lần sau `ensureConnected` mở lại popup. */
  markReconnectRequired: () => void;
}

/**
 * Kết nối tài khoản Google (quyền `drive.file`, luồng auth-code ⇒ BE có refresh token).
 *
 * Chỉ dùng bên trong `GoogleOAuthProvider` — tức là khi `isGoogleAuthEnabled` (`lib/google-auth.ts`); component gọi
 * hook này phải được bọc bởi một vỏ trả `null` khi không có client id, như `GoogleButton`.
 */
export function useGoogleConnect(): UseGoogleConnect {
  const [load, setLoad] = useState<GoogleConnectLoad>({ kind: "loading" });
  const pending = useRef<{ resolve: (s: GoogleConnectionStatus) => void; reject: (e: unknown) => void } | null>(null);

  useEffect(() => {
    let cancelled = false;
    getGoogleStatus()
      .then((status) => {
        if (!cancelled) setLoad({ kind: "ready", status });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        const disabled = error instanceof ApiClientError && error.code === "GOOGLE_INTEGRATION_DISABLED";
        setLoad(disabled ? { kind: "unavailable" } : { kind: "error", error });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const settle = (outcome: { status: GoogleConnectionStatus } | { error: unknown }) => {
    const current = pending.current;
    pending.current = null;
    if (!current) return;
    if ("status" in outcome) current.resolve(outcome.status);
    else current.reject(outcome.error);
  };

  const login = useGoogleLogin({
    flow: "auth-code",
    scope: CONNECT_SCOPE,
    // Code client của Google Identity Services không nhận `prompt`. Google không trả refresh token ⇒ BE báo
    // GOOGLE_CONSENT_INCOMPLETE; "Ngắt kết nối" thu hồi quyền phía Google nên lần nối sau luôn có màn đồng ý mới.
    onSuccess: async ({ code }) => {
      try {
        const status = await connectGoogle(code);
        setLoad({ kind: "ready", status });
        settle({ status });
      } catch (error) {
        settle({ error });
      }
    },
    onError: (response) => settle({ error: new GoogleConsentCancelledError(response.error ?? "access_denied") }),
    // popup_closed, popup_failed_to_open (bị chặn)
    onNonOAuthError: (nonOAuthError) => settle({ error: new GoogleConsentCancelledError(nonOAuthError.type) }),
  });

  const connect = useCallback(
    () =>
      new Promise<GoogleConnectionStatus>((resolve, reject) => {
        // Lượt cũ chưa xong (user bấm lại) ⇒ coi như đã huỷ
        pending.current?.reject(new GoogleConsentCancelledError("superseded"));
        pending.current = { resolve, reject };
        login();
      }),
    [login]
  );

  const ensureConnected = useCallback(async () => {
    if (load.kind === "ready" && load.status.status === "connected") return load.status;
    return connect();
  }, [load, connect]);

  const disconnect = useCallback(async () => {
    const status = await disconnectGoogle();
    setLoad({ kind: "ready", status });
  }, []);

  const markReconnectRequired = useCallback(() => {
    setLoad((prev) =>
      prev.kind === "ready" ? { kind: "ready", status: { ...prev.status, status: "reconnect_required" } } : prev
    );
  }, []);

  return { load, connect, ensureConnected, disconnect, markReconnectRequired };
}
