"use client";

import { useTranslations } from "next-intl";
import type { Readiness } from "@/types/pipeline";

interface ReadinessSummaryProps {
  readiness: Readiness | null;
}

/**
 * `72% accepted · 4 chờ duyệt lại · 2 cờ đỏ` — chỉ mô tả tình trạng, KHÔNG phải điều kiện chốt
 * baseline (điều kiện chốt là "không còn cờ đỏ chưa waive", kiểm ở `POST /baseline`).
 */
export default function ReadinessSummary({ readiness }: ReadinessSummaryProps) {
  const t = useTranslations("workspace.readiness");
  if (!readiness) {
    return <div className="text-[11.5px] text-[#A8A49C] italic">{t("loading")}</div>;
  }

  return (
    <div
      className="bg-white border border-[#ECEAE5] rounded-[14px] p-3.5 flex flex-col gap-1 shadow-2xs"
      aria-label={t("aria")}
    >
      <div className="text-[11px] font-extrabold text-[#8A867E] tracking-wider uppercase">{t("title")}</div>
      <div className="text-[13px] font-bold text-[#191817] flex flex-wrap items-center gap-x-1.5 gap-y-1">
        <span>{readiness.accepted_pct}% accepted</span>
        <span className="text-[#D6D2CB]">·</span>
        <span className="text-[#8A6D1F]">{t("awaiting", { count: readiness.awaiting_reaccept })}</span>
        <span className="text-[#D6D2CB]">·</span>
        <span className={readiness.red_open > 0 ? "text-[#B03030]" : "text-[#1F7A45]"}>
          {t("red", { count: readiness.red_open })}
        </span>
        {readiness.stale > 0 && (
          <>
            <span className="text-[#D6D2CB]">·</span>
            <span className="text-[#6B6862]">{t("stale", { count: readiness.stale })}</span>
          </>
        )}
      </div>
    </div>
  );
}
