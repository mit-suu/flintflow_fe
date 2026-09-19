"use client";

import { Suspense, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import LocaleSwitcher from "@/components/LocaleSwitcher";
import { localizeApiError } from "@/lib/api/error-messages";
import Logo from "../../../components/Logo";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api/v1";

function ResetPasswordContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const t = useTranslations("auth");
  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const getPasswordStrength = (pwd: string) => {
    if (!pwd) return { level: 0, text: "" };
    if (pwd.length < 6) return { level: 1, text: t("common.strength.weak"), color: "#B03030" };
    if (pwd.length < 8 || !/\d/.test(pwd)) return { level: 2, text: t("common.strength.medium"), color: "#E8A23D" };
    return { level: 3, text: t("common.strength.strong"), color: "#1F7A45" };
  };

  const strength = getPasswordStrength(password);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError(t("common.passwordMismatch"));
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });

      const json = await res.json();

      if (!res.ok || json.error) {
        throw new Error(localizeApiError(json.error?.code, json.error?.message ?? "") || t("reset.failed"));
      }

      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("common.genericError"));
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="bg-white border border-[#E4E1DC] rounded-[18px] p-6 sm:p-7 shadow-[0_8px_32px_rgba(17,24,39,0.10)] text-center flex flex-col gap-4">
        <div className="w-12 h-12 rounded-[14px] bg-[#FDEDED] text-[#B03030] flex items-center justify-center text-[22px] mx-auto">
          ⚠
        </div>
        <h1 className="text-[20px] font-extrabold text-[#191817]">
          {t("common.invalidLink")}
        </h1>
        <p className="text-[13px] text-[#8A867E] leading-[1.6]">
          {t("reset.invalidBody")}
        </p>
        <Link
          href="/forgot-password"
          className="w-full py-3 px-4 rounded-[10px] btn-gradient-primary text-white text-[13px] font-bold text-center"
        >
          {t("reset.requestNew")}
        </Link>
      </div>
    );
  }

  if (success) {
    return (
      <div className="bg-white border border-[#E4E1DC] rounded-[18px] p-6 sm:p-7 shadow-[0_8px_32px_rgba(17,24,39,0.10)] text-center flex flex-col gap-4">
        <div className="w-12 h-12 rounded-[14px] bg-[#EAF6EE] text-[#1F7A45] flex items-center justify-center text-[22px] mx-auto">
          ✓
        </div>
        <h1 className="text-[20px] font-extrabold text-[#191817]">
          {t("reset.successTitle")}
        </h1>
        <p className="text-[13px] text-[#8A867E] leading-[1.65]">
          {t("reset.successBody")}
        </p>
        <button
          onClick={() => router.push("/login")}
          className="w-full py-3.5 px-4 rounded-[10px] btn-gradient-primary text-white text-[13.5px] font-bold cursor-pointer"
        >
          {t("reset.loginNow")}
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white border border-[#E4E1DC] rounded-[18px] p-6 sm:p-7 shadow-[0_8px_32px_rgba(17,24,39,0.10)] flex flex-col gap-4">
      <div>
        <h1 className="text-[22px] font-extrabold text-[#191817] tracking-[-0.02em]">
          {t("reset.title")}
        </h1>
        <p className="text-[13px] text-[#8A867E] mt-1">
          {t("reset.subtitle")}
        </p>
      </div>

      {error && (
        <div className="p-3 rounded-[10px] bg-[#FDEDED] border border-[#F2CACA] text-[12px] text-[#8A4141] flex items-center gap-2">
          <span className="material-symbols-outlined text-[16px] shrink-0">error</span>
          <span>{error}</span>
        </div>
      )}

      <form className="flex flex-col gap-3.5" onSubmit={handleSubmit}>
        {/* New Password */}
        <div className="flex flex-col gap-1">
          <label className="text-[12px] font-bold text-[#4B4842]" htmlFor="password">
            {t("reset.newPassword")}
          </label>
          <div className="relative">
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-3.5 py-2.5 pr-10 rounded-[8px] border-[1.5px] border-[#E4E1DC] focus:border-[#4F46E5] focus:ring-1 focus:ring-[#4F46E5] outline-none transition-all text-[#191817] bg-[#FAF9F7] text-[13.5px]"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
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
            {t("reset.confirmNewPassword")}
          </label>
          <input
            id="confirmPassword"
            type="password"
            required
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="••••••••"
            className="w-full px-3.5 py-2.5 rounded-[8px] border-[1.5px] border-[#E4E1DC] focus:border-[#4F46E5] focus:ring-1 focus:ring-[#4F46E5] outline-none transition-all text-[#191817] bg-[#FAF9F7] text-[13.5px]"
          />
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={loading || password !== confirmPassword}
          className="w-full mt-2 py-3.5 px-4 rounded-[10px] btn-gradient-primary text-white text-[13.5px] font-bold flex justify-center items-center gap-2 cursor-pointer disabled:opacity-60"
        >
          {loading ? (
            <>
              <span className="w-3.5 h-3.5 rounded-full border-2 border-white/40 border-t-white ff-spinner shrink-0" />
              {t("reset.submitting")}
            </>
          ) : (
            t("reset.submit")
          )}
        </button>

        <div className="text-center pt-1">
          <Link
            href="/login"
            className="text-[12.5px] font-semibold text-[#6B6862] hover:text-[#191817] transition-colors"
          >
            {t("common.backToLogin")}
          </Link>
        </div>
      </form>
    </div>
  );
}

export default function ResetPasswordPage() {
  const t = useTranslations("auth");

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-4 sm:p-8 min-h-screen z-10">
      <div className="w-full max-w-[420px] flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <Logo sizeClassName="w-7 h-7" theme="light" href="/" />
          <LocaleSwitcher tone="light" />
        </div>

        <Suspense
          fallback={
            <div className="w-full bg-white rounded-[18px] p-7 border border-[#E4E1DC] text-center text-xs text-[#8A867E]">
              {t("common.loading")}
            </div>
          }
        >
          <ResetPasswordContent />
        </Suspense>
      </div>
    </div>
  );
}
