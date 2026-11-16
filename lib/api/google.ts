/**
 * `/integrations/google` (BE `modules/google`, contract #40–#43) — kết nối tài khoản Google với quyền `drive.file`
 * cho xuất / nhập Google Docs. Luồng riêng, không liên quan đăng nhập bằng Google.
 *
 * BE thiếu cấu hình ⇒ mọi lời gọi ném `ApiClientError` code `GOOGLE_INTEGRATION_DISABLED` (503): ẩn tính năng.
 * Google thu hồi quyền ⇒ `GOOGLE_RECONNECT_REQUIRED` (401): mời user kết nối lại.
 */
import { apiCall } from "./client";

export type GoogleConnectionState = "connected" | "disconnected" | "reconnect_required";

export interface GoogleConnectionStatus {
  status: GoogleConnectionState;
  email: string | null;
  connectedAt: string | null;
}

export interface GoogleAccessToken {
  accessToken: string;
  /** Epoch ms, `null` nếu Google không báo. */
  expiresAt: number | null;
}

const BASE = "/integrations/google";

/** Gửi mã auth-code từ popup Google; BE đổi lấy refresh token và lưu đã mã hoá. */
export const connectGoogle = async (code: string): Promise<GoogleConnectionStatus> => {
  const res = await apiCall<GoogleConnectionStatus>(`${BASE}/connect`, { method: "POST", body: JSON.stringify({ code }) });
  return res.data as GoogleConnectionStatus;
};

export const getGoogleStatus = async (): Promise<GoogleConnectionStatus> => {
  const res = await apiCall<GoogleConnectionStatus>(`${BASE}/status`);
  return res.data as GoogleConnectionStatus;
};

export const disconnectGoogle = async (): Promise<GoogleConnectionStatus> => {
  const res = await apiCall<GoogleConnectionStatus>(BASE, { method: "DELETE" });
  return res.data as GoogleConnectionStatus;
};

/** Một Google Doc đã xuất từ dự án (contract #45) — của chính user đang đăng nhập. */
export interface GoogleDocLink {
  fileId: string;
  title: string;
  webViewLink: string;
  source: "draft" | "baseline";
  lang: string;
  baselineId: string | null;
  exportedAt: string;
}

export const getGoogleDocLinks = async (projectId: string): Promise<GoogleDocLink[]> => {
  const res = await apiCall<GoogleDocLink[]>(`/projects/${projectId}/google-docs/links`);
  return res.data ?? [];
};

/** Access token ngắn hạn cho Google Picker. */
export const getGoogleAccessToken = async (): Promise<GoogleAccessToken> => {
  const res = await apiCall<GoogleAccessToken>(`${BASE}/access-token`);
  return res.data as GoogleAccessToken;
};
