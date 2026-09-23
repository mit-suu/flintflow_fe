"use client";

import Icon from "@/components/ui/Icon";
import IconButton from "@/components/ui/IconButton";
import FlagsPanel from "./FlagsPanel";
import ReadinessSummary from "./ReadinessSummary";
import type { Readiness } from "@/types/pipeline";
import type { Flag } from "@/types/flags";

interface VerificationPaneProps {
  readiness: Readiness | null;
  /** Nguồn cờ duy nhất — sống ở `page.tsx` (T8) để `DocumentPane` cũng dùng chung, thay vì mỗi
   * panel tự gọi `useFlags` (hai bản state cờ lệch nhau). */
  flags: Flag[];
  flagsLoading: boolean;
  flagsError: string | null;
  flagsBusy: boolean;
  onClose: () => void;
  onSelectStep?: (stepId: string) => void;
  /** Xác nhận cả loạt giả định (S-9.1 quét ra vài chục cái) — xem `FlagsPanel`. */
  onConfirmAllAssumptions?: (ids: string[]) => void;
  onWaive: (flagId: string, reason: string) => Promise<void>;
  onRecompute: () => Promise<void> | void;
  /** Vẽ lại sơ đồ của cờ `diagram_stale` / `render_error` (BUG-17). */
  onRedraw?: (flag: Flag) => Promise<void> | void;
  /** Xác nhận / bác bỏ giả định ngay tại panel (BUG-13). */
  onAssumptionDecision?: (decision: { kind: "confirm" | "reject"; id: string }) => void;
}

/** Panel Verification & Readiness thật (T16) — cờ đỏ/vàng, waive, readiness từ BE. */
export default function VerificationPane({
  readiness,
  flags,
  flagsLoading,
  flagsError,
  flagsBusy,
  onClose,
  onSelectStep,
  onWaive,
  onRecompute,
  onRedraw,
  onAssumptionDecision,
  onConfirmAllAssumptions,
}: VerificationPaneProps) {
  return (
    <aside className="w-[340px] h-full flex-none bg-surface-container-low rounded-l-dialog flex flex-col overflow-hidden" aria-label="Verification">
      <div className="ff-fade-below [--ff-fade:var(--color-surface-container-low)] h-12 pl-4 pr-2 bg-surface-container-low flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <Icon name="shield-check" size={16} className="text-success" />
          <h3 className="font-bold text-[13px] text-on-surface truncate">Verification & Readiness</h3>
        </div>
        <IconButton icon="close" size="sm" label="Đóng bảng đánh giá" onClick={onClose} />
      </div>

      <div className="flex-1 overflow-y-auto ff-scroll p-4 space-y-4">
        <ReadinessSummary readiness={readiness} />

        {flagsLoading ? (
          <div className="flex flex-col items-center justify-center py-12 gap-2 text-[#8A867E]">
            <span className="w-6 h-6 border-2 border-[#6A62C4] border-t-transparent rounded-full animate-spin" />
            <span className="text-xs">Đang tải danh sách cờ…</span>
          </div>
        ) : (
          <FlagsPanel
            flags={flags}
            busy={flagsBusy}
            error={flagsError}
            onWaive={onWaive}
            onRedraw={onRedraw}
            onAssumptionDecision={onAssumptionDecision}
            {...(onConfirmAllAssumptions ? { onConfirmAllAssumptions } : {})}
            onRecompute={() => void onRecompute()}
            onSelectStep={onSelectStep}
          />
        )}
      </div>
    </aside>
  );
}
