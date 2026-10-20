"use client";

import { useFormatter, useTranslations } from "next-intl";
import { Suspense, useEffect, useState } from "react";
import TopBar from "@/components/layout/TopBar";
import { BackLink as UiBackLink, Skeleton } from "@/components/ui";
import { useSearchParams } from "next/navigation";
import { fetchCheckout, formatVnd, type PaymentIntentDTO } from "../../../../lib/api/billing";
import { emitNotificationsChanged } from "../../../../lib/api/notifications";
import { userErrorMessage } from "@/lib/api/error-messages";

// Guide payment_service: poll 3-5s, dừng sau 10-15 phút
const POLL_MS = 4_000;
const POLL_TIMEOUT_MS = 15 * 60 * 1000;

/** Khung chung của mọi trạng thái trang: thanh trên như các trang `/home/*` khác, rồi một thẻ giữa màn. */
function CenteredCard({ children }: { children: React.ReactNode }) {
  const t = useTranslations("app.checkout");
  const tc = useTranslations("app.common");
  const tBilling = useTranslations("app.billing");
  return (
    <>
      <TopBar trail={[tc("account"), tBilling("title"), t("title")]} />

      <div className="flex-1 overflow-y-auto flex items-center justify-center p-6 bg-surface-container-lowest">
        <div className="w-full max-w-[460px] rounded-card bg-surface-container-low p-7 flex flex-col gap-4">{children}</div>
      </div>
    </>
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
        setError(userErrorMessage(err));
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
        <div className="flex flex-col gap-3" role="status" aria-busy="true" aria-label={t("loading")}>
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-4/5" />
          <Skeleton className="h-9 w-full" />
        </div>
      </CenteredCard>
    );
  }

  if (!detail) {
    return (
      <CenteredCard>
        <div className="text-body text-on-error-container">{error === null ? t("notFound") : error || t("loadFailed")}</div>
        <BackLink />
      </CenteredCard>
    );
  }

  return (
    <CenteredCard>
      <div>
        <div className="text-body text-on-surface-muted">{t("amountToPay")}</div>
        <div className="text-metric font-bold text-on-surface">{formatVnd(detail.amount)}</div>
        <div className="text-body text-on-surface-variant">{t("receive", { credits: format.number(detail.credits) })}</div>
      </div>

      {detail.status === "succeeded" ? (
        <div className="px-3.5 py-3 rounded-control text-body font-semibold bg-success-soft text-success">
          {t("succeeded", { credits: format.number(detail.credits) })}
        </div>
      ) : detail.status === "failed" ? (
        <div className="px-3.5 py-3 rounded-control text-body font-semibold bg-error-container text-on-error-container">
          {t("failed")}
        </div>
      ) : (
        <>
          {detail.qrCodeUrl && (
            <div className="self-center p-3 bg-surface-container-lowest rounded-card">
              {/* Ảnh VietQR từ domain ngoài, không qua next/image optimizer */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={detail.qrCodeUrl} alt={t("qrAlt")} className="w-[240px] h-[240px] object-contain" />
            </div>
          )}

          {detail.paymentDescription && (
            <div className="flex flex-col gap-1">
              <div className="text-body text-on-surface-muted">{t("description")}</div>
              <div className="flex items-center gap-2 bg-surface-container-low rounded-control px-3.5 py-2.5">
                <span className="flex-1 font-mono text-heading font-bold text-on-surface tracking-wide">
                  {detail.paymentDescription}
                </span>
                <button
                  type="button"
                  onClick={copyDescription}
                  className="text-body font-bold text-primary hover:underline cursor-pointer"
                >
                  {copied ? t("copied") : t("copy")}
                </button>
              </div>
            </div>
          )}

          <div className="text-body text-on-surface-variant leading-[1.55]">
            {t("instructions")}
          </div>

          {timedOut ? (
            <div className="flex items-center gap-3 bg-accent-gold-soft text-accent-gold-text px-3.5 py-2.5 rounded-control text-body">
              <span className="flex-1">{t("stopped")}</span>
              <button type="button" onClick={resumePolling} className="font-bold hover:underline cursor-pointer">
                {t("recheck")}
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-body text-on-surface-subtle">
              <span className="w-3.5 h-3.5 rounded-full border-2 border-outline border-t-primary ff-spinner shrink-0" />
              {t("waiting")}
            </div>
          )}
        </>
      )}

      {error !== null && (
        <div className="bg-error-container text-on-error-container px-3.5 py-2.5 rounded-control text-body">
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
        <div className="text-body text-on-error-container">{t("missingIntent")}</div>
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
      <div className="text-center text-body text-on-surface-subtle">{tc("loading")}</div>
    </CenteredCard>
  );
}
