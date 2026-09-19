"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { buildResetPasswordHref } from "../../../lib/otp";
import { AuthAlert, AuthCard, AuthHeading, BackLink, SubmitButton, TextField } from "../_components/auth-ui";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api/v1";

function ForgotPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // `?email=` khi mở từ trang Hồ sơ ("Quên mật khẩu hiện tại?") ⇒ điền sẵn
  const [email, setEmail] = useState(() => searchParams.get("email") ?? "");
  // `?mode=create`: tài khoản Google tạo mật khẩu lần đầu (nút "Tạo mật khẩu" ở trang Hồ sơ)
  const creating = searchParams.get("mode") === "create";
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const normalizedEmail = email.trim().toLowerCase();
    try {
      const res = await fetch(`${API_BASE_URL}/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: normalizedEmail }),
      });

      const json = await res.json();

      if (!res.ok || json.error) {
        throw new Error(json.error?.message || "Không thể gửi yêu cầu đặt lại mật khẩu");
      }

      router.push(buildResetPasswordHref(normalizedEmail, json.data?.otpExpiresIn));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Đã có lỗi xảy ra");
      setLoading(false);
    }
  };

  return (
    <AuthCard>
      <AuthHeading title={creating ? "Tạo mật khẩu" : "Quên mật khẩu"}>
        {creating
          ? "Chúng tôi sẽ gửi mã OTP tới email để xác nhận trước khi tạo mật khẩu."
          : "Nhập email tài khoản để nhận mã OTP đặt lại mật khẩu."}
      </AuthHeading>

      {error && <AuthAlert tone="error">{error}</AuthAlert>}

      <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
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
        <SubmitButton loading={loading} loadingLabel="Đang gửi…">
          Gửi mã OTP →
        </SubmitButton>
      </form>

      <BackLink />
    </AuthCard>
  );
}

export default function ForgotPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ForgotPasswordContent />
    </Suspense>
  );
}
