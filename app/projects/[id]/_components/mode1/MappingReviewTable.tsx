"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { FPT_SECTIONS, isProvisionalSection } from "@/lib/constants/fpt-sections";
import { CONTENT_SLOTS, isContentSlot, slotOverlaps } from "@/lib/constants/content-slots";
import { MAPPING_CONFIDENCE_THRESHOLD, UNMAPPED_SECTION, type MappingPatchRequest, type TemplateProfile } from "@/types/import";
import { useMode1Labels } from "./i18n";
import { formatPercent } from "./labels";
import { TABLE_FIELD_GROUPS, entityOfPath, isKnownTableField, tableFieldPath } from "./table-fields";

interface MappingReviewTableProps {
  profile: TemplateProfile;
  onSubmit: (body: Omit<MappingPatchRequest, "import_id">) => void;
  busy?: boolean;
}

const tableKey = (blockId: string, column: number) => `${blockId}:${column}`;

const ConfidenceBadge = ({ value }: { value: number }) => (
  <span
    className={`px-2 py-0.5 rounded-full text-caption font-bold ${
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
  const t = useTranslations("mode1.mappingReview");
  const L = useMode1Labels();
  const lowCount = profile.heading_map.filter((h) => h.confidence < MAPPING_CONFIDENCE_THRESHOLD).length;
  const [lowOnly, setLowOnly] = useState(lowCount > 0);
  const [headings, setHeadings] = useState<Record<string, string>>({});
  const [tables, setTables] = useState<Record<string, string | null>>({});

  // Section tạm feature/function do BE sinh + section chuẩn + "không khớp"
  const options = useMemo(() => {
    const extra = profile.heading_map
      .map((h) => h.section_id)
      .filter((id, i, all) => id !== UNMAPPED_SECTION && !isContentSlot(id) && !FPT_SECTIONS.some((s) => s.id === id) && all.indexOf(id) === i);
    return [...FPT_SECTIONS.map((s) => s.id), ...extra, UNMAPPED_SECTION];
  }, [profile.heading_map]);
  // FLF-278: phần nhỏ của một mục (mẫu chia nhỏ hơn FlintFlow) — nhóm riêng trong ô chọn
  const slotOptions = CONTENT_SLOTS.map((s) => s.id as string);
  const hasProvisional = options.some(isProvisionalSection);

  const columnValue = (blockId: string, column: number, suggested: string | null) => {
    const key = tableKey(blockId, column);
    return key in tables ? tables[key] : suggested;
  };

  // BE trích mỗi bảng theo thực thể của cột đầu tiên được gán (extract.service `deterministicTableItems`)
  const tableEntity: Record<string, string> = {};
  for (const col of profile.table_map) {
    const entity = entityOfPath(columnValue(col.block_id, col.column_index, col.field_path));
    if (entity && !(col.block_id in tableEntity)) tableEntity[col.block_id] = entity;
  }

  // Section tạm (`feature:@B0007`) ⇒ ghi rõ tính năng / chức năng nào: lấy tiêu đề heading sinh ra nó
  const optionLabel = (id: string) => L.sectionLabelIn(id, profile.heading_map);

  // Nhiều heading cùng trích vào một mục FPT (mẫu IEEE: Reliability + Availability) ⇒ báo cho người dùng biết
  const sectionOf = (blockId: string, suggested: string) => headings[blockId] ?? suggested;
  const sharing = (blockId: string, section: string): string[] =>
    section.startsWith("fixed:")
      ? profile.heading_map.filter((o) => o.block_id !== blockId && sectionOf(o.block_id, o.section_id) === section).map((o) => o.heading_text)
      : [];

  // Phần nhỏ và mục FPT chứa nó cùng có heading ⇒ in hai lần (BE từ chối) — báo ngay ở cả hai dòng, khoá nút lưu
  const overlapWith = new Map<string, string>();
  for (const [section, slot] of slotOverlaps(profile.heading_map.map((h) => sectionOf(h.block_id, h.section_id)))) {
    for (const h of profile.heading_map) {
      const v = sectionOf(h.block_id, h.section_id);
      if (v === section) overlapWith.set(h.block_id, slot);
      if (v === slot) overlapWith.set(h.block_id, section);
    }
  }

  const rows = lowOnly ? profile.heading_map.filter((h) => h.confidence < MAPPING_CONFIDENCE_THRESHOLD) : profile.heading_map;

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
          <h3 className="font-extrabold text-[#191817] text-heading">{t("title")}</h3>
          <p className="text-body text-[#8A867E]">
            {t("summary", { headings: profile.heading_map.length, low: lowCount, threshold: formatPercent(MAPPING_CONFIDENCE_THRESHOLD) })}
          </p>
          {hasProvisional && <p className="text-body text-[#8A867E]">{t("provisionalHint")}</p>}
          <p className="text-body text-[#4B4842]">
            {/* Họ mẫu nhận được (FLF-252) */}
            {t.rich("family", { family: profile.template_family ?? "fpt", strong: (c) => <strong>{c}</strong> })}
            {profile.template_family && profile.template_family !== "fpt" ? ` — ${t("familyNote")}` : ""}
          </p>
        </div>
        <label className="flex items-center gap-2 text-body font-semibold text-[#4B4842] cursor-pointer">
          <input type="checkbox" checked={lowOnly} onChange={(e) => setLowOnly(e.target.checked)} />
          {t("lowOnly")}
        </label>
      </div>

      <div className="bg-white border border-[#ECEAE5] rounded-[14px] overflow-hidden">
        <table className="w-full text-body">
          <thead className="bg-[#FAF9F7] text-[#8A867E] text-left">
            <tr>
              <th className="px-3 py-2 font-bold">{t("colHeading")}</th>
              <th className="px-3 py-2 font-bold w-[90px]">{t("colConfidence")}</th>
              <th className="px-3 py-2 font-bold w-[300px]">{t("colSection")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={3} className="px-3 py-4 text-center text-[#8A867E]">
                  {t("noLowRows")}
                </td>
              </tr>
            )}
            {rows.map((h) => {
              const value = sectionOf(h.block_id, h.section_id);
              const shared = sharing(h.block_id, value);
              return (
                <tr key={h.block_id} className="border-t border-[#F0EEEA]">
                  <td className="px-3 py-2">
                    <div className="font-semibold text-[#191817]">{h.heading_text}</div>
                    {h.guidance && <div className="text-caption text-[#6B6862] line-clamp-2">{t("guidance", { text: h.guidance })}</div>}
                    {overlapWith.has(h.block_id) && (
                      <div role="alert" className="text-caption text-[#B03030]">
                        {t("overlap", { section: L.sectionLabel(overlapWith.get(h.block_id)!) })}
                      </div>
                    )}
                    <div className="text-caption text-[#A8A49C]">
                      {t("detectedBy", { by: h.detected_by })}
                      {h.template_section && value === UNMAPPED_SECTION ? ` · ${t("templateOwnSection")}` : ""}
                    </div>
                    {shared.length > 0 && (
                      <div className="text-caption text-[#8A6D1F]">
                        {t("sharedSection", { section: L.sectionLabel(value), others: shared.join(", ") })}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <ConfidenceBadge value={h.confidence} />
                  </td>
                  <td className="px-3 py-2">
                    <select
                      aria-label={t("sectionAria", { heading: h.heading_text })}
                      value={value}
                      onChange={(e) => setHeadings((prev) => ({ ...prev, [h.block_id]: e.target.value }))}
                      className={`w-full px-2 py-1.5 rounded-[8px] border bg-[#FAF9F7] text-body ${
                        headings[h.block_id] ? "border-[#6A62C4]" : "border-[#E4E1DC]"
                      }`}
                    >
                      <optgroup label={t("sectionsGroup")}>
                        {options.filter((id) => id !== UNMAPPED_SECTION).map((id) => (
                          <option key={id} value={id}>
                            {optionLabel(id)}
                          </option>
                        ))}
                      </optgroup>
                      <optgroup label={t("slotsGroup")}>
                        {slotOptions.map((id) => (
                          <option key={id} value={id}>
                            {optionLabel(id)}
                          </option>
                        ))}
                      </optgroup>
                      {/* "Không khớp" luôn cuối danh sách */}
                      <option value={UNMAPPED_SECTION}>{optionLabel(UNMAPPED_SECTION)}</option>
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
            <div className="text-body font-bold text-[#4B4842]">{t("tablesTitle")}</div>
            <p className="text-body text-[#8A867E]">{t("tablesHint")}</p>
          </div>
          <table className="w-full text-body">
            <tbody>
              {profile.table_map.map((col) => {
                const key = tableKey(col.block_id, col.column_index);
                const value = columnValue(col.block_id, col.column_index, col.field_path);
                const header = col.header.trim() || t("untitledColumn", { n: col.column_index + 1 });
                const entity = tableEntity[col.block_id];
                const valueEntity = entityOfPath(value);
                const known = !value || isKnownTableField(value);
                // Nhóm cùng loại với bảng lên đầu
                const groups = entity ? [...TABLE_FIELD_GROUPS].sort((a, b) => Number(b.entity === entity) - Number(a.entity === entity)) : TABLE_FIELD_GROUPS;
                return (
                  <tr key={key} className="border-t border-[#F0EEEA]">
                    <td className="px-3 py-2">
                      <div className="font-semibold text-[#191817]">{header}</div>
                      <div className="text-caption text-[#A8A49C]">
                        {entity ? t("tableOf", { group: L.tableGroupLabel(entity) }) : t("tableUnknown")} · {t("columnN", { n: col.column_index + 1 })}
                      </div>
                      {col.samples?.length ? (
                        <div className="text-caption text-[#8A867E] truncate max-w-[340px]" title={col.samples.join(" · ")}>
                          {t("samples", { samples: col.samples.join(" · ") })}
                          {col.role ? ` — ${L.columnRoleLabel(col.role)}` : ""}
                        </div>
                      ) : null}
                      {valueEntity && entity && valueEntity !== entity && <div className="text-caption text-[#8A6D1F]">{t("mixedEntity")}</div>}
                    </td>
                    <td className="px-3 py-2 w-[90px]">
                      <ConfidenceBadge value={col.confidence} />
                    </td>
                    <td className="px-3 py-2 w-[300px]">
                      <select
                        aria-label={t("columnAria", { header })}
                        value={value ?? ""}
                        onChange={(e) => setTables((prev) => ({ ...prev, [key]: e.target.value || null }))}
                        className={`w-full px-2 py-1.5 rounded-[8px] border bg-[#FAF9F7] text-body ${
                          key in tables ? "border-[#6A62C4]" : "border-[#E4E1DC]"
                        }`}
                      >
                        <option value="">{t("skipColumn")}</option>
                        {groups.map((g) => (
                          <optgroup key={g.entity} label={L.tableGroupLabel(g.entity)}>
                            {g.fields.map((f) => {
                              const path = tableFieldPath(g.entity, f);
                              return (
                                <option key={path} value={path}>
                                  {L.tableFieldLabel(path)}
                                </option>
                              );
                            })}
                          </optgroup>
                        ))}
                        {!known && value && (
                          <optgroup label={t("otherGroup")}>
                            <option value={value}>{L.tableFieldLabel(value)}</option>
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

      <div className="flex flex-wrap items-center justify-end gap-3">
        {overlapWith.size > 0 && (
          <span role="status" className="text-body text-[#B03030]">
            {t("overlapBlocked")}
          </span>
        )}
        <button
          type="button"
          onClick={submit}
          disabled={busy || overlapWith.size > 0}
          className="px-5 py-2.5 rounded-[10px] btn-gradient-primary text-white text-body font-bold disabled:opacity-50 cursor-pointer"
        >
          {busy ? t("saving") : t("submit")}
        </button>
      </div>
    </div>
  );
}
