"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import GoogleButton from "../../../components/GoogleButton";
import Logo from "../../../components/Logo";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api/v1";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isUnverified, setIsUnverified] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);
  const [resending, setResending] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setIsUnverified(false);
    setResendSuccess(false);

    try {
      const res = await fetch(`${API_BASE_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
        credentials: "include",
      });

      const json = await res.json();

      if (!res.ok || json.error) {
        if (json.error?.code === "EMAIL_NOT_VERIFIED") {
          setIsUnverified(true);
        }
        throw new Error(json.error?.message || "Đăng nhập thất bại");
      }

      if (json.data?.accessToken) {
        localStorage.setItem("accessToken", json.data.accessToken);
      }

      const userRole = json.data?.user?.role || json.data?.role;
      if (userRole === "admin") {
        router.push("/admin/prompt-templates");
      } else {
        router.push("/home");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Đã có lỗi xảy ra");
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
      if (res.ok) {
        setResendSuccess(true);
      }
    } finally {
      setResending(false);
    }
  };

  return (
    <main className="flex-grow flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-[400px]">
        {/* Logo & Header */}
        <div className="text-center mb-6">
          <div className="mb-2">
            <Logo sizeClassName="w-36 h-36" />
          </div>
          <h1 className="text-xl font-bold text-on-surface tracking-tight mb-1">
            Chào mừng trở lại
          </h1>
          <p className="text-xs text-secondary">
            Đăng nhập vào tài khoản Flintflow của bạn
          </p>
        </div>

        {/* Card Container */}
        <div className="bg-surface-container-lowest rounded-xl p-6 card-elevated border border-surface-container">
          {/* Error Alert */}
          {error && (
            <div className="mb-4 bg-error-container border border-error/20 text-on-error-container px-3.5 py-2.5 rounded-lg text-xs font-medium">
              {error}
            </div>
          )}

          {/* Unverified Alert */}
          {isUnverified && (
            <div className="mb-5 bg-primary-fixed border border-primary-fixed-dim/40 text-on-primary-container p-3.5 rounded-lg text-xs flex flex-col gap-2.5">
              <div>
                <strong>Tài khoản chưa được xác thực!</strong> Vui lòng kiểm
                tra hộp thư đến (hoặc spam) để bấm link xác thực.
              </div>
              {resendSuccess ? (
                <div className="text-primary font-semibold">
                  Đã gửi lại email xác thực thành công!
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleResendVerify}
                  disabled={resending}
                  className="self-start px-3 py-1.5 bg-primary-container hover:bg-primary text-on-primary rounded-md text-xs font-medium transition disabled:opacity-50 btn-press"
                >
                  {resending ? "Đang gửi..." : "Gửi lại email xác thực"}
                </button>
              )}
            </div>
          )}

          <form className="space-y-4" onSubmit={handleLogin}>
            {/* Email */}
            <div className="space-y-1.5">
              <label
                className="block text-xs font-medium text-tertiary"
                htmlFor="email"
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="example@gmail.com"
                className="w-full h-10 px-3.5 rounded-lg border border-surface-container bg-white text-on-surface placeholder:text-outline-variant transition-all outline-none input-focus-ring text-xs"
              />
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <label
                  className="block text-xs font-medium text-tertiary"
                  htmlFor="password"
                >
                  Mật khẩu
                </label>
                <Link
                  href="/forgot-password"
                  className="text-xs font-medium text-primary hover:underline transition-all"
                >
                  Quên mật khẩu?
                </Link>
              </div>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full h-10 px-3.5 pr-10 rounded-lg border border-surface-container bg-white text-on-surface placeholder:text-outline-variant transition-all outline-none input-focus-ring text-xs"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-secondary hover:text-primary transition-colors"
                >
                  <span className="material-symbols-outlined text-lg">
                    {showPassword ? "visibility_off" : "visibility"}
                  </span>
                </button>
              </div>
            </div>

            {/* Remember Me */}
            <div className="flex items-center gap-2 pt-0.5">
              <input
                id="remember"
                type="checkbox"
                className="w-3.5 h-3.5 rounded border-surface-container text-primary-container focus:ring-primary-container"
              />
              <label
                htmlFor="remember"
                className="text-xs text-secondary cursor-pointer select-none"
              >
                Ghi nhớ tôi
              </label>
            </div>

            {/* Primary Action */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full h-10 bg-primary-container text-white font-medium text-xs rounded-lg shadow-sm transition-all hover:brightness-90 btn-press disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {loading ? (
                  <>
                    <span className="material-symbols-outlined text-lg ff-spinner">
                      progress_activity
                    </span>
                    Đang xử lý...
                  </>
                ) : (
                  <>
                    Đăng nhập
                    <span className="material-symbols-outlined text-lg">
                      login
                    </span>
                  </>
                )}
              </button>
            </div>

            {/* Divider */}
            <div className="relative flex items-center py-2">
              <div className="flex-grow border-t border-surface-container" />
              <span className="flex-shrink-0 mx-3 text-[11px] font-semibold text-secondary uppercase tracking-widest">
                Hoặc
              </span>
              <div className="flex-grow border-t border-surface-container" />
            </div>

            {/* Google Login */}
            <GoogleButton
              label="Đăng nhập với Google"
              disabled={loading}
              onSuccess={async (idToken) => {
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
                    throw new Error(
                      json.error?.message || "Đăng nhập Google thất bại"
                    );
                  }
                  if (json.data?.accessToken) {
                    localStorage.setItem("accessToken", json.data.accessToken);
                  }
                  const userRole = json.data?.user?.role || json.data?.role;
                  if (userRole === "admin") {
                    router.push("/admin/prompt-templates");
                  } else {
                    router.push("/home");
                  }
                } catch (err) {
                  setError(
                    err instanceof Error
                      ? err.message
                      : "Đăng nhập Google thất bại"
                  );
                } finally {
                  setLoading(false);
                }
              }}
              onError={(msg) => setError(msg)}
            />
          </form>

          {/* Footer Link */}
          <div className="mt-6 text-center">
            <p className="text-xs text-secondary">
              Chưa có tài khoản?{" "}
              <Link
                href="/register"
                className="text-primary-container font-semibold hover:underline underline-offset-4 ml-1"
              >
                Đăng ký
              </Link>
            </p>
          </div>
        </div>

        {/* Secondary Links */}
        <div className="mt-5 text-center flex justify-center gap-5">
          <Link
            href="#"
            className="text-[11px] font-medium text-secondary hover:text-primary transition-colors"
          >
            Điều khoản dịch vụ
          </Link>
          <Link
            href="#"
            className="text-[11px] font-medium text-secondary hover:text-primary transition-colors"
          >
            Chính sách bảo mật
          </Link>
          <Link
            href="#"
            className="text-[11px] font-medium text-secondary hover:text-primary transition-colors"
          >
            Hỗ trợ
          </Link>
        </div>
      </div>
    </main>
  );
}
