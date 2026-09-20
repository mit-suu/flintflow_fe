"use client";

import { useFormatter, useTranslations } from "next-intl";
import { Suspense, useEffect, useState } from "react";
import UiBackLink from "../../../../components/ui/BackLink";
import { useSearchParams } from "next/navigation";
import { fetchCheckout, formatVnd, type PaymentIntentDTO } from "../../../../lib/api/billing";
import { emitNotificationsChanged } from "../../../../lib/api/notifications";

// Guide payment_service: poll 3-5s, dừng sau 10-15 phút
const POLL_MS = 4_000;
const POLL_TIMEOUT_MS = 15 * 60 * 1000;

function CenteredCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex-1 overflow-y-auto flex items-center justify-center p-6 bg-surface-container-lowest">
      <div className="w-full max-w-[460px] bg-white border border-[#ECEAE5] rounded-card p-7 flex flex-col gap-4">
        {children}
      </div>
    </div>
  );
}

function BackLink() {
  const t = useTranslations("app.checkout");
  return <UiBackLink href="/home/billing">{t("back")}</UiBackLink>;
}

function Checkout({ intentId }: { intentId: string }) {
  const t = useTranslations("app.checkout");
  const format = useFormatter();
  const [detail, setDetail] = useState<PaymentIntentDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timedOut, setTimedOut] = useState(false);
  const [copied, setCopied] = useState(false);
  const [pollRound, setPollRound] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let timer: number | undefined;
    const startedAt = Date.now();

    const tick = async () => {
      try {
        const next = await fetchCheckout(intentId);
        if (cancelled) return;
        setDetail(next);
        setError(null);

        if (next.status === "pending") {
          if (Date.now() - startedAt < POLL_TIMEOUT_MS) {
            timer = window.setTimeout(tick, POLL_MS);
          } else {
            setTimedOut(true);
          }
        } else {
          emitNotificationsChanged();
        }
      } catch (err) {
        if (cancelled) return;
        // Chuỗi rỗng = lỗi tải, dịch lúc render ⇒ `t` không vào dependency (effect này đang poll).
        setError(err instanceof Error ? err.message : "");
        timer = window.setTimeout(tick, POLL_MS);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void tick();
    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [intentId, pollRound]);

  const resumePolling = () => {
    setTimedOut(false);
    setPollRound((n) => n + 1);
  };

  const copyDescription = async () => {
    if (!detail?.paymentDescription) return;
    try {
      await navigator.clipboard.writeText(detail.paymentDescription);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Trình duyệt chặn clipboard: người dùng vẫn đọc được nội dung trên màn hình
    }
  };

  if (loading) {
    return (
      <CenteredCard>
        <div className="text-center text-[13px] text-[#A8A49C]">{t("loading")}</div>
      </CenteredCard>
    );
  }

  if (!detail) {
    return (
      <CenteredCard>
        <div className="text-[13.5px] text-[#8A4141]">{error === null ? t("notFound") : error || t("loadFailed")}</div>
        <BackLink />
      </CenteredCard>
    );
  }

  return (
    <CenteredCard>
      <div>
        <div className="text-[12.5px] text-[#8A867E]">{t("amountToPay")}</div>
        <div className="text-[30px] font-extrabold text-[#191817]">{formatVnd(detail.amount)}</div>
        <div className="text-[13px] text-[#6B6862]">{t("receive", { credits: format.number(detail.credits) })}</div>
      </div>

      {detail.status === "succeeded" ? (
        <div className="px-3.5 py-3 rounded-control text-[13px] font-semibold bg-[#E9F6EE] text-[#2F7A4F] border border-[#CBE8D6]">
          {t("succeeded", { credits: format.number(detail.credits) })}
        </div>
      ) : detail.status === "failed" ? (
        <div className="px-3.5 py-3 rounded-control text-[13px] font-semibold bg-[#FDEDED] text-[#8A4141] border border-[#F2CACA]">
          {t("failed")}
        </div>
      ) : (
        <>
          {detail.qrCodeUrl && (
            <div className="self-center p-3 bg-white border border-[#ECEAE5] rounded-card">
              {/* Ảnh VietQR từ domain ngoài, không qua next/image optimizer */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={detail.qrCodeUrl} alt={t("qrAlt")} className="w-[240px] h-[240px] object-contain" />
            </div>
          )}

          {detail.paymentDescription && (
            <div className="flex flex-col gap-1">
              <div className="text-[12px] text-[#8A867E]">{t("description")}</div>
              <div className="flex items-center gap-2 bg-[#FAF9F7] border border-[#E4E1DC] rounded-control px-3.5 py-2.5">
                <span className="flex-1 font-mono text-[15px] font-bold text-[#191817] tracking-wide">
                  {detail.paymentDescription}
                </span>
                <button
                  type="button"
                  onClick={copyDescription}
                  className="text-[12px] font-bold text-[#6A62C4] hover:underline cursor-pointer"
                >
                  {copied ? t("copied") : t("copy")}
                </button>
              </div>
            </div>
          )}

          <div className="text-[12px] text-[#6B6862] leading-[1.55]">
            {t("instructions")}
          </div>

          {timedOut ? (
            <div className="flex items-center gap-3 bg-[#FFF6E5] border border-[#F2DDB0] text-[#7A5A12] px-3.5 py-2.5 rounded-control text-[12px]">
              <span className="flex-1">{t("stopped")}</span>
              <button type="button" onClick={resumePolling} className="font-bold hover:underline cursor-pointer">
                {t("recheck")}
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-[12px] text-[#A8A49C]">
              <span className="w-3.5 h-3.5 rounded-full border-2 border-[#E4E1DC] border-t-[#6A62C4] ff-spinner shrink-0" />
              {t("waiting")}
            </div>
          )}
        </>
      )}

      {error !== null && (
        <div className="bg-[#FDEDED] border border-[#F2CACA] text-[#8A4141] px-3.5 py-2.5 rounded-control text-[12px]">
          {error || t("loadFailed")}
        </div>
      )}

      <BackLink />
    </CenteredCard>
  );
}

function CheckoutFromQuery() {
  const t = useTranslations("app.checkout");
  const intentId = useSearchParams().get("intentId");

  if (!intentId) {
    return (
      <CenteredCard>
        <div className="text-[13.5px] text-[#8A4141]">{t("missingIntent")}</div>
        <BackLink />
      </CenteredCard>
    );
  }

  // key: đổi intentId thì dựng lại state từ đầu
  return <Checkout key={intentId} intentId={intentId} />;
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={<CheckoutFallback />}>
      <CheckoutFromQuery />
    </Suspense>
  );
}

/** Fallback của Suspense — component riêng để dùng được `useTranslations`. */
function CheckoutFallback() {
  const tc = useTranslations("app.common");
  return (
    <CenteredCard>
      <div className="text-center text-[13px] text-[#A8A49C]">{tc("loading")}</div>
    </CenteredCard>
  );
}
