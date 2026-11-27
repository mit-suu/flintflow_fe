"use client";

import { useTranslations } from "next-intl";
import type { CrLocation, LocationFoundBy, LocationConclusion } from "@/types/change-request";
import { AssumptionsNote } from "./CrMaterials";
import OriginalDiagramChange, { diagramLocationTitle, isDiagramLocation } from "./OriginalDiagramChange";
import { formatPercent } from "./labels";
import { useMode1Labels } from "./i18n";
import { OthersPending, ProposalDiff, useLocTitle } from "./LocationDisplay";
import VerifyResult from "./VerifyResult";

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

/**
 * Người dùng tự bỏ đề xuất trong khung chat (PATCH `not_related` luôn bật `manual`) — khác với AI kết luận chỗ này không
 * liên quan, nên nhãn là "Đã bỏ" chứ không phải "Không liên quan".
 */
export const isDroppedLocation = (loc: Pick<CrLocation, "conclusion" | "manual">): boolean => loc.conclusion === "not_related" && loc.manual;

const CONCLUSION_TONE: Record<LocationConclusion, string> = {
  edit: "bg-primary-soft text-primary-hover",
  comment: "bg-info-soft text-info",
  not_related: "bg-surface-container-high text-on-surface-variant",
};

export default function ProposalCard({ location }: ProposalCardProps) {
  const t = useTranslations("mode1.proposalCard");
  const tDiagram = useTranslations("mode1.originalDiagram");
  const tLabels = useTranslations("mode1.labels");
  const { sectionTitle, humanizeText, foundBy, conclusion } = useMode1Labels();
  const locTitle = useLocTitle();
  const p = location.proposal;
  const failed = location.verify && !location.verify.code_ok;

  return (
    <article
      // Phẳng, không viền: thẻ nằm trên nền trắng của popup; chỗ kiểm trượt mới có viền đỏ để mắt bắt được
      className={`rounded-card p-3.5 flex flex-col gap-2 ${failed ? "bg-surface-container-lowest border border-error/40" : "bg-surface-container-low"}`}
      aria-label={t("aria", { id: location.location_id })}
    >
      <header className="flex flex-wrap items-center gap-1.5 text-body">
        {/* F6: vị trí hiện theo mục của tài liệu; path Spine chỉ để tra (tooltip) */}
        <span className="font-bold text-on-surface">
          {isDiagramLocation(location) ? diagramLocationTitle(location, tDiagram) : sectionTitle(location.section_id, location.section_title)}
        </span>
        {!isDiagramLocation(location) && <span className="text-on-surface-variant">- {locTitle(location)}</span>}
        {/* Chỉ chip "Theo nghĩa": nó bảo người duyệt đọc kỹ. Các cách tìm khác (liên kết, nhắc mã, từ khoá) là chuyện nội bộ */}
        {location.found_by.filter((f) => f === "vector").map((f) => {
          // Chip "Theo nghĩa" mang luôn độ khớp. `vector_score` tuỳ chọn ⇒ chỉ format khi thật là số:
          // `?? 0` sẽ in "0%", một con số sai, khác hẳn với "không có số".
          const score = typeof location.vector_score === "number" ? ` · ${formatPercent(location.vector_score)}` : "";
          // Vị trí chỉ tìm được nhờ nghĩa: tô khác để mắt bắt được trong hàng chip xám. Hàng này đã dùng
          // xám / tím / vàng, nên xanh info là màu duy nhất còn trống ở đây.
          const vectorOnly = isVectorOnlyLocation(location);
          return (
            <span
              key={f}
              title={t("vectorTitle")}
              className={`px-1.5 py-0.5 rounded font-semibold ${vectorOnly ? "bg-info-soft text-info" : "bg-surface-container-high text-on-surface-variant"}`}
            >
              {foundBy(f)}
              {score}
            </span>
          );
        })}
        {/* Vị trí "mục trống" (phương án B): path là cả mảng — CR thêm phần tử mới chứ không sửa cái đang có */}
        {location.path.endsWith("[]") && <span className="px-1.5 py-0.5 rounded bg-primary-soft text-primary font-bold">{t("emptySlot")}</span>}
        {/* Không hiện bước sở hữu: dự án tải SRS lên không đi qua các bước soạn, tên bước chỉ là thuật ngữ nội bộ */}
        {location.conclusion && (
          <span className={`ml-auto px-2 py-0.5 rounded-full font-bold ${CONCLUSION_TONE[location.conclusion]}`}>
            {isDroppedLocation(location) ? tLabels("conclusion.dropped") : conclusion(location.conclusion)}
          </span>
        )}
      </header>

      {location.conclusion === "edit" && p && (isDiagramLocation(location) ? <OriginalDiagramChange loc={location} /> : <ProposalDiff loc={location} />)}
      <OthersPending loc={location} />
      {location.conclusion === "comment" && p?.comment_text && (
        <p className="text-body text-[#3B4FA8] bg-[#EEF1FB] rounded-[8px] px-2.5 py-1.5">💬 {p.comment_text}</p>
      )}
      {location.reason && <p className="text-body text-on-surface-muted">{t("reason", { reason: humanizeText(location.reason) })}</p>}
      {location.conclusion !== "not_related" && <AssumptionsNote assumptions={p?.assumptions} />}

      <VerifyResult location={location} />

    </article>
  );
}
