import { useCallback, useEffect, useState } from "react";

export const OTP_LENGTH = 6;

/** Link tới trang nhập OTP; `expiresIn` (giây) do BE trả về khi vừa gửi mã. */
export const buildOtpHref = (path: string, email: string, expiresIn?: number): string => {
  const params = new URLSearchParams({ email });
  if (expiresIn) params.set("exp", String(Date.now() + expiresIn * 1000));
  return `${path}?${params.toString()}`;
};

export const buildVerifyEmailHref = (email: string, expiresIn?: number): string =>
  buildOtpHref("/verify-email", email, expiresIn);

export const buildResetPasswordHref = (email: string, expiresIn?: number): string =>
  buildOtpHref("/reset-password", email, expiresIn);

export const formatOtpTime = (seconds: number): string =>
  `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

const secondsUntil = (expiresAt: number) => Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000));

/**
 * Đếm ngược tới lúc OTP hết hạn. `initialExpiresAt` = 0 (vd. mở lại link cũ không có `exp`) ⇒ coi như đã
 * hết hạn để user bấm gửi lại.
 */
export const useOtpCountdown = (initialExpiresAt: number) => {
  const [expiresAt, setExpiresAt] = useState(initialExpiresAt);
  const [secondsLeft, setSecondsLeft] = useState(() => secondsUntil(initialExpiresAt));

  useEffect(() => {
    const tick = () => setSecondsLeft(secondsUntil(expiresAt));
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [expiresAt]);

  // Cập nhật luôn `secondsLeft` thay vì chờ effect: tránh một nhịp render hiển thị trạng thái cũ.
  const restart = useCallback((expiresIn: number) => {
    const next = Date.now() + expiresIn * 1000;
    setExpiresAt(next);
    setSecondsLeft(secondsUntil(next));
  }, []);
  const expireNow = useCallback(() => {
    setExpiresAt(0);
    setSecondsLeft(0);
  }, []);

  return { secondsLeft, expired: secondsLeft <= 0, restart, expireNow };
};
