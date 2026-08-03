"use client";

import { useState } from "react";
import Link from "next/link";
import Logo from "../../../components/Logo";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api/v1";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${API_BASE_URL}/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const json = await res.json();

      if (!res.ok || json.error) {
        throw new Error(json.error?.message || "Không thể gửi yêu cầu");
      }

      setSubmitted(true);
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
            Quên mật khẩu?
          </h1>
          <p className="text-xs text-secondary">
            Chúng tôi sẽ gửi link đặt lại mật khẩu cho bạn
          </p>
        </div>

        {/* Card Container */}
        <div className="bg-surface-container-lowest rounded-xl p-6 card-elevated border border-surface-container">
          {submitted ? (
            <div className="text-center flex flex-col items-center">
              <div className="mb-4 inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary-fixed text-primary">
                <span className="material-symbols-outlined text-[32px]">
                  mail
                </span>
              </div>
              <h2 className="text-base font-semibold text-on-surface mb-2">
                Kiểm tra email của bạn
              </h2>
              <p className="text-xs text-secondary leading-relaxed mb-4">
                Nếu <strong className="text-on-surface">{email}</strong> tồn tại
                trong hệ thống, chúng tôi đã gửi link đặt lại mật khẩu. Link sẽ
                hết hạn sau <strong>15 phút</strong>.
              </p>
              <p className="text-[11px] text-secondary mb-5">
                Không thấy email? Hãy kiểm tra thư mục Spam hoặc thử lại.
              </p>
              <div className="w-full pt-3 border-t border-surface-container">
                <Link
                  href="/login"
                  className="text-xs text-secondary hover:text-primary font-medium transition-colors"
                >
                  ← Quay lại Đăng nhập
                </Link>
              </div>
            </div>
          ) : (
            <>
              {error && (
                <div className="mb-4 bg-error-container border border-error/20 text-on-error-container px-3.5 py-2.5 rounded-lg text-xs font-medium">
                  {error}
                </div>
              )}

              <form className="space-y-4" onSubmit={handleSubmit}>
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-tertiary">
                    Địa chỉ Email đã đăng ký
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="example@gmail.com"
                    className="w-full h-10 px-3.5 rounded-lg border border-surface-container bg-white text-on-surface placeholder:text-outline-variant transition-all outline-none input-focus-ring text-xs"
                  />
                </div>

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
                        Đang gửi...
                      </>
                    ) : (
                      "Gửi link đặt lại mật khẩu"
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
            </>
          )}
        </div>
      </div>
    </main>
  );
}
