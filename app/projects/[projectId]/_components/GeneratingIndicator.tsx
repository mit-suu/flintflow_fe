"use client";

import {
  SectionType,
  SECTION_TYPE_LABELS,
} from "../../../../lib/constants/section-types";

interface GeneratingIndicatorProps {
  phaseLabel: string;
  sectionTypes: SectionType[];
  completedTypes: SectionType[];
  currentGeneratingType?: SectionType;
  onStop?: () => void;
}

export default function GeneratingIndicator({
  phaseLabel,
  sectionTypes,
  completedTypes,
  currentGeneratingType,
  onStop,
}: GeneratingIndicatorProps) {
  return (
    <div className="w-full bg-white border border-[#DDD9F6] rounded-[16px] p-5 shadow-[0_8px_24px_rgba(79,70,229,0.08)] flex flex-col gap-3.5 my-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="w-4 h-4 rounded-full border-2 border-[#4F46E5] border-t-transparent animate-spin" />
          <h4 className="font-extrabold text-[13.5px] text-[#191817]">
            Đang sinh đặc tả {phaseLabel}…
          </h4>
        </div>

        {onStop && (
          <button
            type="button"
            onClick={onStop}
            className="px-3 py-1 rounded-full border border-[#ECEAE5] text-[11px] font-bold text-[#8A867E] hover:text-[#B03030] hover:bg-[#FDEDED] transition-colors cursor-pointer"
          >
            ■ Dừng lại
          </button>
        )}
      </div>

      <div className="flex flex-col gap-1.5 bg-[#FAF9F7] p-3 rounded-[12px] border border-[#ECEAE5]">
        {sectionTypes.map((type) => {
          const isDone = completedTypes.includes(type);
          const isCurrent = currentGeneratingType === type;
          const label = SECTION_TYPE_LABELS[type] || type;

          return (
            <div
              key={type}
              className={`flex items-center justify-between text-[12px] py-0.5 ${
                isDone
                  ? "text-[#1F7A45] font-semibold"
                  : isCurrent
                  ? "text-[#4F46E5] font-bold"
                  : "text-[#8A867E]"
              }`}
            >
              <div className="flex items-center gap-2">
                {isDone ? (
                  <span className="w-4 h-4 rounded-full bg-[#E9F7EE] text-[#1F7A45] flex items-center justify-center text-[10px] font-bold">
                    ✓
                  </span>
                ) : isCurrent ? (
                  <span className="w-4 h-4 rounded-full border-2 border-[#4F46E5] border-t-transparent animate-spin" />
                ) : (
                  <span className="w-4 h-4 rounded-full bg-[#F0EEEA] flex items-center justify-center text-[9px] text-[#A8A49C]">
                    ○
                  </span>
                )}
                <span>{label}</span>
              </div>

              <span className="text-[10px] uppercase tracking-wider font-bold">
                {isDone ? "Đã xong" : isCurrent ? "Đang xử lý…" : "Chờ"}
              </span>
            </div>
          );
        })}
      </div>

      <p className="text-[11.5px] text-[#8A867E] italic">
        Quá trình sinh đặc tả có thể mất 10–20 giây. Vui lòng giữ phiên làm việc.
      </p>
    </div>
  );
}
