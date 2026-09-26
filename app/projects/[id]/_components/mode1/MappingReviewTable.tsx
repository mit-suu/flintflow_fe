"use client";

import { useMemo, useState } from "react";
import { FPT_SECTIONS, sectionLabel } from "@/lib/constants/fpt-sections";
import { MAPPING_CONFIDENCE_THRESHOLD, UNMAPPED_SECTION, type MappingPatchRequest, type TemplateProfile } from "@/types/import";
import { formatPercent } from "./labels";
import { TABLE_FIELD_GROUPS, entityOfPath, tableFieldLabel, tableFieldPath, tableGroupLabel } from "./table-fields";

interface MappingReviewTableProps {
  profile: TemplateProfile;
  onSubmit: (body: Omit<MappingPatchRequest, "import_id">) => void;
  busy?: boolean;
}

const DETECTOR_LABELS = {
  style: "style heading",
  outline_level: "outline level",
  numbering_pattern: "số mục",
  user: "bạn chọn",
} as const;

const tableKey = (blockId: string, column: number) => `${blockId}:${column}`;

const ConfidenceBadge = ({ value }: { value: number }) => (
  <span
    className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
      value < MAPPING_CONFIDENCE_THRESHOLD ? "bg-[#FDEDED] text-[#B03030]" : "bg-[#E9F7EE] text-[#1F7A45]"
    }`}
  >
    {formatPercent(value)}
  </span>
);

/**
 * 1.7 Xác nhận mapping (UC-21): heading → section template FPT, cột bảng → field Spine (chọn theo nhãn). Mặc định chỉ hiện
 * dòng độ tin < 80%; gửi các dòng đã đổi kèm `confirm_all` để chốt cả phần còn lại như BE đề xuất.
 */
export default function MappingReviewTable({ profile, onSubmit, busy = false }: MappingReviewTableProps) {
  const lowCount = profile.heading_map.filter((h) => h.confidence < MAPPING_CONFIDENCE_THRESHOLD).length;
  const [lowOnly, setLowOnly] = useState(lowCount > 0);
  const [headings, setHeadings] = useState<Record<string, string>>({});
  const [tables, setTables] = useState<Record<string, string | null>>({});

  // Section tạm feature/function do BE sinh + section chuẩn + "không khớp"
  const options = useMemo(() => {
    const extra = profile.heading_map
      .map((h) => h.section_id)
      .filter((id, i, all) => id !== UNMAPPED_SECTION && !FPT_SECTIONS.some((s) => s.id === id) && all.indexOf(id) === i);
    return [...FPT_SECTIONS.map((s) => s.id), ...extra, UNMAPPED_SECTION];
  }, [profile.heading_map]);

  const columnValue = (blockId: string, column: number, suggested: string | null) => {
    const key = tableKey(blockId, column);
    return key in tables ? tables[key] : suggested;
  };

  // BE trích mỗi bảng theo thực thể của cột đầu tiên được gán (extract.service `deterministicTableItems`)
  const tableEntity: Record<string, string> = {};
  for (const t of profile.table_map) {
    const entity = entityOfPath(columnValue(t.block_id, t.column_index, t.field_path));
    if (entity && !(t.block_id in tableEntity)) tableEntity[t.block_id] = entity;
  }

  const rows = lowOnly ? profile.heading_map.filter((h) => h.confidence < MAPPING_CONFIDENCE_THRESHOLD) : profile.heading_map;
  const missingRequired = profile.required_sections.filter(
    (id) => !profile.heading_map.some((h) => (headings[h.block_id] ?? h.section_id) === id)
  );

  const submit = () =>
    onSubmit({
      headings: Object.entries(headings).map(([block_id, section_id]) => ({ block_id, section_id })),
      tables: Object.entries(tables).map(([key, field_path]) => {
        const [block_id, column] = key.split(":");
        return { block_id, column_index: Number(column), field_path };
      }),
      confirm_all: true,
    });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-extrabold text-[#191817] text-[15px]">Xác nhận mapping heading → section</h3>
          <p className="text-[12px] text-[#8A867E]">
            {profile.heading_map.length} heading, {lowCount} dòng độ tin dưới {formatPercent(MAPPING_CONFIDENCE_THRESHOLD)}. Heading
            “không khớp” được giữ nguyên văn và không trích field.
          </p>
        </div>
        <label className="flex items-center gap-2 text-[12px] font-semibold text-[#4B4842] cursor-pointer">
          <input type="checkbox" checked={lowOnly} onChange={(e) => setLowOnly(e.target.checked)} />
          Chỉ hiện dòng độ tin thấp
        </label>
      </div>

      <div className="bg-white border border-[#ECEAE5] rounded-[14px] overflow-hidden">
        <table className="w-full text-[12.5px]">
          <thead className="bg-[#FAF9F7] text-[#8A867E] text-left">
            <tr>
              <th className="px-3 py-2 font-bold">Heading trong tài liệu</th>
              <th className="px-3 py-2 font-bold w-[90px]">Độ tin</th>
              <th className="px-3 py-2 font-bold w-[300px]">Section</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={3} className="px-3 py-4 text-center text-[#8A867E]">
                  Không có dòng độ tin thấp — kiểm nhanh rồi bấm xác nhận.
                </td>
              </tr>
            )}
            {rows.map((h) => {
              const value = headings[h.block_id] ?? h.section_id;
              return (
                <tr key={h.block_id} className="border-t border-[#F0EEEA]">
                  <td className="px-3 py-2">
                    <div className="font-semibold text-[#191817]">{h.heading_text}</div>
                    <div className="text-[11px] text-[#A8A49C]">
                      {h.block_id} · nhận theo {DETECTOR_LABELS[h.detected_by]}
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <ConfidenceBadge value={h.confidence} />
                  </td>
                  <td className="px-3 py-2">
                    <select
                      aria-label={`Section cho ${h.heading_text}`}
                      value={value}
                      onChange={(e) => setHeadings((prev) => ({ ...prev, [h.block_id]: e.target.value }))}
                      className={`w-full px-2 py-1.5 rounded-[8px] border bg-[#FAF9F7] text-[12.5px] ${
                        headings[h.block_id] ? "border-[#6A62C4]" : "border-[#E4E1DC]"
                      }`}
                    >
                      {options.map((id) => (
                        <option key={id} value={id}>
                          {sectionLabel(id)}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {profile.table_map.length > 0 && (
        <div className="bg-white border border-[#ECEAE5] rounded-[14px] overflow-hidden">
          <div className="px-3 py-2 bg-[#FAF9F7]">
            <div className="text-[12.5px] font-bold text-[#4B4842]">Cột trong bảng → dữ liệu SRS</div>
            <p className="text-[11.5px] text-[#8A867E]">
              Bảng có đủ cột cần thiết được lấy tự động, không tốn credit. Mỗi bảng chỉ lấy một loại dữ liệu — chọn “Không lấy cột
              này” nếu cột không chứa dữ liệu cần trích.
            </p>
          </div>
          <table className="w-full text-[12.5px]">
            <tbody>
              {profile.table_map.map((t) => {
                const key = tableKey(t.block_id, t.column_index);
                const value = columnValue(t.block_id, t.column_index, t.field_path);
                const header = t.header.trim() || `Cột ${t.column_index + 1} (không có tiêu đề)`;
                const entity = tableEntity[t.block_id];
                const valueEntity = entityOfPath(value);
                const known = !value || tableFieldLabel(value) !== value;
                // Nhóm cùng loại với bảng lên đầu
                const groups = entity ? [...TABLE_FIELD_GROUPS].sort((a, b) => Number(b.entity === entity) - Number(a.entity === entity)) : TABLE_FIELD_GROUPS;
                return (
                  <tr key={key} className="border-t border-[#F0EEEA]">
                    <td className="px-3 py-2">
                      <div className="font-semibold text-[#191817]">{header}</div>
                      <div className="text-[11px] text-[#A8A49C]">
                        {entity ? `Bảng ${tableGroupLabel(entity)}` : "Bảng chưa rõ loại"} · cột {t.column_index + 1}
                      </div>
                      {valueEntity && entity && valueEntity !== entity && (
                        <div className="text-[11px] text-[#8A6D1F]">Khác loại với các cột khác của bảng — cột này sẽ không được lấy.</div>
                      )}
                    </td>
                    <td className="px-3 py-2 w-[90px]">
                      <ConfidenceBadge value={t.confidence} />
                    </td>
                    <td className="px-3 py-2 w-[300px]">
                      <select
                        aria-label={`Dữ liệu cho cột ${header}`}
                        value={value ?? ""}
                        onChange={(e) => setTables((prev) => ({ ...prev, [key]: e.target.value || null }))}
                        className={`w-full px-2 py-1.5 rounded-[8px] border bg-[#FAF9F7] text-[12.5px] ${
                          key in tables ? "border-[#6A62C4]" : "border-[#E4E1DC]"
                        }`}
                      >
                        <option value="">Không lấy cột này</option>
                        {groups.map((g) => (
                          <optgroup key={g.entity} label={g.label}>
                            {g.fields.map((f) => {
                              const path = tableFieldPath(g.entity, f.field);
                              return (
                                <option key={path} value={path}>
                                  {tableFieldLabel(path)}
                                </option>
                              );
                            })}
                          </optgroup>
                        ))}
                        {!known && value && (
                          <optgroup label="Khác">
                            <option value={value}>{value}</option>
                          </optgroup>
                        )}
                      </select>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {missingRequired.length > 0 && (
        <p className="text-[12px] text-[#8A6D1F] bg-[#FBF4E4] border border-[#EFD9A6] rounded-[10px] px-3 py-2">
          Chưa có heading nào cho section bắt buộc: {missingRequired.map(sectionLabel).join(", ")}. Có thể để trống — gap report sẽ
          ghi là thiếu.
        </p>
      )}

      <div className="flex justify-end">
        <button
          type="button"
          onClick={submit}
          disabled={busy}
          className="px-5 py-2.5 rounded-[10px] btn-gradient-primary text-white text-[13px] font-bold disabled:opacity-50 cursor-pointer"
        >
          {busy ? "Đang lưu…" : "Xác nhận mapping"}
        </button>
      </div>
    </div>
  );
}
