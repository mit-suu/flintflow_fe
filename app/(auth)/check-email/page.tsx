"use client";

import { Suspense, useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import Logo from "../../../components/Logo";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api/v1";

function CheckEmailContent() {
  const searchParams = useSearchParams();
  const email = searchParams.get("email") || "";

  const [cooldown, setCooldown] = useState(60);
  const [resending, setResending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (cooldown > 0) {
      const timer = setTimeout(() => setCooldown(cooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [cooldown]);

  const handleResend = async () => {
    if (cooldown > 0 || resending || !email) return;
    setResending(true);
    setMessage(null);
    try {
      const res = await fetch(`${API_BASE_URL}/auth/verify-email/resend`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (res.ok) {
        setMessage("Đã gửi lại email xác thực thành công!");
        setCooldown(60);
      } else {
        setMessage("Không thể gửi lại email. Vui lòng thử lại sau.");
      }
    } catch {
      setMessage("Đã xảy ra lỗi kết nối.");
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="w-full max-w-[400px] flex flex-col items-center">
      {/* Logo */}
      <div className="mb-4 text-center">
        <Logo sizeClassName="w-36 h-36" />
      </div>

      {/* Card Container */}
      <div className="w-full bg-surface-container-lowest rounded-xl p-6 card-elevated border border-surface-container text-center">
        {/* Step Indicator */}
        <div className="flex items-center justify-center gap-3 mb-6">
          <div className="flex items-center gap-1.5">
            <div className="w-5 h-5 rounded-full bg-primary-container text-white flex items-center justify-center text-[11px] font-semibold">
              1
            </div>
            <span className="text-xs font-semibold text-on-surface">
              Xác nhận email
            </span>
          </div>
          <div className="w-8 h-px bg-surface-container" />
          <div className="flex items-center gap-1.5">
            <div className="w-5 h-5 rounded-full bg-surface-container text-secondary flex items-center justify-center text-[11px] font-semibold">
              2
            </div>
            <span className="text-xs text-secondary">Hoàn tất đăng ký</span>
          </div>
        </div>

        {/* Mail Icon */}
        <div className="mb-4 inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary-fixed text-primary">
          <span className="material-symbols-outlined text-[32px]">mail</span>
        </div>

        <h1 className="text-xl font-bold text-on-surface tracking-tight mb-2">
          Kiểm tra email của bạn
        </h1>

        <p className="text-xs text-secondary mb-6 leading-relaxed">
          Chúng tôi đã gửi một liên kết xác nhận đến{" "}
          {email ? (
            <strong className="text-on-surface">{email}</strong>
          ) : (
            "email của bạn"
          )}
          . Vui lòng kiểm tra hộp thư đến để hoàn tất đăng ký.
        </p>

        {/* Status Message */}
        {message && (
          <div className="mb-5 bg-primary-fixed/50 border border-primary-fixed-dim/40 text-on-primary-container px-3.5 py-2.5 rounded-lg text-xs">
            {message}
          </div>
        )}

        {/* Resend Button */}
        <button
          type="button"
          onClick={handleResend}
          disabled={cooldown > 0 || resending}
          className="w-full h-10 bg-primary-container text-white font-medium text-xs rounded-lg shadow-sm transition-all hover:brightness-90 btn-press disabled:opacity-50 flex items-center justify-center gap-1.5 mb-6"
        >
          {resending ? (
            <>
              <span className="material-symbols-outlined text-lg ff-spinner">
                progress_activity
              </span>
              Đang gửi...
            </>
          ) : cooldown > 0 ? (
            `Gửi lại email sau (${cooldown}s)`
          ) : (
            <>
              <span className="material-symbols-outlined text-lg">
                open_in_new
              </span>
              Gửi lại email xác thực
            </>
          )}
        </button>

        {/* Back link */}
        <div className="pt-3 border-t border-surface-container">
          <Link
            href="/login"
            className="text-xs text-secondary hover:text-primary font-medium transition-colors"
          >
            ← Trở lại trang đăng nhập
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function CheckEmailPage() {
  return (
    <main className="flex-grow flex items-center justify-center px-4 py-8">
      <Suspense
        fallback={
          <div className="w-full max-w-[400px] bg-surface-container-lowest rounded-xl p-6 card-elevated border border-surface-container text-center text-xs text-secondary">
            Đang tải...
          </div>
        }
      >
        <CheckEmailContent />
      </Suspense>
    </main>
  );
}
