"use client";

import { Suspense, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import OtpInput, { OtpSpamHint, emptyOtp } from "../../../components/OtpInput";
import { buildResetPasswordHref, formatOtpTime, useOtpCountdown } from "../../../lib/otp";
import { logoutAndRedirect } from "../../../lib/auth";
import {
  AuthAlert,
  AuthCard,
  AuthHeading,
  BackLink,
  PasswordField,
  PrimaryLink,
  StatusIcon,
  StrengthMeter,
  SubmitButton,
} from "../_components/auth-ui";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api/v1";

type Step = "otp" | "password" | "success";

function ResetPasswordContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const email = searchParams.get("email") || "";

  // Bước 1: nhập OTP. Chỉ khi BE xác nhận đúng mới sang bước 2 với `resetToken` (giữ trong state, không
  // đưa lên URL — tải lại trang thì quay về bước 1).
  const [step, setStep] = useState<Step>("otp");
  const [resetToken, setResetToken] = useState<string | null>(null);

  const { secondsLeft, expired, restart, expireNow } = useOtpCountdown(Number(searchParams.get("exp")) || 0);
  const [digits, setDigits] = useState<string[]>(emptyOtp);
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [info, setInfo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);

  // Chỉ báo khi user đã gõ vào ô xác nhận, tránh đỏ ngay từ lúc mới vào bước 2
  const passwordMismatch = confirmPassword.length > 0 && password !== confirmPassword;
  const otpComplete = digits.every((d) => d !== "");

  const verifyOtp = async (otp: string) => {
    if (verifying || expired) return;
    setVerifying(true);
    setError(null);
    setInfo(null);
    try {
      const res = await fetch(`${API_BASE_URL}/auth/reset-password/verify-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, otp }),
      });
      const json = await res.json();

      if (!res.ok || json.error) {
        const code: string | undefined = json.error?.code;
        if (code === "OTP_EXPIRED" || code === "OTP_TOO_MANY_ATTEMPTS") expireNow();
        throw new Error(json.error?.message || "Xác nhận mã thất bại");
      }

      setResetToken(json.data.resetToken);
      setStep("password");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Đã có lỗi xảy ra");
      setDigits(emptyOtp());
    } finally {
      setVerifying(false);
    }
  };

  const handleDigitsChange = (next: string[]) => {
    setDigits(next);
    if (next.every((d) => d !== "")) verifyOtp(next.join(""));
  };

  const handleResend = async () => {
    if (!expired || resending) return;
    setResending(true);
    setError(null);
    setInfo(null);
    try {
      const res = await fetch(`${API_BASE_URL}/auth/forgot-password`, {
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
      router.replace(buildResetPasswordHref(email, expiresIn));
      setDigits(emptyOtp());
      setInfo("Đã gửi mã OTP mới. Vui lòng kiểm tra hộp thư đến.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Đã xảy ra lỗi kết nối.");
    } finally {
      setResending(false);
    }
  };

  const handleSavePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("Mật khẩu xác nhận không khớp.");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`${API_BASE_URL}/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resetToken, password }),
      });
      const json = await res.json();

      if (!res.ok || json.error) {
        if (json.error?.code === "RESET_SESSION_EXPIRED") {
          // Vé hết hạn (quá 10 phút) ⇒ quay lại bước OTP để xin mã mới
          setResetToken(null);
          setDigits(emptyOtp());
          expireNow();
          setStep("otp");
        }
        throw new Error(json.error?.message || "Đặt lại mật khẩu thất bại");
      }

      setStep("success");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Đã có lỗi xảy ra");
    } finally {
      setSaving(false);
    }
  };

  const alerts = (
    <>
      {error && <AuthAlert tone="error">{error}</AuthAlert>}
      {info && <AuthAlert tone="success">{info}</AuthAlert>}
    </>
  );

  if (!email) {
    return (
      <AuthCard>
        <StatusIcon icon="warning" tone="error" />
        <AuthHeading title="Thiếu địa chỉ email">Vui lòng nhập email tài khoản để nhận mã OTP đặt lại mật khẩu.</AuthHeading>
        <PrimaryLink href="/forgot-password">Nhận mã OTP</PrimaryLink>
      </AuthCard>
    );
  }

  if (step === "success") {
    return (
      <AuthCard>
        <StatusIcon icon="check" tone="success" />
        <AuthHeading title="Đặt lại mật khẩu thành công!">
          Mật khẩu của bạn đã được cập nhật. Mọi phiên đăng nhập cũ đã được thu hồi an toàn.
        </AuthHeading>
        {/* Mở từ trang Hồ sơ thì trình duyệt còn access token cũ (tối đa 15 phút) ⇒ /login bị đẩy về /home.
            Xoá hẳn phiên cũ trước khi sang trang đăng nhập. */}
        <SubmitButton type="button" loadingLabel="" onClick={() => void logoutAndRedirect("/login")}>
          Đăng nhập ngay
        </SubmitButton>
      </AuthCard>
    );
  }

  if (step === "otp") {
    return (
      <AuthCard>
        <StepDots current={1} />
        <AuthHeading eyebrow="Bước 1/2" title="Nhập mã xác nhận">
          Nhập mã 6 số đã gửi tới <strong className="break-all font-bold text-on-surface">{email}</strong>.
        </AuthHeading>

        {alerts}

        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (otpComplete) verifyOtp(digits.join(""));
          }}
        >
          <OtpInput digits={digits} onChange={handleDigitsChange} disabled={verifying || expired} />

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

          {expired ? (
            <SubmitButton type="button" onClick={handleResend} loading={resending} loadingLabel="Đang gửi…">
              Gửi lại mã OTP
            </SubmitButton>
          ) : (
            <SubmitButton loading={verifying} loadingLabel="Đang xác nhận…" disabled={!otpComplete}>
              Xác nhận mã
            </SubmitButton>
          )}
        </form>

        <BackLink />
      </AuthCard>
    );
  }

  return (
    <AuthCard>
      <StepDots current={2} />
      <AuthHeading eyebrow="Bước 2/2" title="Đặt mật khẩu mới">
        Mã đã được xác nhận. Tạo mật khẩu mới cho <strong className="break-all font-bold text-on-surface">{email}</strong>.
      </AuthHeading>

      {alerts}

      <form className="flex flex-col gap-4" onSubmit={handleSavePassword}>
        <PasswordField
          id="password"
          label="Mật khẩu mới"
          toggleName="mật khẩu"
          value={password}
          onChange={setPassword}
          minLength={8}
          autoFocus
          autoComplete="new-password"
        >
          <StrengthMeter password={password} />
        </PasswordField>
        <PasswordField
          id="confirmPassword"
          label="Xác nhận mật khẩu mới"
          toggleName="mật khẩu xác nhận"
          value={confirmPassword}
          onChange={setConfirmPassword}
          autoComplete="new-password"
          error={passwordMismatch ? "Mật khẩu xác nhận không giống với mật khẩu mới." : null}
        />

        <SubmitButton loading={saving} loadingLabel="Đang cập nhật…" disabled={!confirmPassword || passwordMismatch}>
          Đặt lại mật khẩu
        </SubmitButton>
      </form>

      <BackLink />
    </AuthCard>
  );
}

/** Hai vạch tiến độ "Bước 1/2 · 2/2" — cùng kiểu thanh giai đoạn của dashboard. */
function StepDots({ current }: { current: 1 | 2 }) {
  return (
    <div className="flex gap-1.5" aria-hidden="true">
      {[1, 2].map((n) => (
        <span key={n} className={`h-1.5 w-10 rounded-full ${n <= current ? "bg-primary" : "bg-card-track"}`} />
      ))}
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <AuthCard>
          <p className="text-center text-[13px] text-on-surface-variant">Đang tải…</p>
        </AuthCard>
      }
    >
      <ResetPasswordContent />
    </Suspense>
  );
}
