"use client";

import type { CrLocation, PatchLocationRequest } from "@/types/change-request";
import { CONCLUSION_LABELS } from "./labels";
import ProposalCard from "./ProposalCard";

interface ImpactListProps {
  locations: CrLocation[];
  editable: boolean;
  onPatch: (locationId: string, body: PatchLocationRequest) => void;
  busy?: boolean;
}

/**
 * 3.4–3.6 Vị trí ảnh hưởng (C-3, UC-50) — phần tử Spine tìm tất định qua liên kết, mã/tên được nhắc và từ khoá; phần tử đã
 * khoá cho CR này. Khi AI đã đề xuất, mỗi vị trí mang kết luận sửa / chỉ comment / không liên quan.
 */
export default function ImpactList({ locations, editable, onPatch, busy = false }: ImpactListProps) {
  if (locations.length === 0) return null;
  const counts = locations.reduce<Record<string, number>>((acc, l) => {
    const key = l.conclusion ?? "pending";
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});
  return (
    <section className="flex flex-col gap-2.5">
      <div className="flex flex-wrap items-baseline gap-2">
        <h3 className="font-extrabold text-[#191817] text-[14px]">Vị trí ảnh hưởng ({locations.length})</h3>
        <span className="text-[11.5px] text-[#8A867E]">
          {(Object.keys(CONCLUSION_LABELS) as (keyof typeof CONCLUSION_LABELS)[])
            .filter((k) => counts[k])
            .map((k) => `${counts[k]} ${CONCLUSION_LABELS[k].toLowerCase()}`)
            .concat(counts.pending ? [`${counts.pending} chưa kết luận`] : [])
            .join(" · ")}
        </span>
      </div>
      {locations.map((l) => (
        <ProposalCard key={l.location_id} location={l} editable={editable} busy={busy} onPatch={(body) => onPatch(l.location_id, body)} />
      ))}
    </section>
  );
}
