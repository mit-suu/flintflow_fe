"use client";

import { useState } from "react";
import type { RocChangeType, RocRow } from "@/types/document";

interface RecordOfChangesCardProps {
  rows: RocRow[];
  /** Số dòng BE đọc được từ file (0 ⇒ không tìm thấy bảng). */
  fromFile: number;
  onChange: (rows: RocRow[]) => void;
  disabled?: boolean;
}

const CHANGE_TYPES: { value: RocChangeType; label: string }[] = [
  { value: "A", label: "Thêm (A)" },
  { value: "M", label: "Sửa (M)" },
  { value: "D", label: "Xoá (D)" },
];

/** Số dòng hiện khi thu gọn — file FlintFlow xuất ra có thể hàng trăm dòng lịch sử. */
const COLLAPSED_ROWS = 5;

const EMPTY_ROW: RocRow = { date: "", version: "", change_type: "M", in_charge: "", description: "" };

const inputClass = "w-full px-2 py-1 rounded-[6px] border border-[#E4E1DC] bg-[#FAF9F7] text-[12px] disabled:opacity-60";

/**
 * Record of Changes của file upload (FLF-252): BE đọc bảng lịch sử thay đổi lúc tách file, người dùng xem / sửa / thêm /
 * xoá dòng trước khi tạo baseline 0.0. Các dòng in lên đầu bảng §I, lịch sử của FlintFlow nối tiếp.
 */
export default function RecordOfChangesCard({ rows, fromFile, onChange, disabled = false }: RecordOfChangesCardProps) {
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? rows : rows.slice(0, COLLAPSED_ROWS);
  const update = (index: number, patch: Partial<RocRow>) => onChange(rows.map((r, i) => (i === index ? { ...r, ...patch } : r)));

  return (
    <div className="bg-white border border-[#ECEAE5] rounded-[14px] p-4 flex flex-col gap-3">
      <div>
        <h4 className="font-bold text-[#191817] text-[13.5px]">Record of Changes của file</h4>
        <p className="text-[12px] text-[#8A867E] leading-relaxed">
          {fromFile > 0
            ? `Đọc được ${fromFile} dòng lịch sử thay đổi từ file. Sửa nếu đọc sai — các dòng này in lên đầu bảng Record of Changes, lịch sử của FlintFlow nối tiếp phía sau.`
            : "Không tìm thấy bảng Record of Changes trong file. Có thể thêm dòng tay, hoặc để trống — bảng chỉ có lịch sử của FlintFlow."}
        </p>
      </div>

      {rows.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead className="text-left text-[#8A867E]">
              <tr>
                <th className="px-1 py-1 font-bold w-[110px]">Ngày</th>
                <th className="px-1 py-1 font-bold w-[80px]">Phiên bản</th>
                <th className="px-1 py-1 font-bold w-[96px]">Loại</th>
                <th className="px-1 py-1 font-bold w-[130px]">Người thực hiện</th>
                <th className="px-1 py-1 font-bold">Mô tả thay đổi</th>
                <th className="w-[36px]" />
              </tr>
            </thead>
            <tbody>
              {shown.map((r, i) => (
                <tr key={i} className="align-top">
                  <td className="px-1 py-1">
                    <input aria-label={`Ngày dòng ${i + 1}`} value={r.date} disabled={disabled} onChange={(e) => update(i, { date: e.target.value })} className={inputClass} />
                  </td>
                  <td className="px-1 py-1">
                    <input aria-label={`Phiên bản dòng ${i + 1}`} value={r.version} disabled={disabled} onChange={(e) => update(i, { version: e.target.value })} className={inputClass} />
                  </td>
                  <td className="px-1 py-1">
                    <select
                      aria-label={`Loại thay đổi dòng ${i + 1}`}
                      value={r.change_type}
                      disabled={disabled}
                      onChange={(e) => update(i, { change_type: e.target.value as RocChangeType })}
                      className={inputClass}
                    >
                      {CHANGE_TYPES.map((t) => (
                        <option key={t.value} value={t.value}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-1 py-1">
                    <input aria-label={`Người thực hiện dòng ${i + 1}`} value={r.in_charge} disabled={disabled} onChange={(e) => update(i, { in_charge: e.target.value })} className={inputClass} />
                  </td>
                  <td className="px-1 py-1">
                    <textarea
                      aria-label={`Mô tả dòng ${i + 1}`}
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
                      aria-label={`Xoá dòng ${i + 1}`}
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

      <div className="flex flex-wrap items-center gap-3 text-[12px]">
        <button type="button" disabled={disabled} onClick={() => onChange([...rows, { ...EMPTY_ROW }])} className="font-bold text-[#6A62C4] hover:opacity-75 disabled:opacity-40">
          + Thêm dòng
        </button>
        {rows.length > COLLAPSED_ROWS && (
          <button type="button" onClick={() => setExpanded((v) => !v)} className="font-bold text-[#4B4842] underline">
            {expanded ? "Thu gọn" : `Hiện tất cả ${rows.length} dòng`}
          </button>
        )}
      </div>
    </div>
  );
}
