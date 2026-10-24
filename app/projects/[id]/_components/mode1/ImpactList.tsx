"use client";

import { useTranslations } from "next-intl";
import type { CrLocation, LocationConclusion, PatchLocationRequest } from "@/types/change-request";
import ProposalCard, { isVectorOnlyLocation } from "./ProposalCard";

interface ImpactListProps {
  locations: CrLocation[];
  editable: boolean;
  onPatch: (locationId: string, body: PatchLocationRequest) => void;
  /** BPMN 3.9 (CR `manual_fix`): sửa đề xuất trong step sở hữu. Không truyền ⇒ không có nút. */
  onOwnerDraft?: (locationId: string, instruction: string) => void;
  busy?: boolean;
}

/** Thứ tự đếm trong dòng tóm tắt — cùng thứ tự kết luận ở `CONCLUSION_LABELS`. */
const CONCLUSIONS: readonly LocationConclusion[] = ["edit", "comment", "not_related"];

/**
 * 3.4–3.6 Vị trí ảnh hưởng (C-3, UC-50) — phần tử Spine tìm tất định qua liên kết, mã/tên được nhắc và từ khoá; phần tử đã
 * khoá cho CR này. Khi AI đã đề xuất, mỗi vị trí mang kết luận sửa / chỉ comment / không liên quan.
 */
export default function ImpactList({ locations, editable, onPatch, onOwnerDraft, busy = false }: ImpactListProps) {
  const t = useTranslations("mode1.impactList");
  if (locations.length === 0) return null;
  const counts = locations.reduce<Record<string, number>>((acc, l) => {
    const key = l.conclusion ?? "pending";
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});
  // Vector tắt (`EMBEDDING_PROVIDER=off`) ⇒ 0, và dòng tóm tắt y như trước.
  const vectorOnly = locations.filter(isVectorOnlyLocation).length;
  return (
    <section className="flex flex-col gap-2.5">
      <div className="flex flex-wrap items-baseline gap-2">
        <h3 className="font-extrabold text-[#191817] text-heading">{t("title", { count: locations.length })}</h3>
        <span className="text-body text-[#8A867E]">
          {CONCLUSIONS.filter((k) => counts[k])
            .map((k) => t(`counts.${k}`, { count: counts[k] }))
            .concat(counts.pending ? [t("counts.pending", { count: counts.pending })] : [])
            .concat(vectorOnly ? [t("counts.vector", { count: vectorOnly })] : [])
            .join(" · ")}
        </span>
      </div>
      {locations.map((l) => (
        <ProposalCard
          key={l.location_id}
          location={l}
          editable={editable}
          busy={busy}
          onPatch={(body) => onPatch(l.location_id, body)}
          onOwnerDraft={onOwnerDraft ? (instruction) => onOwnerDraft(l.location_id, instruction) : undefined}
        />
      ))}
    </section>
  );
}
