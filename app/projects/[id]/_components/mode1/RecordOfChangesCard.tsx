"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import type { RocChangeType, RocRow } from "@/types/document";

interface RecordOfChangesCardProps {
  rows: RocRow[];
  /** Số dòng BE đọc được từ file (0 ⇒ không tìm thấy bảng). */
  fromFile: number;
  onChange: (rows: RocRow[]) => void;
  disabled?: boolean;
}

const CHANGE_TYPES: readonly RocChangeType[] = ["A", "M", "D"];

/** Số dòng hiện khi thu gọn — file FlintFlow xuất ra có thể hàng trăm dòng lịch sử. */
const COLLAPSED_ROWS = 5;

const EMPTY_ROW: RocRow = { date: "", version: "", change_type: "M", in_charge: "", description: "" };

const inputClass = "w-full px-2 py-1 rounded-[6px] border border-[#E4E1DC] bg-[#FAF9F7] text-body disabled:opacity-60";

/**
 * Record of Changes của file upload (FLF-252): BE đọc bảng lịch sử thay đổi lúc tách file, người dùng xem / sửa / thêm /
 * xoá dòng trước khi tạo baseline 0.0. Các dòng in lên đầu bảng §I, lịch sử của FlintFlow nối tiếp.
 */
export default function RecordOfChangesCard({ rows, fromFile, onChange, disabled = false }: RecordOfChangesCardProps) {
  const t = useTranslations("mode1.rocCard");
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? rows : rows.slice(0, COLLAPSED_ROWS);
  const update = (index: number, patch: Partial<RocRow>) => onChange(rows.map((r, i) => (i === index ? { ...r, ...patch } : r)));

  return (
    <div className="bg-white border border-[#ECEAE5] rounded-[14px] p-4 flex flex-col gap-3">
      <div>
        <h4 className="font-bold text-[#191817] text-body">{t("title")}</h4>
        <p className="text-body text-[#8A867E] leading-relaxed">{fromFile > 0 ? t("fromFile", { count: fromFile }) : t("noTable")}</p>
      </div>

      {rows.length > 0 && (
        <div className="ff-scroll overflow-x-auto">
          <table className="w-full text-body">
            <thead className="text-left text-[#8A867E]">
              <tr>
                <th className="px-1 py-1 font-bold w-[110px]">{t("columns.date")}</th>
                <th className="px-1 py-1 font-bold w-[80px]">{t("columns.version")}</th>
                <th className="px-1 py-1 font-bold w-[96px]">{t("columns.type")}</th>
                <th className="px-1 py-1 font-bold w-[130px]">{t("columns.inCharge")}</th>
                <th className="px-1 py-1 font-bold">{t("columns.description")}</th>
                <th className="w-[36px]" />
              </tr>
            </thead>
            <tbody>
              {shown.map((r, i) => (
                <tr key={i} className="align-top">
                  <td className="px-1 py-1">
                    <input aria-label={t("rowAria.date", { row: i + 1 })} value={r.date} disabled={disabled} onChange={(e) => update(i, { date: e.target.value })} className={inputClass} />
                  </td>
                  <td className="px-1 py-1">
                    <input aria-label={t("rowAria.version", { row: i + 1 })} value={r.version} disabled={disabled} onChange={(e) => update(i, { version: e.target.value })} className={inputClass} />
                  </td>
                  <td className="px-1 py-1">
                    <select
                      aria-label={t("rowAria.type", { row: i + 1 })}
                      value={r.change_type}
                      disabled={disabled}
                      onChange={(e) => update(i, { change_type: e.target.value as RocChangeType })}
                      className={inputClass}
                    >
                      {CHANGE_TYPES.map((type) => (
                        <option key={type} value={type}>
                          {t(`types.${type}`)}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-1 py-1">
                    <input aria-label={t("rowAria.inCharge", { row: i + 1 })} value={r.in_charge} disabled={disabled} onChange={(e) => update(i, { in_charge: e.target.value })} className={inputClass} />
                  </td>
                  <td className="px-1 py-1">
                    <textarea
                      aria-label={t("rowAria.description", { row: i + 1 })}
                      value={r.description}
                      disabled={disabled}
                      rows={Math.min(3, Math.max(1, Math.ceil(r.description.length / 70)))}
                      onChange={(e) => update(i, { description: e.target.value })}
                      className={inputClass}
                    />
                  </td>
                  <td className="px-1 py-1 text-center">
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => onChange(rows.filter((_, k) => k !== i))}
                      className="text-[#B03030] font-bold hover:opacity-75 disabled:opacity-40"
                      aria-label={t("rowAria.remove", { row: i + 1 })}
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3 text-body">
        <button type="button" disabled={disabled} onClick={() => onChange([...rows, { ...EMPTY_ROW }])} className="font-bold text-[#6A62C4] hover:opacity-75 disabled:opacity-40">
          {t("addRow")}
        </button>
        {rows.length > COLLAPSED_ROWS && (
          <button type="button" onClick={() => setExpanded((v) => !v)} className="font-bold text-[#4B4842] underline">
            {expanded ? t("collapse") : t("showAll", { count: rows.length })}
          </button>
        )}
      </div>
    </div>
  );
}
