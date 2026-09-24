"use client";

import type { BlockChange, BlockDiffEntry, BlockDiffSummary } from "@/types/import";

const CHANGE_STYLE: Record<BlockChange, { label: string; className: string }> = {
  added: { label: "Thêm", className: "bg-[#E9F7EE] text-[#1F7A45]" },
  removed: { label: "Xoá", className: "bg-[#FDEDED] text-[#B03030]" },
  modified: { label: "Sửa", className: "bg-[#FBF4E4] text-[#8A6D1F]" },
  moved: { label: "Di chuyển", className: "bg-[#EEF1FB] text-[#3B4FA8]" },
};

export const summaryText = (s: BlockDiffSummary) =>
  `${s.added} thêm · ${s.removed} xoá · ${s.modified} sửa · ${s.moved} di chuyển`;

/** Khác biệt theo block — dùng cho so sánh 2 version (UC-55) và kết quả re-upload (UC-24). */
export default function BlockDiffList({ entries }: { entries: BlockDiffEntry[] }) {
  if (entries.length === 0) return <p className="text-[12.5px] text-[#8A867E]">Không có khác biệt.</p>;
  return (
    <ul className="flex flex-col gap-2">
      {entries.map((e, i) => {
        const style = CHANGE_STYLE[e.change];
        return (
          <li key={`${e.block_id ?? "new"}-${i}`} className="bg-white border border-[#ECEAE5] rounded-[10px] px-3 py-2 text-[12.5px] flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <span className={`px-2 py-0.5 rounded-full text-[10.5px] font-bold ${style.className}`}>{style.label}</span>
            </div>
            {e.before !== undefined && e.change !== "added" && (
              <del className="text-[#B03030] whitespace-pre-wrap">{e.before}</del>
            )}
            {e.after !== undefined && e.change !== "removed" && <ins className="text-[#1F7A45] no-underline whitespace-pre-wrap">{e.after}</ins>}
          </li>
        );
      })}
    </ul>
  );
}
