"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import type { DocBlock } from "@/types/import";

interface DocBlockViewProps {
  projectId: string;
  blocks: DocBlock[];
  /** Block cần làm nổi (vd vị trí của CR đang xem). */
  highlight?: ReadonlySet<string>;
}

const HEADING_CLASS: Record<number, string> = {
  1: "text-[18px] font-extrabold mt-5",
  2: "text-[16px] font-extrabold mt-4",
  3: "text-[14.5px] font-bold mt-3",
};

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

const LockBadge = ({ projectId, crId }: { projectId: string; crId: string }) => (
  <Link
    href={`/projects/${projectId}/change-requests/${crId}`}
    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#FBF4E4] border border-[#EFD9A6] text-[#8A6D1F] text-[10.5px] font-bold shrink-0"
    title={`Block đang được ${crId} sửa`}
  >
    <span className="material-symbols-outlined text-[12px]">lock</span>
    {crId}
  </Link>
);

/** Bảng Word: block `table` mang text theo hàng (`ô | ô`, xuống dòng mỗi hàng). */
const TableGrid = ({ text }: { text: string }) => {
  const rows = text.split("\n").map((r) => r.split(" | "));
  return (
    <div className="overflow-x-auto my-2">
      <table className="text-[12.5px] border-collapse">
        <tbody>
          {rows.map((cells, ri) => (
            <tr key={ri} className={ri === 0 ? "bg-[#FAF9F7] font-semibold" : ""}>
              {cells.map((c, ci) => (
                <td key={ci} className="border border-[#E4E1DC] px-2 py-1 align-top whitespace-pre-wrap">
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

/**
 * Tài liệu mode 1 theo block (UC-54) — **chỉ đọc**. Nội dung là văn bản SRS gốc (tiếng Anh), FE không dịch.
 * Ô bảng chỉ hiện riêng khi đang bị khoá hoặc có Track Changes (còn lại đã nằm trong bảng vẽ từ block `table`).
 */
export default function DocBlockView({ projectId, blocks, highlight }: DocBlockViewProps) {
  const out: ReactNode[] = [];
  let afterTable = false;

  for (const b of blocks) {
    const marked = highlight?.has(b.block_id) ?? false;
    const wrap = (content: ReactNode, extra = "") => (
      <div
        key={b.block_id}
        id={`block-${b.block_id}`}
        data-block-id={b.block_id}
        className={`group relative flex gap-2 rounded-[6px] px-2 -mx-2 ${marked ? "bg-[#F4F3FE] ring-1 ring-[#DDD9F6]" : ""} ${extra}`}
      >
        <div className="flex-1 min-w-0">
          {content}
          {b.revisions && b.revisions.length > 0 && <Revisions revisions={b.revisions} />}
        </div>
        {b.locked_by_cr && <LockBadge projectId={projectId} crId={b.locked_by_cr} />}
      </div>
    );

    if (b.kind === "table") {
      afterTable = true;
      out.push(wrap(<TableGrid text={b.text} />));
      continue;
    }
    if (b.kind === "table_cell") {
      if (afterTable && !b.locked_by_cr && !b.revisions?.length && !marked) continue;
      out.push(wrap(<p className="text-[12.5px] text-[#33312D] border-l-2 border-[#E4E1DC] pl-2">Ô bảng: {b.text}</p>));
      continue;
    }
    afterTable = false;

    if (b.kind === "heading") {
      out.push(wrap(<p className={`${HEADING_CLASS[b.level ?? 3] ?? HEADING_CLASS[3]} text-[#191817]`}>{b.text}</p>));
    } else if (b.kind === "list_item") {
      out.push(wrap(<p className="text-[13px] text-[#33312D] leading-relaxed pl-4 before:content-['•'] before:mr-2 before:-ml-3">{b.text}</p>));
    } else if (b.kind === "caption") {
      out.push(wrap(<p className="text-[11.5px] italic text-[#6B6862] text-center">{b.text}</p>));
    } else if (b.kind === "image") {
      out.push(wrap(<p className="text-[11.5px] text-[#8A867E] bg-[#FAF9F7] border border-dashed border-[#E4E1DC] rounded px-2 py-3 text-center">[Hình ảnh]</p>));
    } else if (b.kind === "unsupported") {
      out.push(
        wrap(
          <p className="text-[11.5px] text-[#8A867E] bg-[#FAF9F7] border border-dashed border-[#E4E1DC] rounded px-2 py-2" title="Giữ nguyên từ file gốc, change request không sửa được">
            {b.text || "[Nội dung không hỗ trợ]"} · giữ nguyên, không sửa qua CR
          </p>
        )
      );
    } else {
      out.push(wrap(<p className="text-[13px] text-[#33312D] leading-relaxed whitespace-pre-wrap">{b.text}</p>));
    }
  }

  if (blocks.length === 0) return <p className="text-[13px] text-[#8A867E]">Version này không có block nào.</p>;
  return <div className="flex flex-col gap-1.5">{out}</div>;
}
