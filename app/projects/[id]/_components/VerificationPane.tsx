"use client";

import { useState, type ComponentProps } from "react";
import Icon from "@/components/ui/Icon";
import IconButton from "@/components/ui/IconButton";
import FlagsPanel from "./FlagsPanel";
import ReadinessSummary from "./ReadinessSummary";
import type { Readiness } from "@/types/pipeline";
import type { Flag } from "@/types/flags";
import TraceabilityMap from "./TraceabilityMap";
import { issueCounts } from "./flag-rules";

interface VerificationPaneProps {
  /** Có ⇒ hiện "Bản đồ truy vết" (actor → use case → feature → màn → function) ở cuối panel. */
  projectId?: string;
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
  /** Không truyền ⇒ không có nút waive (mode 1 v3). */
  onWaive?: (flagId: string, reason: string) => Promise<void>;
  onRecompute: () => Promise<void> | void;
  /** Vẽ lại sơ đồ của cờ `diagram_stale` / `render_error` (BUG-17). */
  onRedraw?: (flag: Flag) => Promise<void> | void;
  /** Xác nhận / bác bỏ giả định ngay tại panel (BUG-13). */
  onAssumptionDecision?: (decision: { kind: "confirm" | "reject"; id: string }) => void;
  /** Nhãn mục, cuộn tới mục, lọc theo mục, nhóm "Mục cần viết lại" — chuyển thẳng cho `FlagsPanel`. */
  issues?: Pick<
    ComponentProps<typeof FlagsPanel>,
    "sectionLabelOf" | "onShowSection" | "focusSectionId" | "onClearFocus" | "outdatedCount" | "onRewriteOutdated" | "rewriting" | "onEditSection"
  >;
}

/** Panel "Kiểm tra tài liệu" (T16) — vấn đề đỏ/vàng gom theo loại, bỏ qua có lý do, tình trạng chốt bản từ BE. */
export default function VerificationPane({
  projectId,
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
  issues,
}: VerificationPaneProps) {
  const [showTrace, setShowTrace] = useState(false);
  return (
    <aside className="w-full h-full bg-surface-container-low rounded-l-dialog flex flex-col overflow-hidden" aria-label="Kiểm tra tài liệu">
      <div className="ff-fade-below [--ff-fade:var(--color-surface-container-low)] h-12 pl-4 pr-2 bg-surface-container-low flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <Icon name="shield-check" size={16} className="text-success" />
          <h3 className="font-bold text-[13px] text-on-surface truncate">Kiểm tra tài liệu</h3>
        </div>
        <IconButton icon="close" size="sm" label="Đóng kiểm tra tài liệu" onClick={onClose} />
      </div>

      <div className="flex-1 overflow-y-auto ff-scroll p-4 space-y-3">
        <ReadinessSummary counts={readiness ? issueCounts(flags, issues?.outdatedCount ?? 0) : null} />

        {flagsLoading ? (
          <div className="flex flex-col items-center justify-center py-12 gap-2 text-on-surface-muted">
            <span className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <span className="text-xs">Đang tải danh sách vấn đề…</span>
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
            {...issues}
          />
        )}
        {projectId && (
          <section className="flex flex-col gap-1.5 pt-1">
            <button
              type="button"
              onClick={() => setShowTrace((v) => !v)}
              aria-expanded={showTrace}
              className="self-start text-[12px] font-bold text-primary hover:underline cursor-pointer"
            >
              {showTrace ? "Ẩn bản đồ truy vết" : "Xem bản đồ truy vết"}
            </button>
            {showTrace && <TraceabilityMap projectId={projectId} />}
          </section>
        )}
      </div>
    </aside>
  );
}
