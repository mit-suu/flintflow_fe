"use client";

import { Suspense, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import Logo from "../../../components/Logo";
import OtpInput, { OtpSpamHint, emptyOtp } from "../../../components/OtpInput";
import { buildResetPasswordHref, formatOtpTime, useOtpCountdown } from "../../../lib/otp";
import { logoutAndRedirect } from "../../../lib/auth";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api/v1";

type Step = "otp" | "password" | "success";

const cardClass =
  "bg-white border border-[#E4E1DC] rounded-[18px] p-6 sm:p-7 shadow-[0_8px_32px_rgba(17,24,39,0.10)] flex flex-col gap-4";

const getPasswordStrength = (pwd: string) => {
  if (!pwd) return { level: 0, text: "" };
  if (pwd.length < 6) return { level: 1, text: "Yếu", color: "#B03030" };
  if (pwd.length < 8 || !/\d/.test(pwd)) return { level: 2, text: "Trung bình", color: "#E8A23D" };
  return { level: 3, text: "Mạnh", color: "#1F7A45" };
};

function ResetPasswordContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const email = searchParams.get("email") || "";

  // Bước 1: nhập OTP. Chỉ khi BE xác nhận đúng mới sang bước 2 với `resetToken` (giữ trong state, không
  // đưa lên URL — tải lại trang thì quay về bước 1).
  const [step, setStep] = useState<Step>("otp");
  const [resetToken, setResetToken] = useState<string | null>(null);

  const { secondsLeft, expired, restart, expireNow } = useOtpCountdown(Number(searchParams.get("exp")) || 0);
  const [digits, setDigits] = useState<string[]>(emptyOtp);
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [info, setInfo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [saving, setSaving] = useState(false);

  const strength = getPasswordStrength(password);
  // Chỉ báo khi user đã gõ vào ô xác nhận, tránh đỏ ngay từ lúc mới vào bước 2
  const passwordMismatch = confirmPassword.length > 0 && password !== confirmPassword;
  const otpComplete = digits.every((d) => d !== "");

  const verifyOtp = async (otp: string) => {
    if (verifying || expired) return;
    setVerifying(true);
    setError(null);
    setInfo(null);
    try {
      const res = await fetch(`${API_BASE_URL}/auth/reset-password/verify-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, otp }),
      });
      const json = await res.json();

      if (!res.ok || json.error) {
        const code: string | undefined = json.error?.code;
        if (code === "OTP_EXPIRED" || code === "OTP_TOO_MANY_ATTEMPTS") expireNow();
        throw new Error(json.error?.message || "Xác nhận mã thất bại");
      }

      setResetToken(json.data.resetToken);
      setStep("password");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Đã có lỗi xảy ra");
      setDigits(emptyOtp());
    } finally {
      setVerifying(false);
    }
  };

  const handleDigitsChange = (next: string[]) => {
    setDigits(next);
    if (next.every((d) => d !== "")) verifyOtp(next.join(""));
  };

  const handleResend = async () => {
    if (!expired || resending) return;
    setResending(true);
    setError(null);
    setInfo(null);
    try {
      const res = await fetch(`${API_BASE_URL}/auth/forgot-password`, {
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
      router.replace(buildResetPasswordHref(email, expiresIn));
      setDigits(emptyOtp());
      setInfo("Đã gửi mã OTP mới. Vui lòng kiểm tra hộp thư đến.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Đã xảy ra lỗi kết nối.");
    } finally {
      setResending(false);
    }
  };

  const handleSavePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("Mật khẩu xác nhận không khớp.");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`${API_BASE_URL}/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resetToken, password }),
      });
      const json = await res.json();

      if (!res.ok || json.error) {
        if (json.error?.code === "RESET_SESSION_EXPIRED") {
          // Vé hết hạn (quá 10 phút) ⇒ quay lại bước OTP để xin mã mới
          setResetToken(null);
          setDigits(emptyOtp());
          expireNow();
          setStep("otp");
        }
        throw new Error(json.error?.message || "Đặt lại mật khẩu thất bại");
      }

      setStep("success");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Đã có lỗi xảy ra");
    } finally {
      setSaving(false);
    }
  };

  const alerts = (
    <>
      {error && (
        <div className="p-3 rounded-[10px] bg-[#FDEDED] border border-[#F2CACA] text-[12px] text-[#8A4141] flex items-center gap-2">
          <span className="material-symbols-outlined text-[16px] shrink-0">error</span>
          <span>{error}</span>
        </div>
      )}
      {info && (
        <div className="p-3 rounded-[10px] bg-[#EAF6EE] text-[#1F7A45] text-[12px] font-semibold border border-[#C2E5CF]">
          {info}
        </div>
      )}
    </>
  );

  const backToLogin = (
    <div className="text-center pt-1">
      <Link
        href="/login"
        className="text-[12.5px] font-semibold text-[#6B6862] hover:text-[#191817] transition-colors"
      >
        ← Quay lại đăng nhập
      </Link>
    </div>
  );

  if (!email) {
    return (
      <div className={`${cardClass} text-center`}>
        <div className="w-12 h-12 rounded-[14px] bg-[#FDEDED] text-[#B03030] flex items-center justify-center text-[22px] mx-auto">
          ⚠
        </div>
        <h1 className="text-[20px] font-extrabold text-[#191817]">
          Thiếu địa chỉ email
        </h1>
        <p className="text-[13px] text-[#8A867E] leading-[1.6]">
          Vui lòng nhập email tài khoản để nhận mã OTP đặt lại mật khẩu.
        </p>
        <Link
          href="/forgot-password"
          className="w-full py-3 px-4 rounded-[10px] btn-gradient-primary text-white text-[13px] font-bold text-center"
        >
          Nhận mã OTP →
        </Link>
      </div>
    );
  }

  if (step === "success") {
    return (
      <div className={`${cardClass} text-center`}>
        <div className="w-12 h-12 rounded-[14px] bg-[#EAF6EE] text-[#1F7A45] flex items-center justify-center text-[22px] mx-auto">
          ✓
        </div>
        <h1 className="text-[20px] font-extrabold text-[#191817]">
          Đặt lại mật khẩu thành công!
        </h1>
        <p className="text-[13px] text-[#8A867E] leading-[1.65]">
          Mật khẩu của bạn đã được cập nhật. Mọi phiên đăng nhập cũ đã được thu hồi an toàn.
        </p>
        <button
          // Mở từ trang Hồ sơ thì trình duyệt còn access token cũ (tối đa 15 phút) ⇒ /login bị đẩy về /home.
          // Xoá hẳn phiên cũ trước khi sang trang đăng nhập.
          onClick={() => void logoutAndRedirect("/login")}
          className="w-full py-3.5 px-4 rounded-[10px] btn-gradient-primary text-white text-[13.5px] font-bold cursor-pointer"
        >
          Đăng nhập ngay →
        </button>
      </div>
    );
  }

  if (step === "otp") {
    return (
      <div className={cardClass}>
        <div>
          <p className="text-[11px] font-bold text-[#4F46E5] uppercase tracking-wide">Bước 1/2</p>
          <h1 className="text-[22px] font-extrabold text-[#191817] tracking-[-0.02em]">
            Nhập mã xác nhận
          </h1>
          <p className="text-[13px] text-[#8A867E] mt-1 leading-[1.6]">
            Nhập mã 6 số đã gửi tới <strong className="text-[#191817] font-bold break-all">{email}</strong>.
          </p>
        </div>

        {alerts}

        <form
          className="flex flex-col gap-3.5"
          onSubmit={(e) => {
            e.preventDefault();
            if (otpComplete) verifyOtp(digits.join(""));
          }}
        >
          <OtpInput digits={digits} onChange={handleDigitsChange} disabled={verifying || expired} />

          <div className="text-[12.5px] text-center" aria-live="polite">
            {expired ? (
              <span className="text-[#B03030] font-semibold">Mã OTP đã hết hạn. Vui lòng gửi lại mã mới.</span>
            ) : (
              <span className="text-[#8A867E]">
                Mã hết hạn sau <strong className="text-[#191817] font-bold">{formatOtpTime(secondsLeft)}</strong>
              </span>
            )}
          </div>

          <OtpSpamHint />

          {expired ? (
            <button
              type="button"
              onClick={handleResend}
              disabled={resending}
              className="w-full py-3.5 px-4 rounded-[10px] btn-gradient-primary text-white text-[13.5px] font-bold flex justify-center items-center gap-2 cursor-pointer disabled:opacity-60"
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
              disabled={!otpComplete || verifying}
              className="w-full py-3.5 px-4 rounded-[10px] btn-gradient-primary text-white text-[13.5px] font-bold flex justify-center items-center gap-2 cursor-pointer disabled:opacity-60"
            >
              {verifying ? (
                <>
                  <span className="w-3.5 h-3.5 rounded-full border-2 border-white/40 border-t-white ff-spinner shrink-0" />
                  Đang xác nhận…
                </>
              ) : (
                "Xác nhận mã →"
              )}
            </button>
          )}

          {backToLogin}
        </form>
      </div>
    );
  }

  return (
    <div className={cardClass}>
      <div>
        <p className="text-[11px] font-bold text-[#4F46E5] uppercase tracking-wide">Bước 2/2</p>
        <h1 className="text-[22px] font-extrabold text-[#191817] tracking-[-0.02em]">
          Đặt mật khẩu mới
        </h1>
        <p className="text-[13px] text-[#8A867E] mt-1 leading-[1.6]">
          Mã đã được xác nhận. Tạo mật khẩu mới cho{" "}
          <strong className="text-[#191817] font-bold break-all">{email}</strong>.
        </p>
      </div>

      {alerts}

      <form className="flex flex-col gap-3.5" onSubmit={handleSavePassword}>
        {/* New Password */}
        <div className="flex flex-col gap-1">
          <label className="text-[12px] font-bold text-[#4B4842]" htmlFor="password">
            Mật khẩu mới
          </label>
          <div className="relative">
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              required
              minLength={8}
              autoFocus
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-3.5 py-2.5 pr-10 rounded-[8px] border-[1.5px] border-[#E4E1DC] focus:border-[#4F46E5] focus:ring-1 focus:ring-[#4F46E5] outline-none transition-all text-[#191817] bg-[#FAF9F7] text-[13.5px]"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
              className="absolute right-3 top-2.5 text-[#A8A49C] hover:text-[#191817] transition-colors"
            >
              <span className="material-symbols-outlined text-[18px]">
                {showPassword ? "visibility_off" : "visibility"}
              </span>
            </button>
          </div>

          {password.length > 0 && (
            <div className="flex items-center gap-2.5 pt-1">
              <div className="flex-1 flex gap-1">
                <div
                  className="flex-1 h-1 rounded-full transition-colors"
                  style={{ background: strength.level >= 1 ? strength.color : "#E4E1DC" }}
                />
                <div
                  className="flex-1 h-1 rounded-full transition-colors"
                  style={{ background: strength.level >= 2 ? strength.color : "#E4E1DC" }}
                />
                <div
                  className="flex-1 h-1 rounded-full transition-colors"
                  style={{ background: strength.level >= 3 ? strength.color : "#E4E1DC" }}
                />
              </div>
              <span className="text-[11px] font-bold" style={{ color: strength.color }}>
                {strength.text}
              </span>
            </div>
          )}
        </div>

        {/* Confirm New Password */}
        <div className="flex flex-col gap-1">
          <label className="text-[12px] font-bold text-[#4B4842]" htmlFor="confirmPassword">
            Xác nhận mật khẩu mới
          </label>
          <div className="relative">
            <input
              id="confirmPassword"
              type={showConfirmPassword ? "text" : "password"}
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              aria-invalid={passwordMismatch}
              aria-describedby={passwordMismatch ? "confirmPassword-error" : undefined}
              className={`w-full px-3.5 py-2.5 pr-10 rounded-[8px] border-[1.5px] outline-none transition-all text-[#191817] text-[13.5px] focus:ring-1 ${
                passwordMismatch
                  ? "border-[#B03030] bg-[#FDF6F6] focus:border-[#B03030] focus:ring-[#B03030]"
                  : "border-[#E4E1DC] bg-[#FAF9F7] focus:border-[#4F46E5] focus:ring-[#4F46E5]"
              }`}
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              aria-label={showConfirmPassword ? "Ẩn mật khẩu xác nhận" : "Hiện mật khẩu xác nhận"}
              className="absolute right-3 top-2.5 text-[#A8A49C] hover:text-[#191817] transition-colors"
            >
              <span className="material-symbols-outlined text-[18px]">
                {showConfirmPassword ? "visibility_off" : "visibility"}
              </span>
            </button>
          </div>
          {passwordMismatch && (
            <p id="confirmPassword-error" className="text-[11.5px] font-semibold text-[#B03030] flex items-center gap-1 pt-0.5">
              <span className="material-symbols-outlined text-[14px]">error</span>
              Mật khẩu xác nhận không giống với mật khẩu mới.
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={saving || !confirmPassword || passwordMismatch}
          className="w-full mt-2 py-3.5 px-4 rounded-[10px] btn-gradient-primary text-white text-[13.5px] font-bold flex justify-center items-center gap-2 cursor-pointer disabled:opacity-60"
        >
          {saving ? (
            <>
              <span className="w-3.5 h-3.5 rounded-full border-2 border-white/40 border-t-white ff-spinner shrink-0" />
              Đang cập nhật…
            </>
          ) : (
            "Đặt lại mật khẩu →"
          )}
        </button>

        {backToLogin}
      </form>
    </div>
  );
}

export default function ResetPasswordPage() {
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
          <ResetPasswordContent />
        </Suspense>
      </div>
    </div>
  );
}
