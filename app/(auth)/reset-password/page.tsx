"use client";

import { useTranslations } from "next-intl";
import Skeleton from "@/components/ui/Skeleton";
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
  SubmitButton,
} from "../_components/auth-ui";
import PasswordStrengthMeter from "@/components/PasswordStrengthMeter";
import { checkPassword, PASSWORD_ISSUE_VALUES, PASSWORD_MIN_LENGTH } from "@/lib/password-policy";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api/v1";

type Step = "otp" | "password" | "success";

function ResetPasswordContent() {
  const t = useTranslations("auth.reset");
  const tc = useTranslations("auth.common");
  const to = useTranslations("auth.otp");
  const tp = useTranslations("password");
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
  const passwordIssue = password.length > 0 ? checkPassword(password) : null;
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
        throw new Error(json.error?.message || t("otpFailed"));
      }

      setResetToken(json.data.resetToken);
      setStep("password");
    } catch (err) {
      setError(err instanceof Error ? err.message : tc("genericError"));
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
        throw new Error(json.error?.message || to("resendFailed"));
      }
      const expiresIn = Number(json.data?.otpExpiresIn) || 120;
      restart(expiresIn);
      router.replace(buildResetPasswordHref(email, expiresIn));
      setDigits(emptyOtp());
      setInfo(to("resent"));
    } catch (err) {
      setError(err instanceof Error ? err.message : tc("connectionError"));
    } finally {
      setResending(false);
    }
  };

  const handleSavePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError(tc("passwordMismatch"));
      return;
    }

    if (passwordIssue) {
      setError(tp(`issue.${passwordIssue}`, PASSWORD_ISSUE_VALUES));
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
        throw new Error(json.error?.message || t("failed"));
      }

      setStep("success");
    } catch (err) {
      setError(err instanceof Error ? err.message : tc("genericError"));
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
        <AuthHeading title={t("missingEmailTitle")}>{t("missingEmailBody")}</AuthHeading>
        <PrimaryLink href="/forgot-password">{t("getOtp")}</PrimaryLink>
      </AuthCard>
    );
  }

  if (step === "success") {
    return (
      <AuthCard>
        <StatusIcon icon="check" tone="success" />
        <AuthHeading title={t("successTitle")}>{t("successBody")}</AuthHeading>
        {/* Mở từ trang Hồ sơ thì trình duyệt còn access token cũ (tối đa 15 phút) ⇒ /login bị đẩy về /home.
            Xoá hẳn phiên cũ trước khi sang trang đăng nhập. */}
        <SubmitButton type="button" loadingLabel="" onClick={() => void logoutAndRedirect("/login")}>
          {t("loginNow")}
        </SubmitButton>
      </AuthCard>
    );
  }

  if (step === "otp") {
    return (
      <AuthCard>
        <StepDots current={1} />
        <AuthHeading eyebrow={t("step1")} title={t("otpTitle")}>
          {t.rich("otpBody", { email, b: (chunks) => <strong className="break-all font-bold text-on-surface">{chunks}</strong> })}
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
              <span className="font-semibold text-error">{to("expired")}</span>
            ) : (
              <span className="text-on-surface-variant">
                {to.rich("expiresIn", {
                  time: formatOtpTime(secondsLeft),
                  b: (chunks) => <strong className="font-bold text-on-surface">{chunks}</strong>,
                })}
              </span>
            )}
          </p>

          <OtpSpamHint />

          {expired ? (
            <SubmitButton type="button" onClick={handleResend} loading={resending} loadingLabel={tc("sending")}>
              {to("resend")}
            </SubmitButton>
          ) : (
            <SubmitButton loading={verifying} loadingLabel={t("confirmingOtp")} disabled={!otpComplete}>
              {t("confirmOtp")}
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
      <AuthHeading eyebrow={t("step2")} title={t("passwordTitle")}>
        {t.rich("passwordBody", { email, b: (chunks) => <strong className="break-all font-bold text-on-surface">{chunks}</strong> })}
      </AuthHeading>

      {alerts}

      <form className="flex flex-col gap-4" onSubmit={handleSavePassword}>
        <PasswordField
          id="password"
          label={t("newPassword")}
          toggleName={tc("fieldPassword")}
          value={password}
          onChange={setPassword}
          minLength={PASSWORD_MIN_LENGTH}
          autoFocus
          autoComplete="new-password"
        >
          <PasswordStrengthMeter password={password} />
        </PasswordField>
        <PasswordField
          id="confirmPassword"
          label={t("confirmNewPassword")}
          toggleName={tc("fieldConfirmPassword")}
          value={confirmPassword}
          onChange={setConfirmPassword}
          autoComplete="new-password"
          error={passwordMismatch ? t("confirmMismatch") : null}
        />

        <SubmitButton
          loading={saving}
          loadingLabel={t("submitting")}
          disabled={!confirmPassword || passwordMismatch || Boolean(passwordIssue)}
        >
          {t("submit")}
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
    <Suspense fallback={<AuthCardFallback />}>
      <ResetPasswordContent />
    </Suspense>
  );
}

/**
 * Fallback của Suspense — component riêng để dùng được `useTranslations`. Vẽ khối giữ chỗ đúng dáng
 * nội dung sắp hiện (`Skeleton`) thay vì một dòng "Đang tải…": chữ đổi thành khối thì mắt không phải
 * đọc rồi bỏ, và khung trang không giật khi nội dung thật thay chỗ.
 */
function AuthCardFallback() {
  const tc = useTranslations("auth.common");
  return (
    <AuthCard>
      <div className="flex flex-col gap-3" role="status" aria-busy="true" aria-label={tc("loading")}>
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-4/5" />
        <Skeleton className="h-9 w-full" />
      </div>
    </AuthCard>
  );
}
