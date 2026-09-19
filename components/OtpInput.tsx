"use client";

import { useEffect, useRef } from "react";
import { OTP_LENGTH } from "../lib/otp";

interface OtpInputProps {
  digits: string[];
  onChange: (digits: string[]) => void;
  disabled?: boolean;
}

/** 6 ô nhập OTP: tự nhảy ô, Backspace/mũi tên để di chuyển, dán cả mã vào một ô. */
export default function OtpInput({ digits, onChange, disabled = false }: OtpInputProps) {
  const inputsRef = useRef<Array<HTMLInputElement | null>>([]);

  // Ô bị disable khi đang gửi/hết hạn; mở lại thì đưa con trỏ về ô trống đầu tiên.
  useEffect(() => {
    if (disabled) return;
    const firstEmpty = digits.findIndex((d) => d === "");
    inputsRef.current[firstEmpty === -1 ? 0 : firstEmpty]?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [disabled]);

  const handleChange = (index: number, value: string) => {
    const clean = value.replace(/\D/g, "");
    const next = [...digits];
    if (!clean) {
      next[index] = "";
      onChange(next);
      return;
    }
    // Gõ/dán nhiều số vào một ô ⇒ rải sang các ô sau.
    clean
      .slice(0, OTP_LENGTH - index)
      .split("")
      .forEach((d, i) => {
        next[index + i] = d;
      });
    inputsRef.current[Math.min(index + clean.length, OTP_LENGTH - 1)]?.focus();
    onChange(next);
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !digits[index] && index > 0) {
      inputsRef.current[index - 1]?.focus();
    } else if (e.key === "ArrowLeft" && index > 0) {
      inputsRef.current[index - 1]?.focus();
    } else if (e.key === "ArrowRight" && index < OTP_LENGTH - 1) {
      inputsRef.current[index + 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, OTP_LENGTH);
    if (!pasted) return;
    e.preventDefault();
    const next = Array(OTP_LENGTH).fill("");
    pasted.split("").forEach((d, i) => {
      next[i] = d;
    });
    inputsRef.current[Math.min(pasted.length, OTP_LENGTH - 1)]?.focus();
    onChange(next);
  };

  return (
    <div className="flex justify-center gap-2">
      {digits.map((digit, i) => (
        <input
          key={i}
          ref={(el) => {
            inputsRef.current[i] = el;
          }}
          type="text"
          inputMode="numeric"
          autoComplete={i === 0 ? "one-time-code" : "off"}
          maxLength={OTP_LENGTH}
          value={digit}
          disabled={disabled}
          aria-label={`Chữ số thứ ${i + 1}`}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onPaste={handlePaste}
          onFocus={(e) => e.target.select()}
          className="w-11 h-12 sm:w-12 sm:h-14 rounded-[10px] border-[1.5px] border-[#E4E1DC] focus:border-[#4F46E5] focus:ring-1 focus:ring-[#4F46E5] outline-none transition-all text-center text-[20px] font-bold text-[#191817] bg-[#FAF9F7] disabled:opacity-50"
        />
      ))}
    </div>
  );
}

export const emptyOtp = (): string[] => Array(OTP_LENGTH).fill("");

/** Nhắc user tìm trong Thư rác: email OTP gửi từ Gmail cá nhân đôi khi bị lọc nhầm. */
export function OtpSpamHint() {
  return (
    <p className="text-[11.5px] text-[#8A6D1F] bg-[#FBF4E4] border border-[#F0DFB4] rounded-[8px] px-3 py-2 leading-[1.55] text-left">
      Không thấy email? Hãy kiểm tra mục <strong>Thư rác (Spam)</strong> hoặc <strong>Quảng cáo</strong>. Nếu
      thấy ở đó, bấm <strong>&ldquo;Không phải thư rác&rdquo;</strong> để lần sau email vào Hộp thư đến.
    </p>
  );
}
