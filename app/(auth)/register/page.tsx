"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import GoogleButton from "../../../components/GoogleButton";
import Logo from "../../../components/Logo";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api/v1";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${API_BASE_URL}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const json = await res.json();

      if (!res.ok || json.error) {
        throw new Error(json.error?.message || "Đăng ký thất bại");
      }

      // Success -> Redirect to check-email
      router.push(`/check-email?email=${encodeURIComponent(email)}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Đã có lỗi xảy ra");
    } finally {
      setLoading(false);
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
            Đăng ký tài khoản
          </h1>
          <p className="text-xs text-secondary">
            Bắt đầu hành trình của bạn với Flintflow ngay hôm nay.
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

          <form className="space-y-4" onSubmit={handleRegister}>
            {/* Full Name */}
            <div className="space-y-1.5">
              <label
                className="block text-xs font-medium text-tertiary"
                htmlFor="name"
              >
                Họ và tên
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nguyễn Văn A"
                className="w-full h-10 px-3.5 rounded-lg border border-surface-container bg-white text-on-surface placeholder:text-outline-variant transition-all outline-none input-focus-ring text-xs"
              />
            </div>

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
                placeholder="example@flintflow.com"
                className="w-full h-10 px-3.5 rounded-lg border border-surface-container bg-white text-on-surface placeholder:text-outline-variant transition-all outline-none input-focus-ring text-xs"
              />
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <label
                className="block text-xs font-medium text-tertiary"
                htmlFor="password"
              >
                Mật khẩu
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  required
                  minLength={8}
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
              <p className="text-[11px] font-normal text-secondary pt-0.5">
                Tối thiểu 8 ký tự bao gồm chữ và số.
              </p>
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
                    Đang tạo tài khoản...
                  </>
                ) : (
                  "Tạo tài khoản"
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

            {/* Google Sign Up */}
            <GoogleButton
              label="Đăng ký với Google"
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
                      json.error?.message || "Đăng ký Google thất bại"
                    );
                  }
                  router.push("/home");
                } catch (err) {
                  setError(
                    err instanceof Error
                      ? err.message
                      : "Đăng ký Google thất bại"
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
              Đã có tài khoản?{" "}
              <Link
                href="/login"
                className="text-primary-container font-semibold hover:underline underline-offset-4 ml-1"
              >
                Đăng nhập
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
        </div>
      </div>
    </main>
  );
}
