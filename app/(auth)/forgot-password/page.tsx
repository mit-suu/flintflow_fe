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
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });

      const json = await res.json();

      if (!res.ok || json.status === "error") {
        throw new Error(json.message || "Không thể gửi yêu cầu đặt lại mật khẩu");
      }

      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Đã có lỗi xảy ra");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-4 sm:p-8 min-h-screen z-10">
      <div className="w-full max-w-[420px] flex flex-col gap-4">
        
        {/* Logo Top */}
        <Logo variant="wordmark" sizeClassName="h-[18px] w-auto" theme="light" href="/" />

        {/* Card (A3 Design) */}
        <div className="bg-white border border-[#E4E1DC] rounded-[18px] p-6 sm:p-7 shadow-[0_8px_32px_rgba(17,24,39,0.10)] flex flex-col gap-4">
          {submitted ? (
            <div className="flex flex-col items-center text-center gap-3.5 py-2">
              <div className="w-12 h-12 rounded-[14px] bg-[#F2F1FB] flex items-center justify-center text-[22px]">
                ✉️
              </div>
              <h1 className="text-[20px] font-extrabold text-[#191817]">
                Đã gửi liên kết
              </h1>
              <p className="text-[13px] text-[#8A867E] leading-[1.65]">
                Nếu <strong className="text-[#4B4842]">{email}</strong> có tài khoản, bạn sẽ nhận được liên kết đặt lại mật khẩu trong vài phút. Kiểm tra cả hộp thư spam.
              </p>
              <button
                type="button"
                onClick={() => setSubmitted(false)}
                className="w-full py-2.5 px-4 rounded-[8px] border-[1.5px] border-[#E4E1DC] text-center text-[13px] font-bold text-[#6B6862] bg-[#FAF9F7] hover:bg-[#F0EEEA] transition-colors"
              >
                Gửi lại email khác
              </button>
              <Link
                href="/login"
                className="text-[12.5px] font-semibold text-[#6A62C4] hover:underline pt-1"
              >
                ← Quay lại đăng nhập
              </Link>
            </div>
          ) : (
            <>
              <div>
                <h1 className="text-[22px] font-extrabold text-[#191817] tracking-[-0.02em]">
                  Quên mật khẩu
                </h1>
                <p className="text-[13px] text-[#8A867E] mt-1 leading-[1.6]">
                  Nhập email tài khoản để nhận liên kết đặt lại mật khẩu.
                </p>
              </div>

              {/* Error Alert */}
              {error && (
                <div className="p-3 rounded-[10px] bg-[#FDEDED] border border-[#F2CACA] text-[12px] text-[#8A4141] flex items-center gap-2">
                  <span className="material-symbols-outlined text-[16px] shrink-0">error</span>
                  <span>{error}</span>
                </div>
              )}

              <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
                <div className="flex flex-col gap-1">
                  <label className="text-[12px] font-bold text-[#4B4842]" htmlFor="email">
                    Email
                  </label>
                  <input
                    id="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="mai@studio.vn"
                    className="w-full px-3.5 py-2.5 rounded-[8px] border-[1.5px] border-[#E4E1DC] focus:border-[#6A62C4] focus:ring-1 focus:ring-[#6A62C4] outline-none transition-all text-[#191817] bg-[#FAF9F7] text-[13.5px]"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3.5 px-4 rounded-[10px] btn-gradient-primary text-white text-[13.5px] font-bold flex justify-center items-center gap-2 cursor-pointer disabled:opacity-60"
                >
                  {loading ? (
                    <>
                      <span className="w-3.5 h-3.5 rounded-full border-2 border-white/40 border-t-white ff-spinner shrink-0" />
                      Đang gửi…
                    </>
                  ) : (
                    "Gửi liên kết đặt lại →"
                  )}
                </button>

                <div className="text-center pt-1">
                  <Link
                    href="/login"
                    className="text-[12.5px] font-semibold text-[#6B6862] hover:text-[#191817] transition-colors"
                  >
                    ← Quay lại đăng nhập
                  </Link>
                </div>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
