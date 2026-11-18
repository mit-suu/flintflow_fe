"use client";

import { useLocale, useTranslations } from "next-intl";
import type { CrLocation, LocationFoundBy, LocationConclusion } from "@/types/change-request";
import { AssumptionsNote } from "./CrMaterials";
import OriginalDiagramChange, { diagramLocationTitle, isDiagramLocation } from "./OriginalDiagramChange";
import { formatPercent } from "./labels";
import { useMode1Labels } from "./i18n";
import { OthersPending, ProposalDiff, useLocTitle } from "./LocationDisplay";
import VerifyResult from "./VerifyResult";
import { tStep } from "@/lib/i18n";

/**
 * FLF-375: thẻ CHỈ ĐỌC của một chỗ trong popup CR (xem lại / Lead duyệt gói). Mọi thao tác (đồng ý, gõ hướng sửa, giữ
 * nguyên) làm trong khung chat — BF nguyên tắc 6: không sửa tay nội dung.
 */
interface ProposalCardProps {
  location: CrLocation;
}

/**
 * Nguồn chỉ nói "có nội dung gần giống", khác với nguồn tất định (`spine_link` liên kết field, `mention`
 * nhắc mã, `preview` từ bản xem trước, `diagram` từ hình gốc).
 */
const RECALL_ONLY_SOURCES: readonly LocationFoundBy[] = ["vector", "keyword"];

/**
 * Vị trí chỉ đến từ truy hồi: không có nguồn tất định nào. BE có một hàm cùng tên ý
 * (`change-request/spine-location.ts`) nhưng nó chỉ dùng nội bộ để cắt trần 80 vị trí, không phải nghĩa
 * người dùng thấy — nên đừng coi hai bên là một.
 */
const isRecallOnlyLocation = (loc: Pick<CrLocation, "found_by">): boolean =>
  loc.found_by.every((b) => RECALL_ONLY_SOURCES.includes(b));

/**
 * Vị trí mà "gần nghĩa" là lý do DUY NHẤT nó có trong danh sách: có `vector` và không có nguồn tất định
 * nào. Người duyệt nên đọc kỹ hơn những vị trí này.
 *
 * Hẹp hơn `isRecallOnlyLocation`: vị trí chỉ có `keyword` cũng là recall-only, nhưng nó trùng TỪ chứ
 * không gần NGHĨA — gộp hai thứ lại thì nhãn nói sai về cách máy tìm ra nó.
 */
export const isVectorOnlyLocation = (loc: Pick<CrLocation, "found_by">): boolean =>
  loc.found_by.includes("vector") && isRecallOnlyLocation(loc);

const CONCLUSION_TONE: Record<LocationConclusion, string> = {
  edit: "bg-[#F2F1FB] text-[#554DB0]",
  comment: "bg-[#EEF1FB] text-[#3B4FA8]",
  not_related: "bg-[#F0EEEA] text-[#6B6862]",
};

export default function ProposalCard({ location }: ProposalCardProps) {
  const t = useTranslations("mode1.proposalCard");
  const tDiagram = useTranslations("mode1.originalDiagram");
  const locale = useLocale();
  const { sectionTitle, humanizeText, foundBy, conclusion } = useMode1Labels();
  const locTitle = useLocTitle();
  const p = location.proposal;
  const failed = location.verify && !location.verify.code_ok;

  return (
    <article
      className={`bg-white border rounded-[14px] p-3.5 flex flex-col gap-2 ${failed ? "border-[#F2CACA]" : "border-[#ECEAE5]"}`}
      aria-label={t("aria", { id: location.location_id })}
    >
      <header className="flex flex-wrap items-center gap-1.5 text-body">
        {/* F6: vị trí hiện theo mục của tài liệu; path Spine chỉ để tra (tooltip) */}
        <span className="font-bold text-[#191817]">
          {isDiagramLocation(location) ? diagramLocationTitle(location, tDiagram) : sectionTitle(location.section_id, location.section_title)}
        </span>
        {!isDiagramLocation(location) && <span className="text-[#4B4842]">- {locTitle(location)}</span>}
        {location.found_by.map((f) => {
          // Chip "Theo nghĩa" mang luôn độ khớp. `vector_score` tuỳ chọn ⇒ chỉ format khi thật là số:
          // `?? 0` sẽ in "0%", một con số sai, khác hẳn với "không có số".
          const vector = f === "vector";
          const score = vector && typeof location.vector_score === "number" ? ` · ${formatPercent(location.vector_score)}` : "";
          // Vị trí chỉ tìm được nhờ nghĩa: tô khác để mắt bắt được trong hàng chip xám. Hàng này đã dùng
          // xám / tím / vàng, nên xanh info là màu duy nhất còn trống ở đây.
          const vectorOnly = vector && isVectorOnlyLocation(location);
          return (
            <span
              key={f}
              title={vector ? t("vectorTitle") : undefined}
              className={`px-1.5 py-0.5 rounded font-semibold ${vectorOnly ? "bg-info-soft text-info" : "bg-[#F0EEEA] text-[#4B4842]"}`}
            >
              {foundBy(f)}
              {score}
            </span>
          );
        })}
        {/* Vị trí "mục trống" (phương án B): path là cả mảng — CR thêm phần tử mới chứ không sửa cái đang có */}
        {location.path.endsWith("[]") && <span className="px-1.5 py-0.5 rounded bg-[#F2F1FB] text-[#6A62C4] font-bold">{t("emptySlot")}</span>}
        {location.owner_step && <span className="text-[#A8A49C]" title={location.owner_step}>{t("ownerStep", { step: tStep(location.owner_step, locale) })}</span>}
        {location.conclusion && (
          <span className={`ml-auto px-2 py-0.5 rounded-full font-bold ${CONCLUSION_TONE[location.conclusion]}`}>{conclusion(location.conclusion)}</span>
        )}
      </header>

      {location.conclusion === "edit" && p && (isDiagramLocation(location) ? <OriginalDiagramChange loc={location} /> : <ProposalDiff loc={location} />)}
      <OthersPending loc={location} />
      {location.conclusion === "comment" && p?.comment_text && (
        <p className="text-body text-[#3B4FA8] bg-[#EEF1FB] rounded-[8px] px-2.5 py-1.5">💬 {p.comment_text}</p>
      )}
      {location.reason && <p className="text-body text-[#6B6862]">{t("reason", { reason: humanizeText(location.reason) })}</p>}
      {location.conclusion !== "not_related" && <AssumptionsNote assumptions={p?.assumptions} />}

      <VerifyResult location={location} />

    </article>
  );
}
