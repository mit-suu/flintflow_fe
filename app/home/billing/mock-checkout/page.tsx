"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  fetchCheckout,
  formatVnd,
  submitMockPayment,
  type CheckoutDetail,
  type MockPaymentResult,
  type MockWebhookResult,
} from "../../../../lib/api/billing";
import { emitNotificationsChanged } from "../../../../lib/api/notifications";

function CenteredCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex-1 overflow-y-auto flex items-center justify-center p-6 bg-[#F5F3F0]">
      <div className="w-full max-w-[440px] bg-white border border-[#ECEAE5] rounded-[20px] p-7 flex flex-col gap-4">
        {children}
      </div>
    </div>
  );
}

function MockCheckout({ intentId }: { intentId: string }) {
  const [detail, setDetail] = useState<CheckoutDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState<MockPaymentResult | null>(null);
  const [result, setResult] = useState<MockWebhookResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const next = await fetchCheckout(intentId);
        if (!cancelled) setDetail(next);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Không thể tải giao dịch");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [intentId]);

  const pay = async (status: MockPaymentResult) => {
    const signature = detail?.mockSignatures?.[status];
    if (!detail || !signature) return;
    setSubmitting(status);
    setError(null);
    try {
      const res = await submitMockPayment(detail.intentId, status, signature);
      setResult(res);
      emitNotificationsChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gửi kết quả thanh toán thất bại");
    } finally {
      setSubmitting(null);
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
        <Link href="/home/billing" className="text-[12.5px] font-bold text-[#4F46E5] hover:underline">
          ← Quay lại trang thanh toán
        </Link>
      </CenteredCard>
    );
  }

  const finalStatus = result?.status ?? detail.status;
  const isDone = finalStatus !== "pending";

  return (
    <CenteredCard>
      <div className="flex items-center gap-2">
        <span className="px-2 py-0.5 rounded-full bg-[#FFF6E5] text-[10.5px] font-extrabold text-[#7A5A12] uppercase tracking-[0.05em]">
          Cổng giả lập
        </span>
        <span className="text-[11.5px] text-[#A8A49C] truncate">#{detail.intentId}</span>
      </div>

      <div>
        <div className="text-[12.5px] text-[#8A867E]">Số tiền thanh toán</div>
        <div className="text-[30px] font-extrabold text-[#191817]">{formatVnd(detail.amount)}</div>
        <div className="text-[13px] text-[#6B6862]">
          Nhận {detail.credits.toLocaleString("vi-VN")} credit
        </div>
      </div>

      {error && (
        <div className="bg-[#FDEDED] border border-[#F2CACA] text-[#8A4141] px-3.5 py-2.5 rounded-[10px] text-[12px]">
          {error}
        </div>
      )}

      {isDone ? (
        <div
          className={`px-3.5 py-3 rounded-[10px] text-[13px] font-semibold ${
            finalStatus === "succeeded"
              ? "bg-[#E9F6EE] text-[#2F7A4F] border border-[#CBE8D6]"
              : "bg-[#FDEDED] text-[#8A4141] border border-[#F2CACA]"
          }`}
        >
          {finalStatus === "succeeded"
            ? result
              ? `Thanh toán thành công — đã cộng ${result.creditsAdded} credit.`
              : "Giao dịch này đã được thanh toán."
            : "Thanh toán thất bại. Bạn chưa bị trừ tiền."}
          {result?.alreadyProcessed && " (Giao dịch đã được xử lý trước đó.)"}
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          <button
            type="button"
            onClick={() => pay("success")}
            disabled={submitting !== null}
            className="py-3 rounded-[10px] btn-gradient-primary text-white text-[13.5px] font-bold disabled:opacity-50 cursor-pointer"
          >
            {submitting === "success" ? "Đang xử lý…" : "Thanh toán thành công"}
          </button>
          <button
            type="button"
            onClick={() => pay("failed")}
            disabled={submitting !== null}
            className="py-3 rounded-[10px] border-[1.5px] border-[#F2CACA] bg-white text-[#B03030] text-[13.5px] font-bold hover:bg-[#FDEDED] disabled:opacity-50 cursor-pointer"
          >
            {submitting === "failed" ? "Đang xử lý…" : "Thanh toán thất bại"}
          </button>
        </div>
      )}

      <Link href="/home/billing" className="text-[12.5px] font-bold text-[#4F46E5] hover:underline">
        ← Quay lại trang thanh toán
      </Link>
    </CenteredCard>
  );
}

function MockCheckoutFromQuery() {
  const intentId = useSearchParams().get("intentId");

  if (!intentId) {
    return (
      <CenteredCard>
        <div className="text-[13.5px] text-[#8A4141]">Thiếu mã giao dịch (intentId).</div>
        <Link href="/home/billing" className="text-[12.5px] font-bold text-[#4F46E5] hover:underline">
          ← Quay lại trang thanh toán
        </Link>
      </CenteredCard>
    );
  }

  // key: đổi intentId thì dựng lại state từ đầu
  return <MockCheckout key={intentId} intentId={intentId} />;
}

export default function MockCheckoutPage() {
  return (
    <Suspense
      fallback={
        <CenteredCard>
          <div className="text-center text-[13px] text-[#A8A49C]">Đang tải…</div>
        </CenteredCard>
      }
    >
      <MockCheckoutFromQuery />
    </Suspense>
  );
}
