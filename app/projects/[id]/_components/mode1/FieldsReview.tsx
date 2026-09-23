"use client";

import { useState } from "react";
import { sectionLabel } from "@/lib/constants/fpt-sections";
import type { FieldsPatchRequest, ReviewField } from "@/types/import";
import { formatPercent } from "./labels";

interface FieldsReviewProps {
  fields: ReviewField[];
  onSubmit: (body: Omit<FieldsPatchRequest, "import_id">) => void;
  busy?: boolean;
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

/**
 * 1.9 Xác nhận field độ tin thấp (UC-22): xem giá trị AI trích, block nguồn, sửa nếu sai. Nội dung field là
 * dữ liệu SRS (tiếng Anh) — FE không dịch.
 */
/** Cách trích của field (BE `ReviewField.origin`). `vision` = Gemini đọc từ ảnh diagram (mode 1 v3 phase 5). */
export const ORIGIN_LABEL: Record<ReviewField["origin"], string> = {
  ai: "AI trích",
  deterministic: "trích tất định",
  vision: "AI đọc từ ảnh",
};

export default function FieldsReview({ fields, onSubmit, busy = false }: FieldsReviewProps) {
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
        <h3 className="font-extrabold text-[#191817] text-[15px]">Xem lại field độ tin thấp</h3>
        <p className="text-[12px] text-[#8A867E]">
          {fields.length} field AI chưa chắc. Sửa giá trị nếu sai; bấm xác nhận để chốt tất cả (field không sửa giữ nguyên như AI trích).
        </p>
        <p className="text-[12px] text-[#8A6D1F]">
          Đây là chỗ sửa duy nhất trước khi chốt baseline v0 — sau đó mọi thay đổi đi qua change request.
        </p>
      </div>
      <ul className="flex flex-col gap-3">
        {fields.map((f) => {
          const key = fieldKey(f);
          const text = edits[key] ?? valueToText(f.value);
          const changed = key in edits && edits[key] !== valueToText(f.value);
          return (
            <li key={key} className={`bg-white border rounded-[14px] p-3 flex flex-col gap-2 ${changed ? "border-[#6A62C4]" : "border-[#ECEAE5]"}`}>
              <div className="flex flex-wrap items-center gap-2 text-[12px]">
                <code className="font-mono font-bold text-[#191817]">{f.path}</code>
                <span className="text-[#8A867E]">· {sectionLabel(f.section_id)}</span>
                {f.origin === "vision" && (
                  <span className="ml-auto px-2 py-0.5 rounded-full bg-[#EEEBFA] text-[#6A62C4] font-bold text-[11px]" title="Đọc từ ảnh diagram trong tài liệu — luôn cần bạn xác nhận">
                    từ ảnh
                  </span>
                )}
                <span className={`${f.origin === "vision" ? "" : "ml-auto "}px-2 py-0.5 rounded-full bg-[#FBF4E4] text-[#8A6D1F] font-bold text-[11px]`}>
                  độ tin {formatPercent(f.confidence)}
                </span>
              </div>
              <textarea
                aria-label={`Giá trị ${f.path}`}
                value={text}
                rows={Math.min(4, Math.max(1, Math.ceil(text.length / 80)))}
                onChange={(e) => setEdits((prev) => ({ ...prev, [key]: e.target.value }))}
                className="w-full px-2.5 py-1.5 rounded-[8px] border border-[#E4E1DC] bg-[#FAF9F7] text-[12.5px] font-mono"
              />
              <div className="text-[11px] text-[#A8A49C]">
                Nguồn: {f.source_block_ids.length ? f.source_block_ids.join(", ") : "—"} · {ORIGIN_LABEL[f.origin] ?? f.origin}
                {changed && <strong className="text-[#6A62C4]"> · đã sửa</strong>}
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
          className="px-5 py-2.5 rounded-[10px] btn-gradient-primary text-white text-[13px] font-bold disabled:opacity-50 cursor-pointer"
        >
          {busy ? "Đang lưu…" : "Xác nhận tất cả field"}
        </button>
      </div>
    </div>
  );
}
