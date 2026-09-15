"use client";

import { useFlags } from "../hooks/useFlags";
import FlagsPanel from "./FlagsPanel";
import ReadinessSummary from "./ReadinessSummary";
import type { Readiness } from "@/types/pipeline";

interface VerificationPaneProps {
  projectId: string;
  spineVersion: number | null;
  readiness: Readiness | null;
  onClose: () => void;
  onSelectStep?: (stepId: string) => void;
  /** Cờ vừa đổi (waive/recompute) — cha tải lại `GET /progress` để đồng bộ readiness. */
  onFlagsChanged?: () => void;
}

/** Panel Verification & Readiness thật (T16) — cờ đỏ/vàng, waive, readiness từ BE. */
export default function VerificationPane({
  projectId,
  spineVersion,
  readiness,
  onClose,
  onSelectStep,
  onFlagsChanged,
}: VerificationPaneProps) {
  const { flags, loading, error, busy, waive, recompute } = useFlags(projectId, spineVersion);

  const handleWaive = async (flagId: string, reason: string) => {
    await waive(flagId, reason);
    onFlagsChanged?.();
  };

  const handleRecompute = async () => {
    await recompute();
    onFlagsChanged?.();
  };

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

        {loading ? (
          <div className="flex flex-col items-center justify-center py-12 gap-2 text-[#8A867E]">
            <span className="w-6 h-6 border-2 border-[#4F46E5] border-t-transparent rounded-full animate-spin" />
            <span className="text-xs">Đang tải danh sách cờ…</span>
          </div>
        ) : (
          <FlagsPanel
            flags={flags}
            busy={busy}
            error={error}
            onWaive={handleWaive}
            onRecompute={() => void handleRecompute()}
            onSelectStep={onSelectStep}
          />
        )}
      </div>
    </aside>
  );
}
