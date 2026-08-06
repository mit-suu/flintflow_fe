"use client";

import { Suspense, useState, useEffect, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import Logo from "../../../components/Logo";
import { saveAuthToken } from "../../../lib/auth";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api/v1";

type VerifyStatus = "loading" | "success" | "error";

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
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
          throw new Error(json.error?.message || "Xác thực thất bại");
        }

        const userRole = json.data?.user?.role || json.data?.role;
        if (json.data?.accessToken) {
          saveAuthToken(json.data.accessToken, userRole);
        }

        setStatus("success");
      } catch (err) {
        setStatus("error");
        setErrorMessage(err instanceof Error ? err.message : "Đã có lỗi xảy ra");
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
      <div className="w-full max-w-[400px] flex flex-col items-center">
        <div className="mb-4 text-center">
          <Logo sizeClassName="w-20 h-20" />
        </div>

        <div className="w-full bg-surface-container-lowest rounded-xl p-6 card-elevated border border-surface-container text-center">
          <div className="mb-4 inline-flex items-center justify-center w-16 h-16 rounded-full bg-error-container text-error">
            <span className="material-symbols-outlined text-[32px]">
              error
            </span>
          </div>
          <h1 className="text-xl font-bold text-on-surface mb-2">
            Liên kết không hợp lệ
          </h1>
          <p className="text-xs text-secondary mb-6">
            Link xác thực thiếu token hoặc không đúng định dạng.
          </p>
          <Link
            href="/login"
            className="inline-flex items-center justify-center gap-1.5 w-full h-10 rounded-lg bg-surface-container hover:bg-surface-container-high text-xs font-medium text-on-surface border border-surface-container transition-all btn-press"
          >
            <span className="material-symbols-outlined text-lg">
              arrow_back
            </span>
            Về trang Đăng nhập
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-[400px] flex flex-col items-center">
      {/* Logo */}
      <div className="mb-4 text-center">
        <Logo sizeClassName="w-36 h-36" />
      </div>

      <div className="w-full bg-surface-container-lowest rounded-xl p-6 card-elevated border border-surface-container text-center">
        {/* Step Indicator */}
        <div className="flex items-center justify-center gap-3 mb-6">
          <div className="flex items-center gap-1.5">
            <div className="w-5 h-5 rounded-full bg-primary-container text-white flex items-center justify-center text-[11px] font-semibold">
              <span className="material-symbols-outlined text-[12px]">
                check
              </span>
            </div>
            <span className="text-xs font-semibold text-on-surface">
              Xác nhận email
            </span>
          </div>
          <div className="w-8 h-px bg-primary-container" />
          <div className="flex items-center gap-1.5">
            <div
              className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-semibold ${
                status === "success"
                  ? "bg-primary-container text-white"
                  : "bg-surface-container text-secondary"
              }`}
            >
              2
            </div>
            <span
              className={`text-xs ${
                status === "success"
                  ? "font-semibold text-on-surface"
                  : "text-secondary"
              }`}
            >
              Hoàn tất đăng ký
            </span>
          </div>
        </div>

        {/* Loading State */}
        {status === "loading" && (
          <>
            <div className="mb-4 inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary-fixed text-primary">
              <span className="material-symbols-outlined text-[32px] ff-spinner">
                progress_activity
              </span>
            </div>
            <h1 className="text-xl font-bold text-on-surface mb-2">
              Đang xác thực email...
            </h1>
            <p className="text-xs text-secondary">
              Vui lòng đợi trong giây lát.
            </p>
          </>
        )}

        {/* Success State */}
        {status === "success" && (
          <>
            <div className="mb-4 inline-flex items-center justify-center w-16 h-16 rounded-full bg-[#d4edda] text-[#155724]">
              <span className="material-symbols-outlined text-[32px]">
                check_circle
              </span>
            </div>
            <h1 className="text-xl font-bold text-on-surface tracking-tight mb-2">
              Xác thực thành công!
            </h1>
            <p className="text-xs text-secondary mb-6 leading-relaxed">
              Tài khoản của bạn đã được kích hoạt và đăng nhập tự động.
              <br />
              Đang chuyển hướng trong{" "}
              <strong className="text-on-surface">{countdown}s</strong>...
            </p>
            <button
              onClick={() => router.push("/home")}
              className="w-full h-10 bg-primary-container text-white font-medium text-xs rounded-lg shadow-sm transition-all hover:brightness-90 btn-press flex items-center justify-center gap-1.5"
            >
              <span className="material-symbols-outlined text-lg">
                rocket_launch
              </span>
              Vào ứng dụng ngay
            </button>
          </>
        )}

        {/* Error State */}
        {status === "error" && (
          <>
            <div className="mb-4 inline-flex items-center justify-center w-16 h-16 rounded-full bg-error-container text-error">
              <span className="material-symbols-outlined text-[32px]">
                error
              </span>
            </div>
            <h1 className="text-xl font-bold text-on-surface mb-2">
              Xác thực thất bại
            </h1>
            <p className="text-xs text-secondary mb-5 leading-relaxed">
              {errorMessage}
            </p>

            <div className="pt-4 border-t border-surface-container space-y-2.5">
              <p className="text-[11px] text-secondary">
                Link có thể đã hết hạn (24h) hoặc đã được sử dụng. Hãy đăng
                nhập lại để yêu cầu gửi email mới.
              </p>
              <Link
                href="/login"
                className="w-full h-10 rounded-lg bg-surface-container hover:bg-surface-container-high text-xs font-medium text-on-surface border border-surface-container-high transition-all btn-press flex items-center justify-center gap-1.5"
              >
                <span className="material-symbols-outlined text-lg">
                  arrow_back
                </span>
                Về trang Đăng nhập
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <main className="flex-grow flex items-center justify-center px-4 py-8">
      <Suspense
        fallback={
          <div className="w-full max-w-[400px] bg-surface-container-lowest rounded-xl p-6 card-elevated border border-surface-container text-center text-xs text-secondary">
            Đang tải...
          </div>
        }
      >
        <VerifyEmailContent />
      </Suspense>
    </main>
  );
}
