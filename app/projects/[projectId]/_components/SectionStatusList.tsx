"use client";

import {
  SRS_CHAPTERS,
  SECTION_TYPE_LABELS,
  SectionType,
} from "../../../../lib/constants/section-types";
import { SectionItem } from "./PhaseNavBar";

interface SectionStatusListProps {
  sections: SectionItem[];
  activeSectionType?: SectionType | null;
  onSelectSection?: (type: SectionType) => void;
}

export default function SectionStatusList({
  sections,
  activeSectionType,
  onSelectSection,
}: SectionStatusListProps) {
  const getSectionStatus = (type: SectionType) => {
    const s = sections.find((sec) => sec.type === type);
    if (!s) return { label: "Empty", style: "bg-[#F0EEEA] text-[#8A867E]" };
    if (s.status === "accepted")
      return {
        label: "✓ Accepted",
        style: "bg-[#E9F7EE] text-[#1F7A45] border border-[#BFE6CE]",
      };
    if (s.content)
      return {
        label: "◷ Draft",
        style: "bg-[#F4F3FE] text-[#3B34B0] border border-[#DDD9F6]",
      };
    return { label: "Empty", style: "bg-[#F0EEEA] text-[#8A867E]" };
  };

  return (
    <div className="border border-[#DDD9F6] rounded-[16px] p-4 bg-[#FBFAFF] flex flex-col gap-3 shadow-2xs">
      <div className="flex items-center justify-between">
        <h4 className="font-extrabold text-[13px] text-[#191817] flex items-center gap-1.5">
          <span>📊</span>
          <span>Trạng thái các mục SRS (UC 7.1)</span>
        </h4>
        <span className="text-[10px] text-[#8A867E] font-mono bg-white px-2 py-0.5 rounded-full border border-[#ECEAE5]">
          5 Chương
        </span>
      </div>

      <div className="flex flex-col gap-3">
        {SRS_CHAPTERS.map((ch) => {
          const chapterSections = ch.sections;
          const acceptedCount = chapterSections.filter(
            (t) =>
              sections.find((s) => s.type === t)?.status === "accepted"
          ).length;
          const isAllAccepted = acceptedCount === chapterSections.length;

          return (
            <div
              key={ch.id}
              className="bg-white p-3 rounded-[12px] border border-[#ECEAE5] flex flex-col gap-2"
            >
              <div className="flex items-center justify-between text-[12px] font-bold text-[#191817]">
                <span>{ch.title}</span>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full font-extrabold ${
                    isAllAccepted
                      ? "bg-[#E9F7EE] text-[#1F7A45]"
                      : acceptedCount > 0
                      ? "bg-[#F4F3FE] text-[#3B34B0]"
                      : "bg-[#F0EEEA] text-[#8A867E]"
                  }`}
                >
                  {acceptedCount}/{chapterSections.length}
                </span>
              </div>

              <div className="flex flex-col gap-1 pl-2 border-l-2 border-[#F0EEEA]">
                {chapterSections.map((type) => {
                  const statusInfo = getSectionStatus(type);
                  const isSelected = activeSectionType === type;

                  return (
                    <button
                      key={type}
                      type="button"
                      onClick={() => onSelectSection?.(type)}
                      className={`flex items-center justify-between text-[11.5px] py-1 px-1.5 rounded-[6px] transition-colors text-left cursor-pointer ${
                        isSelected
                          ? "bg-[#F4F3FE] font-bold text-[#4F46E5]"
                          : "hover:bg-[#FAF9F7] text-[#4B4842]"
                      }`}
                    >
                      <span className="truncate pr-2">
                        {SECTION_TYPE_LABELS[type] || type}
                      </span>
                      <span
                        className={`text-[9.5px] font-bold px-2 py-0.5 rounded-full shrink-0 ${statusInfo.style}`}
                      >
                        {statusInfo.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
