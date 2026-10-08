"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { useRouter } from "next/navigation";
import GoogleButton from "../../../components/GoogleButton";
import { saveAuthToken } from "../../../lib/auth";
import { buildVerifyEmailHref } from "../../../lib/otp";
import { applyAccountLocale } from "@/lib/i18n";
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
import PasswordStrengthMeter from "@/components/PasswordStrengthMeter";
import { checkPassword, PASSWORD_ISSUE_VALUES, PASSWORD_MIN_LENGTH } from "@/lib/password-policy";
import { localizeApiError } from "@/lib/api/error-messages";
import { userErrorMessage } from "@/lib/api/error-messages";
import { FREE_PLAN_CREDITS } from "@/lib/constants/plans";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api/v1";

export default function RegisterPage() {
  const t = useTranslations("auth.register");
  const tc = useTranslations("auth.common");
  const tg = useTranslations("auth.google");
  const tp = useTranslations("password");
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Chỉ báo khi user đã gõ vào ô xác nhận, tránh đỏ ngay từ lúc mới vào trang
  const passwordMismatch = confirmPassword.length > 0 && password !== confirmPassword;
  // Cùng bộ quy tắc BE dùng (`lib/password-policy.ts`) ⇒ không còn cảnh FE cho qua rồi BE mới từ chối.
  const passwordIssue = password.length > 0 ? checkPassword(password) : null;

  const handleRegister = async (e: React.FormEvent) => {
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

    setLoading(true);

    try {
      const res = await fetch(`${API_BASE_URL}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() || undefined, email, password }),
      });

      const json = await res.json();

      if (!res.ok || json.error) {
        throw new Error(localizeApiError(json.error?.code, json.error?.message || t("failed")));
      }

      // Success -> nhập OTP vừa gửi tới email
      router.push(buildVerifyEmailHref(email.trim().toLowerCase(), json.data?.otpExpiresIn));
    } catch (err) {
      setError(userErrorMessage(err, tc("genericError")));
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
        throw new Error(localizeApiError(json.error?.code, json.error?.message || t("googleFailed")));
      }
      if (json.data?.accessToken) {
        saveAuthToken(json.data.accessToken, undefined, { persistent: true });
      }
      // Google có thể đăng nhập vào tài khoản cũ đã chọn ngôn ngữ (FLF-259).
      applyAccountLocale(json.data?.user?.locale);
      window.location.href = "/home";
    } catch (err) {
      setError(userErrorMessage(err, t("googleFailed")));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthCard>
      <AuthHeading title={t("title")}>{t("subtitle", { credits: FREE_PLAN_CREDITS })}</AuthHeading>

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
          <PasswordField
            id="password"
            label={tc("password")}
            value={password}
            onChange={setPassword}
            minLength={PASSWORD_MIN_LENGTH}
            autoComplete="new-password"
          >
            <PasswordStrengthMeter password={password} />
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

        <SubmitButton loading={loading} loadingLabel={t("submitting")} disabled={passwordMismatch || Boolean(passwordIssue)}>
          {t("submit")}
        </SubmitButton>
      </form>

      <p className="text-center text-[13px] text-on-surface-variant">
        {t("haveAccount")} <InlineLink href="/login">{t("login")}</InlineLink>
      </p>
    </AuthCard>
  );
}
