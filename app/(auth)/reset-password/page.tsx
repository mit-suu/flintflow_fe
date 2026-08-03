"use client";

import { Suspense, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import Logo from "../../../components/Logo";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api/v1";

function getPasswordStrength(password: string): { level: number; label: string; color: string } {
  if (!password) return { level: 0, label: "", color: "bg-surface-container" };
  let score = 0;
  if (password.length >= 6) score++;
  if (password.length >= 10) score++;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  if (score <= 2) return { level: 1, label: "Yếu", color: "bg-error" };
  if (score <= 3) return { level: 2, label: "Trung bình", color: "bg-amber-500" };
  if (score <= 4) return { level: 3, label: "Mạnh", color: "bg-emerald-500" };
  return { level: 4, label: "Rất mạnh", color: "bg-emerald-600" };
}

function ResetPasswordContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const strength = getPasswordStrength(password);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("Mật khẩu xác nhận không khớp");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });

      const json = await res.json();

      if (!res.ok || json.error) {
        throw new Error(json.error?.message || "Đặt lại mật khẩu thất bại");
      }

      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Đã có lỗi xảy ra");
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="w-full bg-surface-container-lowest rounded-xl p-6 card-elevated border border-surface-container text-center">
        <div className="mb-4 inline-flex items-center justify-center w-16 h-16 rounded-full bg-error-container text-error">
          <span className="material-symbols-outlined text-[32px]">
            error
          </span>
        </div>
        <h1 className="text-xl font-bold text-on-surface mb-2">
          Liên kết không hợp lệ
        </h1>
        <p className="text-xs text-secondary mb-6">
          Link đặt lại mật khẩu thiếu token hoặc không đúng định dạng.
        </p>
        <Link
          href="/forgot-password"
          className="inline-flex items-center justify-center gap-1.5 w-full h-10 rounded-lg bg-surface-container hover:bg-surface-container-high text-xs font-medium text-on-surface border border-surface-container transition-all btn-press"
        >
          Yêu cầu link mới
        </Link>
      </div>
    );
  }

  if (success) {
    return (
      <div className="w-full bg-surface-container-lowest rounded-xl p-6 card-elevated border border-surface-container text-center">
        <div className="mb-4 inline-flex items-center justify-center w-16 h-16 rounded-full bg-[#d4edda] text-[#155724]">
          <span className="material-symbols-outlined text-[32px]">
            check_circle
          </span>
        </div>
        <h1 className="text-xl font-bold text-on-surface mb-2">
          Đặt lại mật khẩu thành công!
        </h1>
        <p className="text-xs text-secondary leading-relaxed mb-6">
          Mật khẩu của bạn đã được cập nhật. Vì lý do bảo mật, tất cả các phiên
          đăng nhập trước đó đã bị đăng xuất.
        </p>
        <button
          onClick={() => router.push("/login")}
          className="w-full h-10 bg-primary-container text-white font-medium text-xs rounded-lg shadow-sm transition-all hover:brightness-90 btn-press"
        >
          Đăng nhập với mật khẩu mới
        </button>
      </div>
    );
  }

  return (
    <div className="w-full bg-surface-container-lowest rounded-xl p-6 card-elevated border border-surface-container">
      {error && (
        <div className="mb-4 bg-error-container border border-error/20 text-on-error-container px-3.5 py-2.5 rounded-lg text-xs font-medium">
          {error}
        </div>
      )}

      <form className="space-y-4" onSubmit={handleSubmit}>
        <div className="space-y-1.5">
          <label className="block text-xs font-medium text-tertiary">
            Mật khẩu mới
          </label>
          <div className="relative">
            <input
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
          {password && (
            <div className="mt-1.5">
              <div className="flex gap-1 mb-1">
                {[1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className={`h-1 flex-1 rounded-full ${
                      i <= strength.level ? strength.color : "bg-surface-container"
                    }`}
                  />
                ))}
              </div>
              <p className="text-[11px] text-secondary">
                Độ mạnh:{" "}
                <span className="text-on-surface font-medium">
                  {strength.label}
                </span>
              </p>
            </div>
          )}
        </div>

        <div className="space-y-1.5">
          <label className="block text-xs font-medium text-tertiary">
            Xác nhận mật khẩu mới
          </label>
          <input
            type={showPassword ? "text" : "password"}
            required
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="••••••••"
            className="w-full h-10 px-3.5 rounded-lg border border-surface-container bg-white text-on-surface placeholder:text-outline-variant transition-all outline-none input-focus-ring text-xs"
          />
          {confirmPassword && password !== confirmPassword && (
            <p className="text-[11px] text-error mt-1">
              Mật khẩu xác nhận không khớp
            </p>
          )}
        </div>

        <div className="pt-2">
          <button
            type="submit"
            disabled={loading || password !== confirmPassword}
            className="w-full h-10 bg-primary-container text-white font-medium text-xs rounded-lg shadow-sm transition-all hover:brightness-90 btn-press disabled:opacity-50 flex items-center justify-center gap-1.5"
          >
            {loading ? (
              <>
                <span className="material-symbols-outlined text-lg ff-spinner">
                  progress_activity
                </span>
                Đang cập nhật...
              </>
            ) : (
              "Đặt lại mật khẩu"
            )}
          </button>
        </div>
      </form>

      <div className="mt-5 text-center pt-3 border-t border-surface-container">
        <Link
          href="/login"
          className="text-xs text-secondary hover:text-primary font-medium transition-colors"
        >
          ← Quay lại Đăng nhập
        </Link>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <main className="flex-grow flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-[400px]">
        <div className="text-center mb-6">
          <div className="mb-2">
            <Logo sizeClassName="w-36 h-36" />
          </div>
          <h1 className="text-xl font-bold text-on-surface tracking-tight mb-1">
            Đặt lại mật khẩu
          </h1>
          <p className="text-xs text-secondary">
            Tạo mật khẩu mới cho tài khoản của bạn
          </p>
        </div>

        <Suspense
          fallback={
            <div className="w-full bg-surface-container-lowest rounded-xl p-6 card-elevated border border-surface-container text-center text-xs text-secondary">
              Đang tải...
            </div>
          }
        >
          <ResetPasswordContent />
        </Suspense>
      </div>
    </main>
  );
}
