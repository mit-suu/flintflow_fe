"use client";

import { useState } from "react";
import Modal from "@/components/ui/Modal";
import { ApiClientError } from "@/lib/api/client";
import { userErrorMessage } from "@/lib/api/error-messages";
import {
  adjustAdminOrgCredits,
  formatNumber,
  type AdjustOrgCreditsResult,
  type AdminOrg,
} from "@/lib/api/admin";
import { ErrorBanner, inputClass } from "../../_components/AdminPage";

const REASON_MIN_LENGTH = 3;
const REASON_MAX_LENGTH = 500;

type Direction = "add" | "subtract";

interface AdjustCreditsDialogProps {
  org: AdminOrg | null;
  onClose: () => void;
  onAdjusted: (result: AdjustOrgCreditsResult) => void;
}

/**
 * UC-68 — cộng hoặc trừ credit trong ví tổ chức, bắt buộc lý do. Chỉ trừ được trong phần khả dụng
 * (số dư − đang giữ); BE vẫn là nơi kiểm cuối (409 `INSUFFICIENT_CREDIT`).
 */
export default function AdjustCreditsDialog({ org, onClose, onAdjusted }: AdjustCreditsDialogProps) {
  const [direction, setDirection] = useState<Direction>("add");
  const [amountInput, setAmountInput] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const balance = org?.wallet?.balance ?? 0;
  const reserved = org?.wallet?.reserved ?? 0;
  const available = balance - reserved;

  const amount = /^\d+$/.test(amountInput.trim()) ? Number(amountInput.trim()) : NaN;
  const amountValid = Number.isInteger(amount) && amount > 0;
  const exceedsAvailable = direction === "subtract" && amountValid && amount > available;
  const reasonTooShort = reason.trim().length < REASON_MIN_LENGTH;
  const signed = direction === "add" ? amount : -amount;

  const reset = () => {
    setDirection("add");
    setAmountInput("");
    setReason("");
    setError(null);
  };

  const close = () => {
    if (saving) return;
    reset();
    onClose();
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!org || !amountValid || exceedsAvailable || reasonTooShort) return;
    setSaving(true);
    setError(null);
    try {
      const result = await adjustAdminOrgCredits(org.id, { amount: signed, reason: reason.trim() });
      onAdjusted(result);
      reset();
      onClose();
    } catch (err) {
      // Câu chung của INSUFFICIENT_CREDIT bảo "hãy nạp thêm" — không hợp với admin đang trừ ví người khác
      if (err instanceof ApiClientError && err.code === "INSUFFICIENT_CREDIT") {
        setError("Số dư khả dụng của tổ chức không đủ để trừ. Tải lại danh sách để xem số dư mới nhất.");
      } else {
        setError(userErrorMessage(err, "Không thể điều chỉnh credit"));
      }
    } finally {
      setSaving(false);
    }
  };

  const toggleClass = (active: boolean) =>
    `flex-1 h-9 rounded-[10px] text-[12.5px] font-bold border transition-colors cursor-pointer ${
      active ? "bg-[#191817] text-white border-[#191817]" : "bg-white text-[#6B6862] border-[#E4E1DC] hover:bg-[#FAF9F7]"
    }`;

  return (
    <Modal open={org !== null} onClose={close} title="Điều chỉnh credit">
      {org && (
        <form onSubmit={(e) => void submit(e)} className="flex flex-col gap-4">
          <div className="rounded-[12px] bg-[#FAF9F7] border border-[#ECEAE5] px-4 py-3 text-[12.5px] text-[#33312D]">
            <div className="font-bold text-[#191817]">{org.name}</div>
            <div className="mt-1 text-[#6B6862]">
              {org.wallet ? (
                <>
                  Số dư {formatNumber(balance)} · đang giữ {formatNumber(reserved)} · khả dụng{" "}
                  <span className="font-bold text-[#191817]">{formatNumber(available)}</span>
                </>
              ) : (
                "Tổ chức chưa có ví — ví sẽ được tạo khi điều chỉnh lần đầu."
              )}
            </div>
          </div>

          <div className="flex gap-2" role="group" aria-label="Loại điều chỉnh">
            <button
              type="button"
              aria-pressed={direction === "add"}
              onClick={() => setDirection("add")}
              className={toggleClass(direction === "add")}
            >
              Cộng credit
            </button>
            <button
              type="button"
              aria-pressed={direction === "subtract"}
              onClick={() => setDirection("subtract")}
              className={toggleClass(direction === "subtract")}
            >
              Trừ credit
            </button>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="flex flex-col gap-1.5">
              <span className="text-[12px] font-bold text-[#6B6862]">Số credit</span>
              <input
                type="text"
                inputMode="numeric"
                value={amountInput}
                onChange={(e) => setAmountInput(e.target.value)}
                placeholder="Ví dụ: 100"
                className={inputClass}
                autoFocus
              />
            </label>
            {amountInput.trim() !== "" && !amountValid && (
              <span className="text-[11.5px] text-[#B03030]">Nhập số nguyên dương.</span>
            )}
            {exceedsAvailable && (
              <span className="text-[11.5px] text-[#B03030]">
                Chỉ trừ được tối đa {formatNumber(Math.max(available, 0))} credit (phần khả dụng).
              </span>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="flex flex-col gap-1.5">
              <span className="text-[12px] font-bold text-[#6B6862]">Lý do (bắt buộc)</span>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                maxLength={REASON_MAX_LENGTH}
                rows={3}
                placeholder="Ví dụ: Bù credit do sự cố hệ thống ngày 20/09"
                className="px-3 py-2 rounded-[10px] border border-[#E4E1DC] bg-white text-[12.5px] text-[#191817] focus:outline-none focus:border-[#6A62C4]"
              />
            </label>
            <span className="text-[11px] text-[#A8A49C]">
              Lý do được lưu vào lịch sử giao dịch và gửi kèm thông báo cho Lead của tổ chức.
            </span>
          </div>

          {amountValid && !exceedsAvailable && (
            <p className="text-[12.5px] text-[#33312D]">
              Số dư sau điều chỉnh:{" "}
              <span className="font-bold">{formatNumber(balance + signed)}</span>
            </p>
          )}

          {error && <ErrorBanner message={error} onClose={() => setError(null)} />}

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={close}
              disabled={saving}
              className="h-9 px-4 rounded-[10px] border border-[#E4E1DC] text-[12.5px] font-bold text-[#6B6862] bg-[#FAF9F7] hover:bg-[#F0EEEA] disabled:opacity-60"
            >
              Huỷ
            </button>
            <button
              type="submit"
              disabled={saving || !amountValid || exceedsAvailable || reasonTooShort}
              className={`h-9 px-4 rounded-[10px] text-white text-[12.5px] font-bold disabled:opacity-60 ${
                direction === "add" ? "bg-[#2F7A4F] hover:bg-[#276742]" : "bg-[#B03030] hover:bg-[#962828]"
              }`}
            >
              {saving ? "Đang lưu…" : direction === "add" ? "Xác nhận cộng" : "Xác nhận trừ"}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}
