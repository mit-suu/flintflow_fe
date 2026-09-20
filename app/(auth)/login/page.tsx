"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import GoogleButton from "../../../components/GoogleButton";
import { getRememberedEmail, saveAuthToken, setRememberedEmail } from "../../../lib/auth";
import { buildVerifyEmailHref } from "../../../lib/otp";
import {
  AuthAlert,
  AuthCard,
  AuthHeading,
  Divider,
  InlineLink,
  PasswordField,
  SubmitButton,
  TextField,
} from "../_components/auth-ui";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api/v1";

export default function LoginPage() {
  const t = useTranslations("auth.login");
  const tc = useTranslations("auth.common");
  const tg = useTranslations("auth.google");
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isUnverified, setIsUnverified] = useState(false);
  const [resending, setResending] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  // Lần trước có tick "Ghi nhớ đăng nhập" ⇒ điền sẵn email và giữ tick. Đọc sau khi mount (localStorage
  // không có lúc prerender); lùi một microtask vì setState thẳng trong effect bị lint chặn.
  useEffect(() => {
    queueMicrotask(() => {
      const remembered = getRememberedEmail();
      if (!remembered) return;
      setEmail((current) => current || remembered);
      setRememberMe(true);
    });
  }, []);

  /** Sau khi BE trả phiên: lưu token theo chế độ ghi nhớ, nhớ/quên email, rồi vào app. */
  const completeLogin = (accessToken: string | undefined, userRole: string | undefined, loginEmail?: string) => {
    if (accessToken) {
      saveAuthToken(accessToken, userRole, { persistent: rememberMe });
    }
    setRememberedEmail(rememberMe && loginEmail ? loginEmail.trim().toLowerCase() : null);
    window.location.href = userRole === "admin" ? "/admin/metrics" : "/home";
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setIsUnverified(false);

    try {
      const res = await fetch(`${API_BASE_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, rememberMe }),
        credentials: "include",
      });

      const json = await res.json();

      if (!res.ok || json.error) {
        if (json.error?.code === "EMAIL_NOT_VERIFIED") {
          setIsUnverified(true);
        }
        throw new Error(json.error?.message || t("failed"));
      }

      completeLogin(json.data?.accessToken, json.data?.user?.role || json.data?.role, email);
    } catch (err) {
      setError(err instanceof Error ? err.message : tc("genericError"));
    } finally {
      setLoading(false);
    }
  };

  const handleResendVerify = async () => {
    setResending(true);
    try {
      const res = await fetch(`${API_BASE_URL}/auth/verify-email/resend`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json.error) {
        throw new Error(
          json.error?.message || t("resendFailed"),
        );
      }
      router.push(
        buildVerifyEmailHref(
          email.trim().toLowerCase(),
          json.data?.otpExpiresIn,
        ),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : tc("connectionError"));
    } finally {
      setResending(false);
    }
  };

  const handleGoogle = async (idToken: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/auth/google`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken, rememberMe }),
        credentials: "include",
      });
      const json = await res.json();
      if (!res.ok || json.error) {
        throw new Error(json.error?.message || t("googleFailed"));
      }
      completeLogin(json.data?.accessToken, json.data?.user?.role || json.data?.role, json.data?.user?.email);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("googleFailed"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthCard>
      <AuthHeading title={t("title")}>
        {t("noAccount")} <InlineLink href="/register">{t("createAccount")}</InlineLink>
      </AuthHeading>

      <GoogleButton label={tg("continue")} disabled={loading} onSuccess={handleGoogle} onError={(msg) => setError(msg)} />
      <Divider>{t("orEmail")}</Divider>

      {error && <AuthAlert tone="error">{error}</AuthAlert>}
      {isUnverified && (
        <AuthAlert tone="warning">
          <p>
            <strong>{t("unverifiedTitle")}</strong> {t("unverifiedBody")}
          </p>
          <button
            type="button"
            onClick={handleResendVerify}
            disabled={resending}
            className="mt-2 rounded-inner bg-primary px-3 py-1.5 text-[12px] font-bold text-on-primary transition-colors hover:bg-primary-hover disabled:opacity-50"
          >
            {resending ? t("sendingOtp") : t("sendOtp")}
          </button>
        </AuthAlert>
      )}

      <form className="flex flex-col gap-4" onSubmit={handleLogin}>
        <TextField
          id="email"
          label={tc("email")}
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={tc("emailPlaceholder")}
        />
        <PasswordField
          id="password"
          label={tc("password")}
          value={password}
          onChange={setPassword}
          autoComplete="current-password"
          placeholder={tc("passwordPlaceholder")}
        />

        <SubmitButton loading={loading} loadingLabel={t("submitting")}>
          {t("submit")}
        </SubmitButton>
      </form>

      {/* "Ghi nhớ" nằm ngoài form nên áp dụng cho cả đăng nhập email lẫn Google */}
      <div className="flex items-center justify-between gap-3">
        <label className="flex cursor-pointer select-none items-center gap-2 text-[13px] font-semibold text-on-surface-medium">
          <input
            type="checkbox"
            checked={rememberMe}
            onChange={(e) => setRememberMe(e.target.checked)}
            className="size-4 cursor-pointer rounded-[4px] accent-primary"
          />
          {t("remember")}
        </label>
        <span className="text-[13px]">
          <InlineLink href="/forgot-password">{t("forgot")}</InlineLink>
        </span>
      </div>
    </AuthCard>
  );
}
