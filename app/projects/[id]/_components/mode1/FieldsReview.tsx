"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import type { FieldsPatchRequest, HeadingMapEntry, ReviewField } from "@/types/import";
import { useMode1Labels } from "./i18n";
import { formatPercent } from "./labels";

interface FieldsReviewProps {
  fields: ReviewField[];
  onSubmit: (body: Omit<FieldsPatchRequest, "import_id">) => void;
  busy?: boolean;
  /** Heading của profile — ghi rõ tính năng / chức năng mới (section tạm) theo tiêu đề trong file. */
  headingMap?: HeadingMapEntry[];
}

const fieldKey = (f: ReviewField) => `${f.section_id}|${f.path}`;

/** Giá trị field hiển thị/sửa dạng text: chuỗi giữ nguyên, kiểu khác ở dạng JSON. */
export const valueToText = (value: unknown): string => (typeof value === "string" ? value : JSON.stringify(value));

/** Text đã sửa ⇒ giá trị gửi BE: giữ kiểu gốc khi còn parse được JSON, không thì là chuỗi. */
export const textToValue = (text: string, original: unknown): unknown => {
  if (typeof original === "string") return text;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
};

/** Cách trích của field (BE `ReviewField.origin`) có nhãn. `vision` = Gemini đọc từ ảnh diagram (mode 1 v3 phase 5). */
const ORIGINS: readonly string[] = ["ai", "deterministic", "vision"];

/**
 * 1.9 Xác nhận field độ tin thấp (UC-22): xem giá trị AI trích, block nguồn, sửa nếu sai. Nội dung field là
 * dữ liệu SRS (tiếng Anh) — FE không dịch.
 */
export default function FieldsReview({ fields, onSubmit, busy = false, headingMap }: FieldsReviewProps) {
  const t = useTranslations("mode1.fieldsReview");
  const L = useMode1Labels();
  const [edits, setEdits] = useState<Record<string, string>>({});

  const submit = () =>
    onSubmit({
      fields: fields
        .filter((f) => fieldKey(f) in edits && edits[fieldKey(f)] !== valueToText(f.value))
        .map((f) => ({ section_id: f.section_id, path: f.path, confirmed: true, edited_value: textToValue(edits[fieldKey(f)], f.value) })),
      confirm_all: true,
    });

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h3 className="font-extrabold text-[#191817] text-heading">{t("title")}</h3>
        <p className="text-body text-[#8A867E]">{t("summary", { count: fields.length })}</p>
        <p className="text-body text-[#8A6D1F]">{t("onlyChance")}</p>
      </div>
      <ul className="flex flex-col gap-3">
        {fields.map((f) => {
          const key = fieldKey(f);
          const text = edits[key] ?? valueToText(f.value);
          const changed = key in edits && edits[key] !== valueToText(f.value);
          const label = L.pathLabel(f.path, f.entity_name);
          return (
            <li key={key} className={`bg-white border rounded-[14px] p-3 flex flex-col gap-2 ${changed ? "border-[#6A62C4]" : "border-[#ECEAE5]"}`}>
              <div className="flex flex-wrap items-center gap-2 text-body">
                <span className="font-bold text-[#191817]" title={f.path}>
                  {label}
                </span>
                <span className="text-[#8A867E]">· {L.sectionLabelIn(f.section_id, headingMap)}</span>
                {f.origin === "vision" && (
                  <span className="ml-auto px-2 py-0.5 rounded-full bg-[#EEEBFA] text-[#6A62C4] font-bold text-caption" title={t("fromImageTitle")}>
                    {t("fromImage")}
                  </span>
                )}
                <span className={`${f.origin === "vision" ? "" : "ml-auto "}px-2 py-0.5 rounded-full bg-[#FBF4E4] text-[#8A6D1F] font-bold text-caption`}>
                  {t("confidence", { value: formatPercent(f.confidence) })}
                </span>
              </div>
              <textarea
                aria-label={t("valueAria", { label })}
                value={text}
                rows={Math.min(4, Math.max(1, Math.ceil(text.length / 80)))}
                onChange={(e) => setEdits((prev) => ({ ...prev, [key]: e.target.value }))}
                className="w-full px-2.5 py-1.5 rounded-[8px] border border-[#E4E1DC] bg-[#FAF9F7] text-body font-mono"
              />
              <div className="text-caption text-[#A8A49C]">
                <span title={f.source_block_ids.join(", ")}>
                  {f.source_block_ids.length ? t("source", { count: f.source_block_ids.length }) : t("sourceNone")}
                </span>{" "}
                · {ORIGINS.includes(f.origin) ? t(`origin.${f.origin}`) : f.origin}
                {changed && <strong className="text-[#6A62C4]"> · {t("edited")}</strong>}
              </div>
            </li>
          );
        })}
      </ul>
      <div className="flex justify-end">
        <button
          type="button"
          onClick={submit}
          disabled={busy}
          className="px-5 py-2.5 rounded-[10px] btn-gradient-primary text-white text-body font-bold disabled:opacity-50 cursor-pointer"
        >
          {busy ? t("saving") : t("submit")}
        </button>
      </div>
    </div>
  );
}
