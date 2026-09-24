"use client";

import { MAX_REDO_PER_LOCATION, type CrLocation } from "@/types/change-request";
import { humanizeText, ruleLabel } from "./spine-labels";

/**
 * Kết quả kiểm một vị trí (C-5, UC-82): code (old text, bất biến Spine, cờ đỏ mới) ⇒ đỏ = trượt; AI soát nhất
 * quán ⇒ chỉ vàng, không chặn. Kèm số lần AI đã làm lại (≤ 2).
 */
export default function VerifyResult({ location }: { location: CrLocation }) {
  const v = location.verify;
  if (!v) return null;
  return (
    <div className="flex flex-col gap-1 text-[12px]" aria-label={`Kết quả kiểm ${location.location_id}`}>
      <div className="flex items-center gap-2">
        <span className={`px-2 py-0.5 rounded-full font-bold text-[11px] ${v.code_ok ? "bg-[#E9F7EE] text-[#1F7A45]" : "bg-[#FDEDED] text-[#B03030]"}`}>
          {v.code_ok ? "Kiểm tra tự động: đạt" : "Kiểm tra tự động: chưa đạt"}
        </span>
        {location.redo_count > 0 && (
          <span className="text-[11px] text-[#8A867E]">
            AI đã làm lại {location.redo_count}/{MAX_REDO_PER_LOCATION} lần
          </span>
        )}
      </div>
      {v.violations.map((x, i) => (
        <p key={`v${i}`} className="text-[#B03030]">
          ● <span title={x.rule}>{humanizeText(x.message)}</span>
          {ruleLabel(x.rule) && <span className="text-[10.5px] opacity-70"> ({ruleLabel(x.rule)})</span>}
        </p>
      ))}
      {v.ai_flags.map((x, i) => (
        <p key={`a${i}`} className="text-[#8A6D1F]">
          ● <span title={x.rule}>{humanizeText(x.message)}</span>
          {ruleLabel(x.rule) && <span className="text-[10.5px] opacity-70"> ({ruleLabel(x.rule)})</span>}
        </p>
      ))}
    </div>
  );
}
