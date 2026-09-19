"use client";

import { useState } from "react";

interface PasswordInputProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  /** Có ⇒ viền đỏ + dòng lỗi đỏ bên dưới. */
  error?: string | null;
  autoComplete?: string;
  minLength?: number;
  children?: React.ReactNode;
}

/** Ô mật khẩu có nút mắt hiện/ẩn và trạng thái lỗi đỏ. `children` hiện dưới ô (vd. thanh độ mạnh). */
export default function PasswordInput({
  id,
  label,
  value,
  onChange,
  error,
  autoComplete,
  minLength,
  children,
}: PasswordInputProps) {
  const [visible, setVisible] = useState(false);
  const errorId = `${id}-error`;

  return (
    <div className="flex flex-col gap-1">
      <label className="text-[12px] font-bold text-[#4B4842]" htmlFor={id}>
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={visible ? "text" : "password"}
          required
          minLength={minLength}
          autoComplete={autoComplete}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="••••••••"
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : undefined}
          className={`w-full px-3.5 py-2.5 pr-10 rounded-[8px] border-[1.5px] outline-none transition-all text-[#191817] text-[13.5px] focus:ring-1 ${
            error
              ? "border-[#B03030] bg-[#FDF6F6] focus:border-[#B03030] focus:ring-[#B03030]"
              : "border-[#E4E1DC] bg-[#FAF9F7] focus:border-[#6A62C4] focus:ring-[#6A62C4]"
          }`}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? `Ẩn ${label.toLowerCase()}` : `Hiện ${label.toLowerCase()}`}
          className="absolute right-3 top-2.5 text-[#A8A49C] hover:text-[#191817] transition-colors"
        >
          <span className="material-symbols-outlined text-[18px]">{visible ? "visibility_off" : "visibility"}</span>
        </button>
      </div>
      {error && (
        <p id={errorId} className="text-[11.5px] font-semibold text-[#B03030] flex items-center gap-1 pt-0.5">
          <span className="material-symbols-outlined text-[14px]">error</span>
          {error}
        </p>
      )}
      {children}
    </div>
  );
}
