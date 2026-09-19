"use client";

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
  onWaive: (flagId: string, reason: string) => Promise<void>;
  onRecompute: () => Promise<void> | void;
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
}: VerificationPaneProps) {
  return (
    <aside className="w-[340px] flex-none bg-[#FAF9F7] border-l border-[#ECEAE5] flex flex-col overflow-hidden z-10">
      <div className="p-3.5 border-b border-[#ECEAE5] bg-white flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-[#1F7A45] font-bold">✓</span>
          <h3 className="font-extrabold text-[13px] text-[#191817]">Verification & Readiness</h3>
        </div>
        <button
          onClick={onClose}
          className="p-1 hover:bg-[#F5F3F0] rounded-[6px] text-[#8A867E] hover:text-[#191817] transition-colors cursor-pointer"
          title="Đóng bảng đánh giá"
        >
          ✕
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
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
            onRecompute={() => void onRecompute()}
            onSelectStep={onSelectStep}
          />
        )}
      </div>
    </aside>
  );
}
