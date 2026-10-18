"use client";

import { useState } from "react";
import { ApiClientError } from "@/lib/api/client";
import { userErrorMessage } from "@/lib/api/error-messages";
import {
  adjustAdminOrgCredits,
  formatNumber,
  type AdjustOrgCreditsResult,
  type AdminOrg,
} from "@/lib/api/admin";
import { Button } from "@/components/shadcn/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/shadcn/dialog";
import { Input } from "@/components/shadcn/input";
import { Label } from "@/components/shadcn/label";
import { Textarea } from "@/components/shadcn/textarea";
import { ErrorBanner } from "../../_components/AdminPage";

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

  return (
    <Dialog open={org !== null} onOpenChange={(open) => !open && close()}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Điều chỉnh credit</DialogTitle>
          {org && (
            <DialogDescription>
              {org.wallet ? (
                <>
                  {org.name} — số dư {formatNumber(balance)} · đang giữ {formatNumber(reserved)} · khả dụng{" "}
                  <span className="text-foreground font-semibold">{formatNumber(available)}</span>
                </>
              ) : (
                <>{org.name} — chưa có ví; ví sẽ được tạo khi điều chỉnh lần đầu.</>
              )}
            </DialogDescription>
          )}
        </DialogHeader>

        {org && (
          <form onSubmit={(e) => void submit(e)} className="flex flex-col gap-4">
            {/* Nút chọn chiều điều chỉnh, không phải tab: cùng một form, chỉ đổi dấu của số credit. */}
            <div className="flex gap-2" role="group" aria-label="Loại điều chỉnh">
              {(
                [
                  ["add", "Cộng credit"],
                  ["subtract", "Trừ credit"],
                ] as const
              ).map(([value, label]) => (
                <Button
                  key={value}
                  type="button"
                  variant={direction === value ? "secondary" : "outline"}
                  aria-pressed={direction === value}
                  onClick={() => setDirection(value)}
                  className="flex-1"
                >
                  {label}
                </Button>
              ))}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="adjust-amount">Số credit</Label>
              <Input
                id="adjust-amount"
                inputMode="numeric"
                value={amountInput}
                onChange={(e) => setAmountInput(e.target.value)}
                placeholder="Ví dụ: 100"
                aria-invalid={amountInput.trim() !== "" && (!amountValid || exceedsAvailable)}
                autoFocus
              />
              {amountInput.trim() !== "" && !amountValid && (
                <span className="text-destructive text-caption">Nhập số nguyên dương.</span>
              )}
              {exceedsAvailable && (
                <span className="text-destructive text-caption">
                  Chỉ trừ được tối đa {formatNumber(Math.max(available, 0))} credit (phần khả dụng).
                </span>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="adjust-reason">Lý do (bắt buộc)</Label>
              <Textarea
                id="adjust-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                maxLength={REASON_MAX_LENGTH}
                rows={3}
                placeholder="Ví dụ: Bù credit do sự cố hệ thống ngày 20/09"
              />
              <span className="text-muted-foreground text-caption">
                Lý do được lưu vào lịch sử giao dịch và gửi kèm thông báo cho Lead của tổ chức.
              </span>
            </div>

            {amountValid && !exceedsAvailable && (
              <p className="text-body">
                Số dư sau điều chỉnh: <span className="font-bold">{formatNumber(balance + signed)}</span>
              </p>
            )}

            {error && <ErrorBanner message={error} onClose={() => setError(null)} />}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={close} disabled={saving}>
                Huỷ
              </Button>
              <Button
                type="submit"
                variant={direction === "add" ? "default" : "destructive"}
                disabled={saving || !amountValid || exceedsAvailable || reasonTooShort}
              >
                {saving ? "Đang lưu…" : direction === "add" ? "Xác nhận cộng" : "Xác nhận trừ"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
