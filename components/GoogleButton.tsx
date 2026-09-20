"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { useGoogleLogin } from "@react-oauth/google";
import { isGoogleAuthEnabled } from "@/lib/google-auth";

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

/**
 * Không cấu hình `NEXT_PUBLIC_GOOGLE_CLIENT_ID` thì không có nút Google (T24, `lib/google-auth.ts`).
 *
 * Phải tách làm hai component: `useGoogleLogin` là hook, gọi nó ngoài `GoogleOAuthProvider` sẽ ném
 * "Google OAuth components must be used within GoogleOAuthProvider". Trả `null` ở vỏ bọc nghĩa là
 * hook bên trong không bao giờ chạy khi provider vắng mặt.
 */
export default function GoogleButton(props: GoogleButtonProps) {
  if (!isGoogleAuthEnabled) return null;
  return <GoogleLoginButton {...props} />;
}

function GoogleLoginButton({ onSuccess, onError, label, disabled }: GoogleButtonProps) {
  const t = useTranslations("auth.google");
  const [loading, setLoading] = useState(false);

  const login = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      setLoading(false);
      if (tokenResponse?.access_token) {
        await onSuccess(tokenResponse.access_token);
      } else {
        onError(t("failed"));
      }
    },
    onError: (errorResponse) => {
      setLoading(false);
      console.error("Google Login Error:", errorResponse);
      onError(t("cancelled"));
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
      // Phẳng như nút phụ của app: nền xám ấm, hover đậm một nấc, không viền / bóng
      className="flex h-11 w-full cursor-pointer items-center justify-center gap-2.5 rounded-control bg-surface-container px-4 text-[14px] font-bold text-on-surface transition-[background-color,transform] duration-150 hover:bg-surface-container-high active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-50"
    >
      {GOOGLE_G_LOGO}
      {loading ? t("opening") : label}
    </button>
  );
}
