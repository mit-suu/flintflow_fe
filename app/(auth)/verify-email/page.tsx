"use client";

import { Suspense, useState, useEffect, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { saveAuthToken } from "../../../lib/auth";
import OtpInput, { OtpSpamHint, emptyOtp } from "../../../components/OtpInput";
import { buildVerifyEmailHref, formatOtpTime, useOtpCountdown } from "../../../lib/otp";
import {
  AuthAlert,
  AuthCard,
  AuthHeading,
  BackLink,
  PrimaryLink,
  StatusIcon,
  SubmitButton,
} from "../_components/auth-ui";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api/v1";

type VerifyStatus = "idle" | "verifying" | "success";

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const email = searchParams.get("email") || "";

  const { secondsLeft, expired, restart, expireNow } = useOtpCountdown(Number(searchParams.get("exp")) || 0);
  const [digits, setDigits] = useState<string[]>(emptyOtp);
  const [status, setStatus] = useState<VerifyStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [resending, setResending] = useState(false);
  const [countdown, setCountdown] = useState(3);

  useEffect(() => {
    if (status !== "success") return;
    if (countdown <= 0) {
      router.push("/home");
      return;
    }
    const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
    return () => clearTimeout(timer);
  }, [status, countdown, router]);

  const resetDigits = () => setDigits(emptyOtp());

  const submitOtp = useCallback(
    async (otp: string) => {
      if (status === "verifying" || !email) return;
      setStatus("verifying");
      setError(null);
      setInfo(null);
      try {
        const res = await fetch(`${API_BASE_URL}/auth/verify-email/confirm`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, otp }),
          credentials: "include",
        });
        const json = await res.json();

        if (!res.ok || json.error) {
          if (json.error?.code === "EMAIL_ALREADY_VERIFIED") {
            router.push("/login");
            return;
          }
          if (json.error?.code === "OTP_EXPIRED" || json.error?.code === "OTP_TOO_MANY_ATTEMPTS") {
            expireNow();
          }
          throw new Error(json.error?.message || "Xác thực thất bại");
        }

        const userRole = json.data?.user?.role || json.data?.role;
        if (json.data?.accessToken) {
          saveAuthToken(json.data.accessToken, userRole, { persistent: true });
        }
        setStatus("success");
      } catch (err) {
        setStatus("idle");
        setError(err instanceof Error ? err.message : "Đã có lỗi xảy ra");
        resetDigits();
      }
    },
    [email, status, router, expireNow]
  );

  const updateDigits = (next: string[]) => {
    setDigits(next);
    if (next.every((d) => d !== "") && !expired) {
      submitOtp(next.join(""));
    }
  };

  const handleResend = async () => {
    if (!expired || resending || !email) return;
    setResending(true);
    setError(null);
    setInfo(null);
    try {
      const res = await fetch(`${API_BASE_URL}/auth/verify-email/resend`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json.error) {
        throw new Error(json.error?.message || "Không thể gửi lại mã. Vui lòng thử lại sau.");
      }
      const expiresIn = Number(json.data?.otpExpiresIn) || 120;
      restart(expiresIn);
      router.replace(buildVerifyEmailHref(email, expiresIn));
      setInfo("Đã gửi mã OTP mới. Vui lòng kiểm tra hộp thư đến.");
      resetDigits();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Đã xảy ra lỗi kết nối.");
    } finally {
      setResending(false);
    }
  };

  if (!email) {
    return (
      <AuthCard>
        <StatusIcon icon="warning" tone="error" />
        <AuthHeading title="Thiếu địa chỉ email">
          Vui lòng đăng nhập bằng tài khoản vừa đăng ký để nhận mã xác thực.
        </AuthHeading>
        <PrimaryLink href="/login">Về trang đăng nhập</PrimaryLink>
      </AuthCard>
    );
  }

  if (status === "success") {
    return (
      <AuthCard>
        <StatusIcon icon="check" tone="success" />
        <AuthHeading title="Xác thực thành công!">
          Tài khoản của bạn đã được kích hoạt và tự động đăng nhập. Đang chuyển hướng trong{" "}
          <strong className="font-bold text-on-surface">{countdown}s</strong>…
        </AuthHeading>
        <SubmitButton type="button" loadingLabel="" onClick={() => router.push("/home")}>
          Vào ứng dụng ngay
        </SubmitButton>
      </AuthCard>
    );
  }

  const otpComplete = digits.every((d) => d !== "");

  return (
    <AuthCard>
      <StatusIcon icon="mail" tone="primary" />
      <AuthHeading title="Nhập mã xác thực">
        Chúng tôi đã gửi mã gồm 6 chữ số đến <strong className="break-all font-bold text-on-surface">{email}</strong>. Vui lòng
        kiểm tra hộp thư đến.
      </AuthHeading>

      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (otpComplete && !expired) submitOtp(digits.join(""));
        }}
      >
        <OtpInput digits={digits} onChange={updateDigits} disabled={status === "verifying" || expired} />

        <p className="text-center text-[13px]" aria-live="polite">
          {expired ? (
            <span className="font-semibold text-error">Mã OTP đã hết hạn. Vui lòng gửi lại mã mới.</span>
          ) : (
            <span className="text-on-surface-variant">
              Mã hết hạn sau <strong className="font-bold text-on-surface">{formatOtpTime(secondsLeft)}</strong>
            </span>
          )}
        </p>

        <OtpSpamHint />

        {error && <AuthAlert tone="error">{error}</AuthAlert>}
        {info && <AuthAlert tone="success">{info}</AuthAlert>}

        {expired ? (
          <SubmitButton type="button" onClick={handleResend} loading={resending} loadingLabel="Đang gửi…">
            Gửi lại mã OTP
          </SubmitButton>
        ) : (
          <SubmitButton loading={status === "verifying"} loadingLabel="Đang xác thực…" disabled={!otpComplete}>
            Xác thực
          </SubmitButton>
        )}
      </form>

      <BackLink>Trở lại trang đăng nhập</BackLink>
    </AuthCard>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <AuthCard>
          <p className="text-center text-[13px] text-on-surface-variant">Đang tải…</p>
        </AuthCard>
      }
    >
      <VerifyEmailContent />
    </Suspense>
  );
}
