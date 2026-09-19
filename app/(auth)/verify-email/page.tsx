"use client";

import { Suspense, useState, useEffect, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import LocaleSwitcher from "@/components/LocaleSwitcher";
import { localizeApiError } from "@/lib/api/error-messages";
import { applyAccountLocale } from "@/lib/i18n";
import Logo from "../../../components/Logo";
import { saveAuthToken } from "../../../lib/auth";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api/v1";

type VerifyStatus = "loading" | "success" | "error";

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const t = useTranslations("auth");
  const token = searchParams.get("token");

  const [status, setStatus] = useState<VerifyStatus>("loading");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [countdown, setCountdown] = useState(3);
  const calledRef = useRef(false);

  useEffect(() => {
    if (!token || calledRef.current) return;
    calledRef.current = true;

    const verify = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/auth/verify-email/confirm`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
          credentials: "include",
        });
        const json = await res.json();

        if (!res.ok || json.error) {
          throw new Error(localizeApiError(json.error?.code, json.error?.message ?? "") || "");
        }

        const userRole = json.data?.user?.role || json.data?.role;
        if (json.data?.accessToken) {
          saveAuthToken(json.data.accessToken, userRole);
        }
        applyAccountLocale(json.data?.user?.locale);

        setStatus("success");
      } catch (err) {
        setStatus("error");
        setErrorMessage(err instanceof Error ? err.message : "");
      }
    };

    verify();
  }, [token]);

  useEffect(() => {
    if (status !== "success") return;
    if (countdown <= 0) {
      router.push("/home");
      return;
    }
    const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
    return () => clearTimeout(timer);
  }, [status, countdown, router]);

  // No token state
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
          {t("verify.invalidBody")}
        </p>
        <Link
          href="/login"
          className="w-full py-3 px-4 rounded-[10px] btn-gradient-primary text-white text-[13px] font-bold text-center"
        >
          {t("verify.toLogin")}
        </Link>
      </div>
    );
  }

  return (
    <div className="bg-white border border-[#E4E1DC] rounded-[18px] p-6 sm:p-7 shadow-[0_8px_32px_rgba(17,24,39,0.10)] text-center flex flex-col gap-4">
      {/* Loading State */}
      {status === "loading" && (
        <div className="flex flex-col items-center gap-3.5 py-4">
          <span className="w-10 h-10 rounded-full border-3 border-[#E4E1DC] border-t-[#4F46E5] ff-spinner shrink-0" />
          <h1 className="text-[20px] font-extrabold text-[#191817]">
            {t("verify.verifying")}
          </h1>
          <p className="text-[13px] text-[#8A867E]">
            {t("verify.wait")}
          </p>
        </div>
      )}

      {/* Success State */}
      {status === "success" && (
        <div className="flex flex-col items-center gap-3.5 py-2">
          <div className="w-12 h-12 rounded-[14px] bg-[#EAF6EE] text-[#1F7A45] flex items-center justify-center text-[22px]">
            ✓
          </div>
          <h1 className="text-[20px] font-extrabold text-[#191817]">
            {t("verify.successTitle")}
          </h1>
          <p className="text-[13px] text-[#8A867E] leading-[1.65]">
            {t("verify.successBody")}
            <br />
            {t.rich("verify.redirecting", {
              seconds: countdown,
              b: (chunks) => <strong className="text-[#191817] font-bold">{chunks}</strong>,
            })}
          </p>
          <button
            onClick={() => router.push("/home")}
            className="w-full py-3.5 px-4 rounded-[10px] btn-gradient-primary text-white text-[13.5px] font-bold cursor-pointer"
          >
            {t("verify.enterApp")}
          </button>
        </div>
      )}

      {/* Error State */}
      {status === "error" && (
        <div className="flex flex-col items-center gap-3.5 py-2">
          <div className="w-12 h-12 rounded-[14px] bg-[#FDEDED] text-[#B03030] flex items-center justify-center text-[22px]">
            ⚠
          </div>
          <h1 className="text-[20px] font-extrabold text-[#191817]">
            {t("verify.failedTitle")}
          </h1>
          <p className="text-[13px] text-[#8A867E] leading-[1.6]">
            {errorMessage || t("verify.failedTitle")}
          </p>
          <p className="text-[11.5px] text-[#A8A49C] bg-[#FAF9F7] p-2.5 rounded-[8px] border border-[#ECEAE5]">
            {t("verify.expiredHint")}
          </p>
          <Link
            href="/login"
            className="w-full py-3 px-4 rounded-[10px] btn-gradient-primary text-white text-[13px] font-bold text-center"
          >
            {t("verify.toLogin")}
          </Link>
        </div>
      )}
    </div>
  );
}

export default function VerifyEmailPage() {
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
          <VerifyEmailContent />
        </Suspense>
      </div>
    </div>
  );
}
