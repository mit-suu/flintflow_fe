"use client";

import { Suspense, useState, useEffect, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import Logo from "../../../components/Logo";
import { saveAuthToken } from "../../../lib/auth";
import OtpInput, { OtpSpamHint, emptyOtp } from "../../../components/OtpInput";
import { buildVerifyEmailHref, formatOtpTime, useOtpCountdown } from "../../../lib/otp";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api/v1";

type VerifyStatus = "idle" | "verifying" | "success";

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const email = searchParams.get("email") || "";

  const { secondsLeft, expired, restart, expireNow } = useOtpCountdown(Number(searchParams.get("exp")) || 0);
  const [digits, setDigits] = useState<string[]>(emptyOtp);
  const [status, setStatus] = useState<VerifyStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [resending, setResending] = useState(false);
  const [countdown, setCountdown] = useState(3);

  useEffect(() => {
    if (status !== "success") return;
    if (countdown <= 0) {
      router.push("/home");
      return;
    }
    const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
    return () => clearTimeout(timer);
  }, [status, countdown, router]);

  const resetDigits = () => setDigits(emptyOtp());

  const submitOtp = useCallback(
    async (otp: string) => {
      if (status === "verifying" || !email) return;
      setStatus("verifying");
      setError(null);
      setInfo(null);
      try {
        const res = await fetch(`${API_BASE_URL}/auth/verify-email/confirm`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, otp }),
          credentials: "include",
        });
        const json = await res.json();

        if (!res.ok || json.error) {
          if (json.error?.code === "EMAIL_ALREADY_VERIFIED") {
            router.push("/login");
            return;
          }
          if (json.error?.code === "OTP_EXPIRED" || json.error?.code === "OTP_TOO_MANY_ATTEMPTS") {
            expireNow();
          }
          throw new Error(json.error?.message || "Xác thực thất bại");
        }

        const userRole = json.data?.user?.role || json.data?.role;
        if (json.data?.accessToken) {
          saveAuthToken(json.data.accessToken, userRole, { persistent: true });
        }
        setStatus("success");
      } catch (err) {
        setStatus("idle");
        setError(err instanceof Error ? err.message : "Đã có lỗi xảy ra");
        resetDigits();
      }
    },
    [email, status, router, expireNow]
  );

  const updateDigits = (next: string[]) => {
    setDigits(next);
    if (next.every((d) => d !== "") && !expired) {
      submitOtp(next.join(""));
    }
  };

  const handleResend = async () => {
    if (!expired || resending || !email) return;
    setResending(true);
    setError(null);
    setInfo(null);
    try {
      const res = await fetch(`${API_BASE_URL}/auth/verify-email/resend`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json.error) {
        throw new Error(json.error?.message || "Không thể gửi lại mã. Vui lòng thử lại sau.");
      }
      const expiresIn = Number(json.data?.otpExpiresIn) || 120;
      restart(expiresIn);
      router.replace(buildVerifyEmailHref(email, expiresIn));
      setInfo("Đã gửi mã OTP mới. Vui lòng kiểm tra hộp thư đến.");
      resetDigits();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Đã xảy ra lỗi kết nối.");
    } finally {
      setResending(false);
    }
  };

  if (!email) {
    return (
      <div className="bg-white border border-[#E4E1DC] rounded-[18px] p-6 sm:p-7 shadow-[0_8px_32px_rgba(17,24,39,0.10)] text-center flex flex-col gap-4">
        <div className="w-12 h-12 rounded-[14px] bg-[#FDEDED] text-[#B03030] flex items-center justify-center text-[22px] mx-auto">
          ⚠
        </div>
        <h1 className="text-[20px] font-extrabold text-[#191817]">Thiếu địa chỉ email</h1>
        <p className="text-[13px] text-[#8A867E] leading-[1.6]">
          Vui lòng đăng nhập bằng tài khoản vừa đăng ký để nhận mã xác thực.
        </p>
        <Link
          href="/login"
          className="w-full py-3 px-4 rounded-[10px] btn-gradient-primary text-white text-[13px] font-bold text-center"
        >
          Về trang Đăng nhập →
        </Link>
      </div>
    );
  }

  if (status === "success") {
    return (
      <div className="bg-white border border-[#E4E1DC] rounded-[18px] p-6 sm:p-7 shadow-[0_8px_32px_rgba(17,24,39,0.10)] text-center flex flex-col items-center gap-3.5">
        <div className="w-12 h-12 rounded-[14px] bg-[#EAF6EE] text-[#1F7A45] flex items-center justify-center text-[22px]">
          ✓
        </div>
        <h1 className="text-[20px] font-extrabold text-[#191817]">Xác thực thành công!</h1>
        <p className="text-[13px] text-[#8A867E] leading-[1.65]">
          Tài khoản của bạn đã được kích hoạt và tự động đăng nhập.
          <br />
          Đang chuyển hướng trong <strong className="text-[#191817] font-bold">{countdown}s</strong>…
        </p>
        <button
          onClick={() => router.push("/home")}
          className="w-full py-3.5 px-4 rounded-[10px] btn-gradient-primary text-white text-[13.5px] font-bold cursor-pointer"
        >
          Vào ứng dụng ngay →
        </button>
      </div>
    );
  }

  const otpComplete = digits.every((d) => d !== "");

  return (
    <div className="bg-white border border-[#E4E1DC] rounded-[18px] p-6 sm:p-7 shadow-[0_8px_32px_rgba(17,24,39,0.10)] text-center flex flex-col gap-4">
      <div className="w-12 h-12 rounded-[14px] bg-[#F4F3FE] flex items-center justify-center text-[22px] mx-auto">
        ✉️
      </div>

      <h1 className="text-[20px] font-extrabold text-[#191817]">Nhập mã xác thực</h1>

      <p className="text-[13px] text-[#8A867E] leading-[1.65]">
        Chúng tôi đã gửi mã gồm 6 chữ số đến{" "}
        <strong className="text-[#191817] font-bold break-all">{email}</strong>. Vui lòng kiểm tra hộp thư đến.
      </p>

      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (otpComplete && !expired) submitOtp(digits.join(""));
        }}
      >
        <OtpInput digits={digits} onChange={updateDigits} disabled={status === "verifying" || expired} />

        <div className="text-[12.5px]" aria-live="polite">
          {expired ? (
            <span className="text-[#B03030] font-semibold">Mã OTP đã hết hạn. Vui lòng gửi lại mã mới.</span>
          ) : (
            <span className="text-[#8A867E]">
              Mã hết hạn sau <strong className="text-[#191817] font-bold">{formatOtpTime(secondsLeft)}</strong>
            </span>
          )}
        </div>

        <OtpSpamHint />

        {error && (
          <div className="p-3 rounded-[10px] bg-[#FDEDED] border border-[#F2CACA] text-[12px] text-[#8A4141]">
            {error}
          </div>
        )}
        {info && (
          <div className="p-3 rounded-[10px] bg-[#EAF6EE] text-[#1F7A45] text-[12px] font-semibold border border-[#C2E5CF]">
            {info}
          </div>
        )}

        {expired ? (
          <button
            type="button"
            onClick={handleResend}
            disabled={resending}
            className="w-full py-3 px-4 rounded-[10px] btn-gradient-primary text-white text-[13px] font-bold flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
          >
            {resending ? (
              <>
                <span className="w-3.5 h-3.5 rounded-full border-2 border-white/40 border-t-white ff-spinner shrink-0" />
                Đang gửi…
              </>
            ) : (
              "Gửi lại mã OTP →"
            )}
          </button>
        ) : (
          <button
            type="submit"
            disabled={!otpComplete || status === "verifying"}
            className="w-full py-3 px-4 rounded-[10px] btn-gradient-primary text-white text-[13px] font-bold flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
          >
            {status === "verifying" ? (
              <>
                <span className="w-3.5 h-3.5 rounded-full border-2 border-white/40 border-t-white ff-spinner shrink-0" />
                Đang xác thực…
              </>
            ) : (
              "Xác thực →"
            )}
          </button>
        )}
      </form>

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

export default function VerifyEmailPage() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-4 sm:p-8 min-h-screen z-10">
      <div className="w-full max-w-[420px] flex flex-col gap-4">
        <Logo sizeClassName="w-7 h-7" theme="light" href="/" />

        <Suspense
          fallback={
            <div className="w-full bg-white rounded-[18px] p-7 border border-[#E4E1DC] text-center text-xs text-[#8A867E]">
              Đang tải…
            </div>
          }
        >
          <VerifyEmailContent />
        </Suspense>
      </div>
    </div>
  );
}
