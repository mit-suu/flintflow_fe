"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { fetchCheckout, formatVnd, type PaymentIntentDTO } from "../../../../lib/api/billing";
import { emitNotificationsChanged } from "../../../../lib/api/notifications";

// Guide payment_service: poll 3-5s, dừng sau 10-15 phút
const POLL_MS = 4_000;
const POLL_TIMEOUT_MS = 15 * 60 * 1000;

function CenteredCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex-1 overflow-y-auto flex items-center justify-center p-6 bg-[#F5F3F0]">
      <div className="w-full max-w-[460px] bg-white border border-[#ECEAE5] rounded-[20px] p-7 flex flex-col gap-4">
        {children}
      </div>
    </div>
  );
}

const BackLink = () => (
  <Link href="/home/billing" className="text-[12.5px] font-bold text-[#4F46E5] hover:underline">
    ← Quay lại trang thanh toán
  </Link>
);

function Checkout({ intentId }: { intentId: string }) {
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
        setError(err instanceof Error ? err.message : "Không thể tải giao dịch");
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
        <div className="text-center text-[13px] text-[#A8A49C]">Đang tải giao dịch…</div>
      </CenteredCard>
    );
  }

  if (!detail) {
    return (
      <CenteredCard>
        <div className="text-[13.5px] text-[#8A4141]">{error ?? "Không tìm thấy giao dịch"}</div>
        <BackLink />
      </CenteredCard>
    );
  }

  return (
    <CenteredCard>
      <div>
        <div className="text-[12.5px] text-[#8A867E]">Số tiền cần chuyển</div>
        <div className="text-[30px] font-extrabold text-[#191817]">{formatVnd(detail.amount)}</div>
        <div className="text-[13px] text-[#6B6862]">Nhận {detail.credits.toLocaleString("vi-VN")} credit</div>
      </div>

      {detail.status === "succeeded" ? (
        <div className="px-3.5 py-3 rounded-[10px] text-[13px] font-semibold bg-[#E9F6EE] text-[#2F7A4F] border border-[#CBE8D6]">
          Thanh toán thành công — đã cộng {detail.credits.toLocaleString("vi-VN")} credit vào tài khoản.
        </div>
      ) : detail.status === "failed" ? (
        <div className="px-3.5 py-3 rounded-[10px] text-[13px] font-semibold bg-[#FDEDED] text-[#8A4141] border border-[#F2CACA]">
          Giao dịch không thành công. Vui lòng tạo giao dịch mới.
        </div>
      ) : (
        <>
          {detail.qrCodeUrl && (
            <div className="self-center p-3 bg-white border border-[#ECEAE5] rounded-[14px]">
              {/* Ảnh VietQR từ domain ngoài, không qua next/image optimizer */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={detail.qrCodeUrl} alt="Mã VietQR thanh toán" className="w-[240px] h-[240px] object-contain" />
            </div>
          )}

          {detail.paymentDescription && (
            <div className="flex flex-col gap-1">
              <div className="text-[12px] text-[#8A867E]">Nội dung chuyển khoản (bắt buộc, nhập đúng)</div>
              <div className="flex items-center gap-2 bg-[#FAF9F7] border border-[#E4E1DC] rounded-[10px] px-3.5 py-2.5">
                <span className="flex-1 font-mono text-[15px] font-bold text-[#191817] tracking-wide">
                  {detail.paymentDescription}
                </span>
                <button
                  type="button"
                  onClick={copyDescription}
                  className="text-[12px] font-bold text-[#4F46E5] hover:underline cursor-pointer"
                >
                  {copied ? "Đã chép" : "Sao chép"}
                </button>
              </div>
            </div>
          )}

          <div className="text-[12px] text-[#6B6862] leading-[1.55]">
            Quét mã bằng ứng dụng ngân hàng, chuyển đúng số tiền và nội dung. Trang sẽ tự cập nhật khi giao dịch
            được xác nhận.
          </div>

          {timedOut ? (
            <div className="flex items-center gap-3 bg-[#FFF6E5] border border-[#F2DDB0] text-[#7A5A12] px-3.5 py-2.5 rounded-[10px] text-[12px]">
              <span className="flex-1">Đã dừng tự kiểm tra. Nếu bạn đã chuyển khoản, bấm kiểm tra lại.</span>
              <button type="button" onClick={resumePolling} className="font-bold hover:underline cursor-pointer">
                Kiểm tra lại
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-[12px] text-[#A8A49C]">
              <span className="w-3.5 h-3.5 rounded-full border-2 border-[#E4E1DC] border-t-[#4F46E5] ff-spinner shrink-0" />
              Đang chờ xác nhận thanh toán…
            </div>
          )}
        </>
      )}

      {error && (
        <div className="bg-[#FDEDED] border border-[#F2CACA] text-[#8A4141] px-3.5 py-2.5 rounded-[10px] text-[12px]">
          {error}
        </div>
      )}

      <BackLink />
    </CenteredCard>
  );
}

function CheckoutFromQuery() {
  const intentId = useSearchParams().get("intentId");

  if (!intentId) {
    return (
      <CenteredCard>
        <div className="text-[13.5px] text-[#8A4141]">Thiếu mã giao dịch (intentId).</div>
        <BackLink />
      </CenteredCard>
    );
  }

  // key: đổi intentId thì dựng lại state từ đầu
  return <Checkout key={intentId} intentId={intentId} />;
}

export default function CheckoutPage() {
  return (
    <Suspense
      fallback={
        <CenteredCard>
          <div className="text-center text-[13px] text-[#A8A49C]">Đang tải…</div>
        </CenteredCard>
      }
    >
      <CheckoutFromQuery />
    </Suspense>
  );
}
