"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { useRouter } from "next/navigation";
import GoogleButton from "../../../components/GoogleButton";
import { saveAuthToken } from "../../../lib/auth";
import { buildVerifyEmailHref } from "../../../lib/otp";
import {
  AuthAlert,
  AuthCard,
  AuthHeading,
  Divider,
  InlineLink,
  PasswordField,
  StrengthMeter,
  SubmitButton,
  TextField,
} from "../_components/auth-ui";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api/v1";

/** Gói Free của BE (`plan.config.ts`) — đổi ở BE thì đổi ở đây. */
const FREE_MONTHLY_CREDITS = 100;

export default function RegisterPage() {
  const t = useTranslations("auth.register");
  const tc = useTranslations("auth.common");
  const tg = useTranslations("auth.google");
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Chỉ báo khi user đã gõ vào ô xác nhận, tránh đỏ ngay từ lúc mới vào trang
  const passwordMismatch = confirmPassword.length > 0 && password !== confirmPassword;

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError(tc("passwordMismatch"));
      return;
    }

    setLoading(true);

    try {
      const res = await fetch(`${API_BASE_URL}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() || undefined, email, password }),
      });

      const json = await res.json();

      if (!res.ok || json.error) {
        throw new Error(json.error?.message || t("failed"));
      }

      // Success -> nhập OTP vừa gửi tới email
      router.push(buildVerifyEmailHref(email.trim().toLowerCase(), json.data?.otpExpiresIn));
    } catch (err) {
      setError(err instanceof Error ? err.message : tc("genericError"));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async (idToken: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/auth/google`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
        credentials: "include",
      });
      const json = await res.json();
      if (!res.ok || json.error) {
        throw new Error(json.error?.message || t("googleFailed"));
      }
      if (json.data?.accessToken) {
        saveAuthToken(json.data.accessToken, undefined, { persistent: true });
      }
      window.location.href = "/home";
    } catch (err) {
      setError(err instanceof Error ? err.message : t("googleFailed"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthCard>
      {/* Số credit khớp `plan.config.ts` của BE (gói Free: 100 credit mỗi tháng) */}
      <AuthHeading title={t("title")}>{t("subtitle", { credits: FREE_MONTHLY_CREDITS })}</AuthHeading>

      <GoogleButton label={tg("continue")} disabled={loading} onSuccess={handleGoogle} onError={(msg) => setError(msg)} />
      <Divider>{t("orEmail")}</Divider>

      {error && <AuthAlert tone="error">{error}</AuthAlert>}

      <form className="flex flex-col gap-4" onSubmit={handleRegister}>
        <TextField
          id="name"
          label={t("name")}
          type="text"
          autoComplete="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t("namePlaceholder")}
        />
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
        {/* Hai ô mật khẩu cạnh nhau (≥ sm) để form đăng ký vừa một màn hình */}
        <div className="grid items-start gap-4 sm:grid-cols-2 sm:gap-3">
          <PasswordField id="password" label={tc("password")} value={password} onChange={setPassword} minLength={8} autoComplete="new-password">
            <StrengthMeter password={password} />
          </PasswordField>
          <PasswordField
            id="confirmPassword"
            label={t("confirmPassword")}
            toggleName={tc("fieldConfirmPassword")}
            value={confirmPassword}
            onChange={setConfirmPassword}
            autoComplete="new-password"
            error={passwordMismatch ? t("confirmMismatch") : null}
          />
        </div>

        <SubmitButton loading={loading} loadingLabel={t("submitting")} disabled={passwordMismatch}>
          {t("submit")}
        </SubmitButton>
      </form>

      <p className="text-center text-[13px] text-on-surface-variant">
        {t("haveAccount")} <InlineLink href="/login">{t("login")}</InlineLink>
      </p>
    </AuthCard>
  );
}
