"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import type { ExtractionInference, ExtractionOption } from "@/types/extraction";

interface ExtractionInferenceCardProps {
  /** Mã mục (`R3`) — cho tên nhóm radio / nhãn trợ năng. */
  itemId: string;
  inference: ExtractionInference;
  /** Phương án đang chọn (chỉ số), `null` = chưa chọn. */
  chosen: number | null;
  onChoose?: (index: number) => void;
  /** Đã duyệt / chỉ đọc: không có radio, chỉ hiện phương án đã chọn. */
  readOnly?: boolean;
  /** Nguồn đọc được của câu trích triệu chứng (tên tài liệu + số đoạn, có thể bấm mở đoạn). */
  source: ReactNode;
}

const List = ({ title, items, tone }: { title: string; items: string[]; tone: string }) =>
  items.length ? (
    <div className="flex flex-col gap-0.5">
      <span className={`text-caption font-bold ${tone}`}>{title}</span>
      <ul className="list-disc pl-4 text-caption text-[#4B4842]">
        {items.map((x) => (
          <li key={x}>{x}</li>
        ))}
      </ul>
    </div>
  ) : null;

/**
 * Thẻ mục Suy ra (FLF-449, BF §3.6.1): triệu chứng kèm câu trích, gốc rễ, lý do suy ra, mục tiêu phục vụ, hai phương án dạng
 * radio với ưu / nhược / rủi ro. Khuyến nghị chỉ hiện khi AI có căn cứ (03 Đã chốt #3), kèm lý do; không có thì nói rõ hai
 * phương án ngang nhau. Kiểu phương án tương thích `OptionAnalysis` chung — gộp sau thì thay bằng component dùng chung.
 */
export default function ExtractionInferenceCard({ itemId, inference, chosen, onChoose, readOnly = false, source }: ExtractionInferenceCardProps) {
  const t = useTranslations("mode1.extraction.inference");
  const optionBody = (o: ExtractionOption, i: number) => (
    <div className="flex-1 min-w-0 flex flex-col gap-1">
      <span className="flex flex-wrap items-center gap-2">
        <span className="text-body font-bold text-[#191817]">{o.label}</span>
        {inference.recommended === i && <span className="px-2 py-0.5 rounded-full text-caption font-bold bg-[#E9F7EE] text-[#1F7A45]">{t("recommended")}</span>}
      </span>
      {o.description && <span className="text-caption text-[#4B4842]">{o.description}</span>}
      <div className="grid gap-1.5 sm:grid-cols-3">
        <List title={t("pros")} items={o.pros} tone="text-[#1F7A45]" />
        <List title={t("cons")} items={o.cons} tone="text-[#B03030]" />
        <List title={t("risks")} items={o.risks} tone="text-[#8A6D1F]" />
      </div>
    </div>
  );

  return (
    <div className="rounded-[10px] bg-[#F6F5F2] border border-[#ECEAE5] p-2.5 flex flex-col gap-2">
      <div className="flex flex-col gap-0.5">
        <span className="text-caption font-bold text-[#4B4842]">{t("symptom")}</span>
        <p className="text-body text-[#191817]">{inference.symptom}</p>
        <p className="text-caption text-[#8A867E] italic">
          “{inference.symptom_quote}” - {source}
        </p>
      </div>
      {inference.root_cause && (
        <p className="text-caption text-[#4B4842]">
          <span className="font-bold">{t("rootCause")}:</span> {inference.root_cause}
        </p>
      )}
      {inference.rationale && (
        <p className="text-caption text-[#4B4842]">
          <span className="font-bold">{t("rationale")}:</span> {inference.rationale}
        </p>
      )}
      {inference.serves_goal && <p className="text-caption text-[#554DB0]">{t("servesGoal", { goal: inference.serves_goal })}</p>}

      {readOnly ? (
        chosen !== null && inference.options[chosen] ? <p className="text-caption font-bold text-[#191817]">{t("chosen", { label: inference.options[chosen].label })}</p> : null
      ) : (
        <div role="radiogroup" aria-label={t("optionsAria", { id: itemId })} className="flex flex-col gap-1.5">
          {inference.options.map((o, i) => (
            <label key={`${itemId}-${i}`} className={`flex items-start gap-2 rounded-[8px] border bg-white px-2.5 py-2 cursor-pointer ${chosen === i ? "border-[#191817]" : "border-[#ECEAE5]"}`}>
              <input type="radio" name={`inference-${itemId}`} aria-label={o.label} checked={chosen === i} onChange={() => onChoose?.(i)} className="mt-1" />
              {optionBody(o, i)}
            </label>
          ))}
        </div>
      )}
      {inference.recommended !== null && inference.recommendation_reason ? (
        <p className="text-caption text-[#1F7A45]">{t("recommendationReason", { reason: inference.recommendation_reason })}</p>
      ) : (
        !readOnly && <p className="text-caption text-[#8A867E]">{t("noRecommendation")}</p>
      )}
    </div>
  );
}
