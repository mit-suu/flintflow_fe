"use client";

import type { DocBlock } from "@/types/import";

/** Track Changes do CR ghi (bản draft): đoạn xoá gạch đỏ, đoạn chèn gạch chân xanh, kèm tác giả (CR id). */
export const Revisions = ({ revisions }: { revisions: NonNullable<DocBlock["revisions"]> }) => (
  <div className="mt-1 flex flex-col gap-0.5 text-[12px]" aria-label="Track Changes">
    {revisions.map((r, i) => (
      <div key={`${r.kind}-${i}`} className="flex items-start gap-2">
        <span className="text-[10.5px] font-bold text-[#6B6862] shrink-0 w-[58px]">{r.author}</span>
        {r.kind === "del" ? (
          <del className="text-[#B03030] bg-[#FDEDED] px-1 rounded">{r.text}</del>
        ) : (
          <ins className="text-[#1F7A45] bg-[#E9F7EE] px-1 rounded underline">{r.text}</ins>
        )}
      </div>
    ))}
  </div>
);
