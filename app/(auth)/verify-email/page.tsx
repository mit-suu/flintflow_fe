"use client";

import { useTranslations } from "next-intl";
import { Suspense, useState, useEffect, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Skeleton from "@/components/ui/Skeleton";
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
  const t = useTranslations("auth.verify");
  const tc = useTranslations("auth.common");
  const to = useTranslations("auth.otp");
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
          throw new Error(json.error?.message || t("failed"));
        }

        const userRole = json.data?.user?.role || json.data?.role;
        if (json.data?.accessToken) {
          saveAuthToken(json.data.accessToken, userRole, { persistent: true });
        }
        setStatus("success");
      } catch (err) {
        setStatus("idle");
        setError(err instanceof Error ? err.message : tc("genericError"));
        resetDigits();
      }
    },
    [email, status, router, expireNow, t, tc]
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
        throw new Error(json.error?.message || to("resendFailed"));
      }
      const expiresIn = Number(json.data?.otpExpiresIn) || 120;
      restart(expiresIn);
      router.replace(buildVerifyEmailHref(email, expiresIn));
      setInfo(to("resent"));
      resetDigits();
    } catch (err) {
      setError(err instanceof Error ? err.message : tc("connectionError"));
    } finally {
      setResending(false);
    }
  };

  if (!email) {
    return (
      <AuthCard>
        <StatusIcon icon="warning" tone="error" />
        <AuthHeading title={t("missingEmailTitle")}>{t("missingEmailBody")}</AuthHeading>
        <PrimaryLink href="/login">{t("toLogin")}</PrimaryLink>
      </AuthCard>
    );
  }

  if (status === "success") {
    return (
      <AuthCard>
        <StatusIcon icon="check" tone="success" />
        <AuthHeading title={t("successTitle")}>
          {t.rich("successBody", {
            seconds: countdown,
            b: (chunks) => <strong className="font-bold text-on-surface">{chunks}</strong>,
          })}
        </AuthHeading>
        <SubmitButton type="button" loadingLabel="" onClick={() => router.push("/home")}>
          {t("enterApp")}
        </SubmitButton>
      </AuthCard>
    );
  }

  const otpComplete = digits.every((d) => d !== "");

  return (
    <AuthCard>
      <StatusIcon icon="mail" tone="primary" />
      <AuthHeading title={t("title")}>
        {t.rich("body", { email, b: (chunks) => <strong className="break-all font-bold text-on-surface">{chunks}</strong> })}
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

        {error && <AuthAlert tone="error">{error}</AuthAlert>}
        {info && <AuthAlert tone="success">{info}</AuthAlert>}

        {expired ? (
          <SubmitButton type="button" onClick={handleResend} loading={resending} loadingLabel={tc("sending")}>
            {to("resend")}
          </SubmitButton>
        ) : (
          <SubmitButton loading={status === "verifying"} loadingLabel={t("submitting")} disabled={!otpComplete}>
            {t("submit")}
          </SubmitButton>
        )}
      </form>

      <BackLink>{t("back")}</BackLink>
    </AuthCard>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<AuthCardFallback />}>
      <VerifyEmailContent />
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
