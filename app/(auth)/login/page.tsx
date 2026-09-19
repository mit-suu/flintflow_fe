"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { localizeApiError } from "@/lib/api/error-messages";
import { applyAccountLocale } from "@/lib/i18n";
import LocaleSwitcher from "@/components/LocaleSwitcher";
import GoogleButton from "../../../components/GoogleButton";
import Logo from "../../../components/Logo";
import { saveAuthToken } from "../../../lib/auth";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api/v1";

export default function LoginPage() {
  const router = useRouter();
  const t = useTranslations("auth");
  const locale = useLocale();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isUnverified, setIsUnverified] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);
  const [resending, setResending] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setIsUnverified(false);
    setResendSuccess(false);

    try {
      const res = await fetch(`${API_BASE_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
        credentials: "include",
      });

      const json = await res.json();

      if (!res.ok || json.error) {
        if (json.error?.code === "EMAIL_NOT_VERIFIED") {
          setIsUnverified(true);
        }
        throw new Error(localizeApiError(json.error?.code, json.error?.message ?? "") || t("login.failed"));
      }

      const userRole = json.data?.user?.role || json.data?.role;
      if (json.data?.accessToken) {
        saveAuthToken(json.data.accessToken, userRole);
      }
      // Ngôn ngữ đã lưu trong tài khoản thắng lựa chọn tạm trên trang đăng nhập (trang sau tải lại hẳn).
      applyAccountLocale(json.data?.user?.locale);

      if (userRole === "admin") {
        window.location.href = "/admin/metrics";
      } else {
        window.location.href = "/home";
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t("common.genericError"));
    } finally {
      setLoading(false);
    }
  };

  const handleResendVerify = async () => {
    setResending(true);
    try {
      const res = await fetch(`${API_BASE_URL}/auth/verify-email/resend`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (res.ok) {
        setResendSuccess(true);
      }
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-screen">
      {/* Top Header */}
      <header className="px-6 sm:px-10 py-5 flex items-center justify-between z-20">
        <Logo sizeClassName="w-7 h-7" theme="light" href="/" />
        <div className="flex items-center gap-4">
          <LocaleSwitcher tone="light" />
          <Link href="/#pricing" className="text-[12px] text-[#6B6862] hover:text-[#191817] font-semibold transition-colors">
            {t("login.navPricing")}
          </Link>
          <Link href="/#docs" className="text-[12px] text-[#6B6862] hover:text-[#191817] font-semibold transition-colors">
            {t("login.navDocs")}
          </Link>
          <Link
            href="/register"
            className="px-3.5 py-1.5 rounded-full border-[1.5px] border-[#E4E1DC] hover:border-[#DDD9F6] text-[#191817] text-[12px] font-bold bg-white transition-all shadow-sm"
          >
            {t("login.signUpFree")}
          </Link>
        </div>
      </header>

      {/* Main Body */}
      <main className="flex-1 flex items-center justify-center px-4 sm:px-8 py-8 z-10">
        <div className="w-full max-w-[1080px] grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center justify-between">
          
          {/* Left Hero (A1 Design) */}
          <div className="lg:col-span-6 flex flex-col gap-5 lg:pr-4">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#F4F3FE] border border-[#DDD9F6] text-[#4F46E5] text-[12px] font-bold self-start">
              ✦ AI Business Analyst
            </div>
            <h1 className="text-[38px] sm:text-[48px] lg:text-[50px] font-extrabold leading-[1.06] tracking-[-0.03em] text-[#191817]">
              {t("login.headlineLine1")}<br />
              <span className="text-gradient">{t("login.headlineAccent")}</span><br />
              {t("login.headlineLine2")}
            </h1>
            <p className="text-[14px] text-[#6B6862] leading-[1.65] max-w-[420px]">
              {t("login.subline")}
            </p>

            {/* Floating Preview Cards */}
            <div className="hidden sm:flex flex-col gap-3 pt-2 max-w-[380px]">
              {/* Card 1 */}
              <div className="bg-white border border-[#ECEAE5] rounded-[15px] p-3 px-4 flex items-center gap-2.5 shadow-[0_12px_30px_rgba(25,24,23,0.10)] -rotate-[1.4deg] transition-transform hover:rotate-0">
                <div className="w-6 h-6 rounded-[8px] bg-gradient-to-br from-[#7C74F0] to-[#4F46E5] text-white text-[11px] font-extrabold flex items-center justify-center shrink-0">
                  F
                </div>
                <div className="text-[12.5px] text-[#33312D]">
                  {t("login.cardQuestion")} <span className="text-[#8A85C8] text-[11px]">· clarifying</span>
                </div>
              </div>

              {/* Card 2 */}
              <div className="bg-white border border-[#ECEAE5] rounded-[15px] p-3 px-4 flex items-center gap-2.5 shadow-[0_12px_30px_rgba(25,24,23,0.10)] rotate-[1deg] translate-x-4 transition-transform hover:rotate-0">
                <span className="w-2.5 h-2.5 rounded-full bg-[radial-gradient(circle_at_35%_30%,#7BD89E,#2FA45C)] shadow-[0_0_12px_rgba(47,164,92,0.8)] shrink-0" />
                <div className="text-[12.5px] text-[#33312D] font-semibold">
                  {t("login.cardPhaseReady")}
                </div>
              </div>

              {/* Card 3 */}
              <div className="bg-white border border-[#ECEAE5] rounded-[15px] p-3 px-4 flex items-center gap-2.5 shadow-[0_12px_30px_rgba(25,24,23,0.10)] -rotate-[0.8deg] translate-x-2 transition-transform hover:rotate-0">
                <span className="px-2 py-0.5 rounded-full bg-[#FBF4E4] text-[#8A6D1F] text-[10px] font-extrabold tracking-wider">
                  ASSUMPTION
                </span>
                <div className="text-[12.5px] text-[#33312D]">
                  {t("login.cardAssumptions", { count: 2 })}
                </div>
              </div>
            </div>
          </div>

          {/* Right Form Card (A1 Design) */}
          <div className="lg:col-span-6 flex justify-center lg:justify-end">
            <div className="w-full max-w-[404px] bg-white border border-[#ECEAE5] rounded-[24px] p-7 sm:p-8 custom-shadow-card flex flex-col gap-4">
              <div>
                <h2 className="text-[22px] font-extrabold text-[#191817] tracking-[-0.01em]">
                  {t("login.title")}
                </h2>
                <div className="text-[13px] text-[#8A867E] mt-1">
                  {t("login.noAccount")}{" "}
                  <Link href="/register" className="text-[#4F46E5] hover:underline font-bold">
                    {t("login.signUpFree")}
                  </Link>
                </div>
              </div>

              {/* Google OAuth Button */}
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
                      throw new Error(localizeApiError(json.error?.code, json.error?.message ?? "") || t("login.googleFailed"));
                    }
                    const userRole = json.data?.user?.role || json.data?.role;
                    if (json.data?.accessToken) {
                      saveAuthToken(json.data.accessToken, userRole);
                    }
                    applyAccountLocale(json.data?.user?.locale);
                    if (userRole === "admin") {
                      window.location.href = "/admin/metrics";
                    } else {
                      window.location.href = "/home";
                    }
                  } catch (err) {
                    setError(err instanceof Error ? err.message : t("login.googleFailed"));
                  } finally {
                    setLoading(false);
                  }
                }}
                onError={(reason) => setError(t(`google.${reason}`))}
              />

              {/* Divider */}
              <div className="flex items-center gap-3 text-[#A8A49C] text-[11px]">
                <div className="flex-1 h-[1px] bg-[#E4E1DC]" />
                {t("login.orEmail")}
                <div className="flex-1 h-[1px] bg-[#E4E1DC]" />
              </div>

              {/* Error Alert */}
              {error && (
                <div className="p-3 rounded-[10px] bg-[#FDEDED] border border-[#F2CACA] text-[12px] text-[#8A4141] flex items-center gap-2">
                  <span className="material-symbols-outlined text-[16px] shrink-0">error</span>
                  <span>{error}</span>
                </div>
              )}

              {/* Unverified Alert */}
              {isUnverified && (
                <div className="p-3.5 rounded-[12px] bg-[#FBF4E4] border border-[#F0DFB4] text-[12px] text-[#8A6D1F] flex flex-col gap-2">
                  <div>
                    <strong>{t("login.unverifiedTitle")}</strong> {t("login.unverifiedBody")}
                  </div>
                  {resendSuccess ? (
                    <div className="text-[#1F7A45] font-bold">
                      {t("common.resendVerifySuccess")}
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={handleResendVerify}
                      disabled={resending}
                      className="self-start px-3 py-1 bg-[#4F46E5] hover:bg-[#3B34B0] text-white rounded-[8px] text-[11.5px] font-bold transition disabled:opacity-50"
                    >
                      {resending ? t("common.sending") : t("login.resendVerify")}
                    </button>
                  )}
                </div>
              )}

              {/* Form */}
              <form className="flex flex-col gap-3.5" onSubmit={handleLogin}>
                {/* Email Input */}
                <div className="flex flex-col gap-1">
                  <input
                    id="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={t("common.emailPlaceholder")}
                    className="w-full px-3.5 py-3 rounded-[12px] border-[1.5px] border-[#E4E1DC] focus:border-[#4F46E5] focus:ring-1 focus:ring-[#4F46E5] outline-none transition-all text-[#191817] bg-[#FAF9F7] text-[13px]"
                  />
                </div>

                {/* Password Input */}
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••"
                    className="w-full px-3.5 py-3 pr-10 rounded-[12px] border-[1.5px] border-[#E4E1DC] focus:border-[#4F46E5] focus:ring-1 focus:ring-[#4F46E5] outline-none transition-all text-[#191817] bg-[#FAF9F7] text-[13px]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-3 text-[#A8A49C] hover:text-[#191817] transition-colors"
                  >
                    <span className="material-symbols-outlined text-[18px]">
                      {showPassword ? "visibility_off" : "visibility"}
                    </span>
                  </button>
                </div>

                {/* Submit CTA */}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full mt-1 py-3.5 px-4 rounded-[12px] btn-gradient-primary text-white text-[13.5px] font-bold flex justify-center items-center gap-2 cursor-pointer disabled:opacity-60"
                >
                  {loading ? (
                    <>
                      <span className="w-3.5 h-3.5 rounded-full border-2 border-white/40 border-t-white ff-spinner shrink-0" />
                      {t("login.submitting")}
                    </>
                  ) : (
                    <>
                      {t("login.submit")}
                    </>
                  )}
                </button>
              </form>

              {/* Bottom links */}
              <div className="flex justify-between items-center pt-1">
                <Link href="/forgot-password" className="text-[12px] text-[#4F46E5] hover:underline font-semibold">
                  {t("login.forgot")}
                </Link>
                <div className="text-[11px] text-[#A8A49C]">
                  {t("login.resume")}
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="px-6 py-4 text-center text-[11px] text-[#A8A49C] z-10 font-mono">
        auth-first · FR01 · FlintFlow
      </footer>
    </div>
  );
}
