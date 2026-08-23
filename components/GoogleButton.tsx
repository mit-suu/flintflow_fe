"use client";

import { useState } from "react";
import { useGoogleLogin } from "@react-oauth/google";

interface GoogleButtonProps {
  onSuccess: (idToken: string) => void | Promise<void>;
  onError: (message: string) => void;
  label: string;
  disabled?: boolean;
}

const GOOGLE_G_LOGO = (
  <svg className="h-5 w-5 shrink-0" viewBox="0 0 48 48" aria-hidden="true">
    <path
      fill="#EA4335"
      d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
    />
    <path
      fill="#4285F4"
      d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
    />
    <path
      fill="#FBBC05"
      d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
    />
    <path
      fill="#34A853"
      d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
    />
  </svg>
);

export default function GoogleButton({ onSuccess, onError, label, disabled }: GoogleButtonProps) {
  const [loading, setLoading] = useState(false);

  const login = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      setLoading(false);
      if (tokenResponse?.access_token) {
        await onSuccess(tokenResponse.access_token);
      } else {
        onError("Đăng nhập Google không thành công.");
      }
    },
    onError: (errorResponse) => {
      setLoading(false);
      console.error("Google Login Error:", errorResponse);
      onError("Đăng nhập Google bị hủy hoặc thất bại.");
    },
  });

  const handleClick = () => {
    if (disabled || loading) return;
    setLoading(true);
    login();
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled || loading}
      className="w-full flex items-center justify-center gap-2.5 bg-white hover:bg-[#FAF9F7] text-[#191817] font-bold py-3 px-4 rounded-[12px] border-[1.5px] border-[#E4E1DC] hover:border-[#DDD9F6] shadow-[0_2px_6px_rgba(25,24,23,0.05)] transition-all disabled:opacity-50 text-[13px] btn-press"
    >
      <span className="w-[17px] height-[17px] h-[17px] rounded-full shrink-0 inline-block" style={{ background: "conic-gradient(from -30deg,#EA4335 0 25%,#FBBC05 0 50%,#34A853 0 75%,#4285F4 0)" }} />
      {loading ? "Đang mở Google..." : label}
    </button>
  );
}
