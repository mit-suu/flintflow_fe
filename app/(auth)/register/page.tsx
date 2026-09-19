"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { localizeApiError } from "@/lib/api/error-messages";
import { applyAccountLocale } from "@/lib/i18n";
import LocaleSwitcher from "@/components/LocaleSwitcher";
import GoogleButton from "../../../components/GoogleButton";
import Logo from "../../../components/Logo";
import { saveAuthToken } from "../../../lib/auth";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api/v1";

export default function RegisterPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = useTranslations("auth");
  // Ngôn ngữ đang dùng lúc đăng ký thành ngôn ngữ của tài khoản và của email xác thực (T25).
  const locale = useLocale();
  const [name, setName] = useState("");
  // Form cuối landing gửi GET /register?email=… — điền sẵn để khỏi gõ lại.
  const [email, setEmail] = useState(() => searchParams.get("email")?.trim() ?? "");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Password strength calculation
  const getPasswordStrength = (pwd: string) => {
    if (!pwd) return { level: 0, text: "" };
    if (pwd.length < 6) return { level: 1, text: t("common.strength.weak"), color: "#B03030" };
    if (pwd.length < 8 || !/\d/.test(pwd)) return { level: 2, text: t("common.strength.medium"), color: "#E8A23D" };
    return { level: 3, text: t("common.strength.strong"), color: "#1F7A45" };
  };

  const strength = getPasswordStrength(password);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError(t("common.passwordMismatch"));
      return;
    }

    setLoading(true);

    try {
      const res = await fetch(`${API_BASE_URL}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() || undefined, email, password, locale }),
      });

      const json = await res.json();

      if (!res.ok || json.error) {
        throw new Error(localizeApiError(json.error?.code, json.error?.message ?? "") || t("register.failed"));
      }

      // Success -> Redirect to check-email
      router.push(`/check-email?email=${encodeURIComponent(email)}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("common.genericError"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-4 sm:p-8 min-h-screen z-10">
      <div className="w-full max-w-[440px] flex flex-col gap-4">
        
        {/* Logo Top */}
        <div className="flex items-center justify-between">
          <Logo sizeClassName="w-7 h-7" theme="light" href="/" />
          <LocaleSwitcher tone="light" />
        </div>

        {/* Card (A2 Design) */}
        <div className="bg-white border border-[#E4E1DC] rounded-[18px] p-6 sm:p-7 shadow-[0_8px_32px_rgba(17,24,39,0.10)] flex flex-col gap-4">
          <div>
            <h1 className="text-[24px] font-extrabold text-[#191817] tracking-[-0.02em]">
              {t("register.title")}
            </h1>
            <p className="text-[13px] text-[#8A867E] mt-1">
              {t("register.subtitle")}
            </p>
          </div>

          {/* Google Sign Up Button */}
          <GoogleButton
            label={t("google.continue")}
            loadingLabel={t("google.opening")}
            disabled={loading}
            onSuccess={async (idToken) => {
              setLoading(true);
              setError(null);
              try {
                const res = await fetch(`${API_BASE_URL}/auth/google`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ idToken, locale }),
                  credentials: "include",
                });
                const json = await res.json();
                if (!res.ok || json.error) {
                  throw new Error(localizeApiError(json.error?.code, json.error?.message ?? "") || t("register.googleFailed"));
                }
                if (json.data?.accessToken) {
                  saveAuthToken(json.data.accessToken);
                }
                applyAccountLocale(json.data?.user?.locale);
                window.location.href = "/home";
              } catch (err) {
                setError(err instanceof Error ? err.message : t("register.googleFailed"));
              } finally {
                setLoading(false);
              }
            }}
            onError={(reason) => setError(t(`google.${reason}`))}
          />

          {/* Divider */}
          <div className="flex items-center gap-3 text-[#A8A49C] text-[11px]">
            <div className="flex-1 h-[1px] bg-[#E4E1DC]" />
            {t("register.or")}
            <div className="flex-1 h-[1px] bg-[#E4E1DC]" />
          </div>

          {/* Error Alert */}
          {error && (
            <div className="p-3 rounded-[10px] bg-[#FDEDED] border border-[#F2CACA] text-[12px] text-[#8A4141] flex items-center gap-2">
              <span className="material-symbols-outlined text-[16px] shrink-0">error</span>
              <span>{error}</span>
            </div>
          )}

          {/* Form */}
          <form className="flex flex-col gap-3.5" onSubmit={handleRegister}>
            {/* Full Name */}
            <div className="flex flex-col gap-1">
              <label className="text-[12px] font-bold text-[#4B4842]" htmlFor="name">
                {t("register.name")}
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("register.namePlaceholder")}
                className="w-full px-3.5 py-2.5 rounded-[8px] border-[1.5px] border-[#E4E1DC] focus:border-[#4F46E5] focus:ring-1 focus:ring-[#4F46E5] outline-none transition-all text-[#191817] bg-[#FAF9F7] text-[13.5px]"
              />
            </div>

            {/* Email */}
            <div className="flex flex-col gap-1">
              <label className="text-[12px] font-bold text-[#4B4842]" htmlFor="email">
                {t("common.email")}
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t("common.emailPlaceholder")}
                className="w-full px-3.5 py-2.5 rounded-[8px] border-[1.5px] border-[#E4E1DC] focus:border-[#4F46E5] focus:ring-1 focus:ring-[#4F46E5] outline-none transition-all text-[#191817] bg-[#FAF9F7] text-[13.5px]"
              />
            </div>

            {/* Password */}
            <div className="flex flex-col gap-1">
              <label className="text-[12px] font-bold text-[#4B4842]" htmlFor="password">
                {t("register.password")}
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

              {/* Password Strength Indicator (A2 Design) */}
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

            {/* Confirm Password */}
            <div className="flex flex-col gap-1">
              <label className="text-[12px] font-bold text-[#4B4842]" htmlFor="confirmPassword">
                {t("register.confirmPassword")}
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

            {/* Submit CTA */}
            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-3.5 px-4 rounded-[10px] btn-gradient-primary text-white text-[13.5px] font-bold flex justify-center items-center gap-2 cursor-pointer disabled:opacity-60"
            >
              {loading ? (
                <>
                  <span className="w-3.5 h-3.5 rounded-full border-2 border-white/40 border-t-white ff-spinner shrink-0" />
                  {t("register.submitting")}
                </>
              ) : (
                <>
                  {t("register.submit")}
                </>
              )}
            </button>
          </form>

          {/* Footer */}
          <div className="text-center text-[12px] text-[#8A867E] pt-1">
            {t("register.haveAccount")}{" "}
            <Link href="/login" className="text-[#4F46E5] font-bold hover:underline">
              {t("register.login")}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
