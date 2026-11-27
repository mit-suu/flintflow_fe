"use client";

import { useTranslations } from "next-intl";
import BlockDiff, { textChange } from "./BlockDiff";
import { useMode1Labels } from "./i18n";

/** Thay đổi của phần tử Spine theo field (FLF-186): mỗi field một nhãn + đoạn thay đổi kiểu so sánh version (chỉ tô từ đổi). */
export default function FieldChanges({ oldText, newText }: { oldText: string; newText: string | null }) {
  const t = useTranslations("mode1.fieldChanges");
  const { fieldChanges, fieldLabel } = useMode1Labels();
  const changes = fieldChanges(oldText, newText);
  if (!newText) return null;
  if (changes.length === 0) return <p className="text-body text-on-surface-muted italic">{t("none")}</p>;
  return (
    <ul className="flex flex-col gap-2 text-body" aria-label={t("aria")}>
      {changes.map((c) => (
        <li key={c.field} className="flex flex-col gap-1">
          <span className="text-caption font-bold text-on-surface-variant" title={c.field}>
            {fieldLabel(c.field)}
          </span>
          <BlockDiff entry={textChange(c.before, c.after)} />
        </li>
      ))}
    </ul>
  );
}
