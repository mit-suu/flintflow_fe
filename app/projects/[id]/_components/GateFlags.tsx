"use client";

import { useState } from "react";
import QuickReplyChips, { QuickReplyChip } from "./QuickReplyChips";
import { WAIVE_REASON_MIN_LENGTH } from "./flag-rules";
import type { BlockingFlag } from "./gate-helpers";

/** Cờ mới nêu trong tin gate (đã đọc được: `message` thay mã mục bằng tên mục). */
export interface GateNewFlag {
  id: string;
  level: "red" | "yellow";
  message: string;
  /** Cờ không waive được (`isFlagWaivable`) ⇒ chỉ có "Sửa theo đề xuất". */
  waivable: boolean;
}

interface GateFlagsProps {
  blockingFlags?: BlockingFlag[];
  onGoToStep?: (stepId: string) => void;
  newFlags?: GateNewFlag[];
  onFixFlag?: (flag: GateNewFlag) => void;
  /** Bỏ qua cờ kèm lý do (waive). Ném lỗi khi BE từ chối. */
  onKeepFlag?: (flag: GateNewFlag, reason: string) => Promise<void>;
  locked: boolean;
}

/**
 * Phần cờ của tin gate: cờ đỏ đang chặn ký baseline (chip tới chỗ bị chặn) và cờ mới của lượt này (chip "Sửa theo đề xuất"
 * / "Giữ nguyên"). Màu chỉ phụ trợ — mỗi khối luôn có câu nói rõ mức độ.
 */
export default function GateFlags({ blockingFlags = [], onGoToStep, newFlags = [], onFixFlag, onKeepFlag, locked }: GateFlagsProps) {
  const [keeping, setKeeping] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const closeKeep = () => {
    setKeeping(null);
    setReason("");
    setError(null);
  };
  const submitKeep = async (flag: GateNewFlag) => {
    if (!onKeepFlag || saving) return;
    setSaving(true);
    setError(null);
    try {
      await onKeepFlag(flag, reason.trim());
      closeKeep();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Chưa giữ nguyên được vấn đề này, bạn thử lại nhé.");
    } finally {
      setSaving(false);
    }
  };

  if (blockingFlags.length === 0 && newFlags.length === 0) return null;
  return (
    <div className="flex flex-col gap-3">
      {blockingFlags.length > 0 && (
        <div role="alert" className="bg-error-container rounded-card px-3.5 py-3 flex flex-col gap-2 text-[13px] leading-6 text-on-error-container">
          <p className="font-semibold">Chưa ký được baseline — còn {blockingFlags.length} cờ đỏ chưa xử lý:</p>
          {blockingFlags.map((flag) => (
            <div key={flag.id} className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
              <span className="flex-1 min-w-0">{flag.message}</span>
              {flag.remediation_step && onGoToStep && (
                <QuickReplyChip tone="soft" ariaLabel={`Xem chỗ bị chặn: ${flag.message}`} onClick={() => onGoToStep(flag.remediation_step as string)}>
                  Xem chỗ bị chặn
                </QuickReplyChip>
              )}
            </div>
          ))}
        </div>
      )}

      {newFlags.map((flag) => (
        <div key={flag.id} className="flex flex-col gap-2">
          <p className="text-[14px] leading-7 text-on-surface">
            <span className={`font-semibold ${flag.level === "red" ? "text-error" : "text-accent-gold-text"}`}>
              {flag.level === "red" ? "Vấn đề cần xử lý: " : "Điểm nên xem: "}
            </span>
            {flag.message}
          </p>
          <QuickReplyChips label={`Xử lý: ${flag.message}`}>
            {onFixFlag && (
              <QuickReplyChip tone="soft" disabled={locked || saving} onClick={() => onFixFlag(flag)}>
                Sửa theo đề xuất
              </QuickReplyChip>
            )}
            {onKeepFlag && flag.waivable && (
              <QuickReplyChip tone="soft" disabled={locked || saving} onClick={() => (keeping === flag.id ? closeKeep() : setKeeping(flag.id))}>
                Giữ nguyên
              </QuickReplyChip>
            )}
          </QuickReplyChips>
          {keeping === flag.id && (
            <div className="flex flex-col gap-2">
              <label htmlFor={`gate-keep-${flag.id}`} className="text-[12px] font-semibold text-on-surface-variant">
                Vì sao bạn muốn giữ nguyên? (tối thiểu {WAIVE_REASON_MIN_LENGTH} ký tự, sẽ in kèm trong tài liệu)
              </label>
              <textarea
                id={`gate-keep-${flag.id}`}
                rows={2}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full px-3 py-2 rounded-control bg-surface-container text-[13px] outline-none resize-none focus:bg-surface-container-high"
              />
              {error && (
                <p role="alert" className="text-[12px] text-error">
                  {error}
                </p>
              )}
              <div className="flex gap-2">
                <QuickReplyChip tone="primary" busy={saving} disabled={reason.trim().length < WAIVE_REASON_MIN_LENGTH} onClick={() => void submitKeep(flag)}>
                  Xác nhận giữ nguyên
                </QuickReplyChip>
                <QuickReplyChip tone="soft" disabled={saving} onClick={closeKeep}>
                  Huỷ
                </QuickReplyChip>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
