"use client";

import { fieldChanges } from "./value-diff";

/** Thay đổi của phần tử Spine theo field: giá trị cũ gạch đỏ, giá trị mới gạch chân xanh (FLF-186). */
export default function FieldChanges({ oldText, newText }: { oldText: string; newText: string | null }) {
  const changes = fieldChanges(oldText, newText);
  if (!newText) return null;
  if (changes.length === 0) return <p className="text-[11.5px] text-[#8A867E] italic">Không có field nào đổi.</p>;
  return (
    <ul className="flex flex-col gap-1 text-[12px]" aria-label="Thay đổi theo field">
      {changes.map((c) => (
        <li key={c.field} className="flex flex-wrap items-start gap-1.5">
          <code className="text-[10.5px] font-bold text-[#6B6862] shrink-0">{c.field}</code>
          <del className="text-[#B03030] bg-[#FDEDED] px-1 rounded whitespace-pre-wrap">{c.before}</del>
          <span className="text-[#A8A49C]">→</span>
          <ins className="text-[#1F7A45] bg-[#E9F7EE] px-1 rounded underline whitespace-pre-wrap">{c.after}</ins>
        </li>
      ))}
    </ul>
  );
}
