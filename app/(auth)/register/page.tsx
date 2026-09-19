"use client";

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

export default function RegisterPage() {
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
      setError("Mật khẩu xác nhận không khớp.");
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
        throw new Error(json.error?.message || "Đăng ký thất bại");
      }

      // Success -> nhập OTP vừa gửi tới email
      router.push(buildVerifyEmailHref(email.trim().toLowerCase(), json.data?.otpExpiresIn));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Đã có lỗi xảy ra");
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
        throw new Error(json.error?.message || "Đăng ký Google thất bại");
      }
      if (json.data?.accessToken) {
        saveAuthToken(json.data.accessToken, undefined, { persistent: true });
      }
      window.location.href = "/home";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Đăng ký Google thất bại");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthCard>
      {/* Số credit khớp `plan.config.ts` của BE (gói Free: 100 credit mỗi tháng) */}
      <AuthHeading title="Tạo tài khoản">Miễn phí 100 credit mỗi tháng · không cần thẻ.</AuthHeading>

      <GoogleButton label="Tiếp tục với Google" disabled={loading} onSuccess={handleGoogle} onError={(msg) => setError(msg)} />
      <Divider>hoặc đăng ký bằng email</Divider>

      {error && <AuthAlert tone="error">{error}</AuthAlert>}

      <form className="flex flex-col gap-4" onSubmit={handleRegister}>
        <TextField
          id="name"
          label="Họ và tên"
          type="text"
          autoComplete="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nguyễn Văn A"
        />
        <TextField
          id="email"
          label="Email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="mai@studio.vn"
        />
        <PasswordField id="password" label="Mật khẩu" value={password} onChange={setPassword} minLength={8} autoComplete="new-password">
          <StrengthMeter password={password} />
        </PasswordField>
        <PasswordField
          id="confirmPassword"
          label="Xác nhận mật khẩu"
          toggleName="mật khẩu xác nhận"
          value={confirmPassword}
          onChange={setConfirmPassword}
          autoComplete="new-password"
          error={passwordMismatch ? "Mật khẩu xác nhận không giống với mật khẩu." : null}
        />

        <SubmitButton loading={loading} loadingLabel="Đang tạo tài khoản…" disabled={passwordMismatch}>
          Tạo tài khoản →
        </SubmitButton>
      </form>

      <p className="text-center text-[13px] text-on-surface-variant">
        Đã có tài khoản? <InlineLink href="/login">Đăng nhập</InlineLink>
      </p>
    </AuthCard>
  );
}
