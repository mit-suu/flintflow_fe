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
    <div className="bg-white border border-[#E4E1DC] rounded-[18px] p-6 sm:p-7 shadow-[0_8px_32px_rgba(17,24,39,0.10)] text-center flex flex-col gap-4">
      {/* Mail Icon */}
      <div className="w-12 h-12 rounded-[14px] bg-[#F4F3FE] flex items-center justify-center text-[22px] mx-auto">
        ✉️
      </div>

      <h1 className="text-[20px] font-extrabold text-[#191817]">
        Kiểm tra email của bạn
      </h1>

      <p className="text-[13px] text-[#8A867E] leading-[1.65]">
        Chúng tôi đã gửi một liên kết xác nhận đến{" "}
        {email ? (
          <strong className="text-[#191817] font-bold">{email}</strong>
        ) : (
          "email của bạn"
        )}
        . Vui lòng kiểm tra hộp thư đến (hoặc thư mục Spam) để hoàn tất đăng ký.
      </p>

      {/* Status Message */}
      {message && (
        <div className="p-3 rounded-[10px] bg-[#EAF6EE] text-[#1F7A45] text-[12px] font-semibold border border-[#C2E5CF]">
          {message}
        </div>
      )}

      {/* Resend Button */}
      <button
        type="button"
        onClick={handleResend}
        disabled={cooldown > 0 || resending}
        className="w-full py-3 px-4 rounded-[10px] btn-gradient-primary text-white text-[13px] font-bold flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
      >
        {resending ? (
          <>
            <span className="w-3.5 h-3.5 rounded-full border-2 border-white/40 border-t-white ff-spinner shrink-0" />
            Đang gửi…
          </>
        ) : cooldown > 0 ? (
          `Gửi lại sau (${cooldown}s)`
        ) : (
          "Gửi lại email xác thực →"
        )}
      </button>

      {/* Back link */}
      <div className="pt-2 border-t border-[#ECEAE5]">
        <Link
          href="/login"
          className="text-[12.5px] font-semibold text-[#6B6862] hover:text-[#191817] transition-colors"
        >
          ← Trở lại trang đăng nhập
        </Link>
      </div>
    </div>
  );
}

export default function CheckEmailPage() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-4 sm:p-8 min-h-screen z-10">
      <div className="w-full max-w-[420px] flex flex-col gap-4">
        <Logo variant="wordmark" sizeClassName="h-[18px] w-auto" theme="light" href="/" />

        <Suspense
          fallback={
            <div className="w-full bg-white rounded-[18px] p-7 border border-[#E4E1DC] text-center text-xs text-[#8A867E]">
              Đang tải…
            </div>
          }
        >
          <CheckEmailContent />
        </Suspense>
      </div>
    </div>
  );
}
