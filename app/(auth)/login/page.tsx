"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import GoogleButton from "../../../components/GoogleButton";
import { saveAuthToken } from "../../../lib/auth";

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

      const userRole = json.data?.user?.role || json.data?.role;
      if (json.data?.accessToken) {
        saveAuthToken(json.data.accessToken, userRole);
      }

      if (userRole === "admin") {
        window.location.href = "/admin/prompt-templates";
      } else {
        window.location.href = "/home";
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
    <div className="w-full max-w-[720px] bg-surface-container-lowest rounded-[24px] p-6 sm:p-[40px] custom-shadow-card border border-surface-variant/30">
      <h2 className="font-bold text-[28px] text-on-surface mb-2 tracking-tight">
        Chào mừng trở lại
      </h2>
      <p className="text-on-surface-variant text-[15px] mb-8">
        Chưa có tài khoản?{" "}
        <Link href="/register" className="text-primary hover:underline font-medium ml-1">
          Đăng ký miễn phí
        </Link>
      </p>

      {/* Error Alert */}
      {error && (
        <div className="mb-5 bg-error-container border border-error/20 text-on-error-container px-4 py-3 rounded-[12px] text-xs font-medium flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px]">error</span>
          <span>{error}</span>
        </div>
      )}

      {/* Unverified Alert */}
      {isUnverified && (
        <div className="mb-5 bg-primary-fixed border border-primary-fixed-dim/40 text-on-primary-container p-4 rounded-[12px] text-xs flex flex-col gap-2.5">
          <div>
            <strong>Tài khoản chưa được xác thực!</strong> Vui lòng kiểm tra hộp thư đến (hoặc spam) để bấm link xác thực.
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

      {/* Google Login */}
      <div className="mb-6">
        <GoogleButton
          label="Continue with Google"
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
                throw new Error(json.error?.message || "Đăng nhập Google thất bại");
              }
              const userRole = json.data?.user?.role || json.data?.role;
              if (json.data?.accessToken) {
                saveAuthToken(json.data.accessToken, userRole);
              }
              if (userRole === "admin") {
                window.location.href = "/admin/prompt-templates";
              } else {
                window.location.href = "/home";
              }
            } catch (err) {
              setError(err instanceof Error ? err.message : "Đăng nhập Google thất bại");
            } finally {
              setLoading(false);
            }
          }}
          onError={(msg) => setError(msg)}
        />
      </div>

      {/* Divider */}
      <div className="flex items-center gap-4 mb-6">
        <div className="h-[1px] bg-surface-variant/60 flex-1" />
        <span className="text-outline text-[12px] font-medium uppercase tracking-wider">
          hoặc email
        </span>
        <div className="h-[1px] bg-surface-variant/60 flex-1" />
      </div>

      <form className="flex flex-col gap-5" onSubmit={handleLogin}>
        {/* Email */}
        <div className="flex flex-col gap-2">
          <label className="text-[14px] text-on-surface font-medium" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="mai@studio.vn"
            className="w-full px-4 py-3 rounded-[12px] border border-surface-variant/60 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all text-on-surface bg-surface-container-lowest text-sm"
          />
        </div>

        {/* Password */}
        <div className="flex flex-col gap-2 relative">
          <div className="flex justify-between items-center">
            <label className="text-[14px] text-on-surface font-medium" htmlFor="password">
              Mật khẩu
            </label>
            <Link href="/forgot-password" className="text-primary hover:underline text-[14px] transition-colors">
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
              className="w-full px-4 py-3 pr-10 rounded-[12px] border border-surface-variant/60 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all text-on-surface bg-surface-container-lowest text-sm"
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

        {/* Submit Button */}
        <button
          type="submit"
          disabled={loading}
          className="w-full mt-2 py-3.5 px-4 rounded-[12px] bg-gradient-to-r from-[#6b58eb] to-[#4537cb] text-on-primary font-bold shadow-[0_4px_14px_rgba(79,70,229,0.3)] hover:shadow-[0_6px_20px_rgba(79,70,229,0.4)] transform hover:-translate-y-0.5 transition-all flex justify-center items-center gap-2 text-[15px] disabled:opacity-50 btn-press"
        >
          {loading ? (
            <>
              <span className="material-symbols-outlined text-[18px] ff-spinner">
                progress_activity
              </span>
              Đang xử lý...
            </>
          ) : (
            <>
              Sign in
              <span className="material-symbols-outlined text-[18px]">
                arrow_forward
              </span>
            </>
          )}
        </button>
      </form>

      <div className="mt-8 flex justify-end items-center">
        <span className="font-mono text-outline text-[11px] opacity-70">auth-first · FR01</span>
      </div>
    </div>
  );
}
