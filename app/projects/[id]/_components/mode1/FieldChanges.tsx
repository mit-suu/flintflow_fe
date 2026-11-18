"use client";

import { useTranslations } from "next-intl";
import { useMode1Labels } from "./i18n";

/** Thay đổi của phần tử Spine theo field: giá trị cũ gạch đỏ, giá trị mới gạch chân xanh (FLF-186). */
export default function FieldChanges({ oldText, newText }: { oldText: string; newText: string | null }) {
  const t = useTranslations("mode1.fieldChanges");
  const { fieldChanges, fieldLabel } = useMode1Labels();
  const changes = fieldChanges(oldText, newText);
  if (!newText) return null;
  if (changes.length === 0) return <p className="text-body text-[#8A867E] italic">{t("none")}</p>;
  return (
    <ul className="flex flex-col gap-1 text-body" aria-label={t("aria")}>
      {changes.map((c) => (
        <li key={c.field} className="flex flex-wrap items-start gap-1.5">
          <span className="text-caption font-bold text-[#6B6862] shrink-0" title={c.field}>
            {fieldLabel(c.field)}
          </span>
          <del className="text-[#B03030] bg-[#FDEDED] px-1 rounded whitespace-pre-wrap">{c.before}</del>
          <span className="text-[#A8A49C]">→</span>
          <ins className="text-[#1F7A45] bg-[#E9F7EE] px-1 rounded underline whitespace-pre-wrap">{c.after}</ins>
        </li>
      ))}
    </ul>
  );
}
