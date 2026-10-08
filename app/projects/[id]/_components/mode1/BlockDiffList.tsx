"use client";

import Badge, { type BadgeTone } from "@/components/ui/Badge";
import type { BlockChange, BlockDiffEntry, BlockDiffSummary } from "@/types/import";

const CHANGE: Record<BlockChange, { label: string; tone: BadgeTone }> = {
  added: { label: "Thêm", tone: "success" },
  removed: { label: "Xoá", tone: "danger" },
  modified: { label: "Sửa", tone: "warning" },
  moved: { label: "Di chuyển", tone: "info" },
};

export const summaryText = (s: BlockDiffSummary) =>
  `${s.added} thêm · ${s.removed} xoá · ${s.modified} sửa · ${s.moved} di chuyển`;

/**
 * Khác biệt theo block — dùng cho so sánh 2 version (UC-55) và kết quả re-upload (UC-24).
 *
 * Diff là danh sách **đoạn** theo thứ tự tài liệu, không nhóm theo mục: `BlockDiffEntry` chỉ mang
 * `block_id` (id bookmark neo trong file Word), không có khoá mục để gom. `block_id` cũng không hiện ra
 * UI — nó không mang nghĩa gì với người đọc tài liệu.
 *
 * Nền hàng đậm hơn nền chứa một nấc (`-container` trên `-lowest` của Modal): component vẽ phẳng, phân
 * tách bằng nền chứ không bằng viền.
 */
export default function BlockDiffList({ entries }: { entries: BlockDiffEntry[] }) {
  if (entries.length === 0) return <p className="text-body text-on-surface-muted">Không có khác biệt.</p>;
  return (
    <ul className="flex flex-col gap-2">
      {entries.map((e, i) => {
        const change = CHANGE[e.change];
        return (
          <li key={`${e.block_id ?? "new"}-${i}`} className="bg-surface-container rounded-control px-3 py-2 text-body flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <Badge tone={change.tone}>{change.label}</Badge>
            </div>
            {e.before !== undefined && e.change !== "added" && <del className="text-error whitespace-pre-wrap">{e.before}</del>}
            {e.after !== undefined && e.change !== "removed" && (
              <ins className="text-success no-underline whitespace-pre-wrap">{e.after}</ins>
            )}
          </li>
        );
      })}
    </ul>
  );
}
