"use client";

import { useTranslations } from "next-intl";
import Badge, { type BadgeTone } from "@/components/ui/Badge";
import type { BlockChange, BlockDiffEntry, BlockDiffSummary } from "@/types/import";

const CHANGE_TONE: Record<BlockChange, BadgeTone> = {
  added: "success",
  removed: "danger",
  modified: "warning",
  moved: "info",
};

/** Tóm tắt số đoạn thêm / xoá / sửa / di chuyển — chữ theo ngôn ngữ giao diện. */
export function DiffSummary({ summary }: { summary: BlockDiffSummary }) {
  const t = useTranslations("mode1.blockDiff");
  return <>{t("summary", { added: summary.added, removed: summary.removed, modified: summary.modified, moved: summary.moved })}</>;
}

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
  const t = useTranslations("mode1.blockDiff");
  if (entries.length === 0) return <p className="text-body text-on-surface-muted">{t("none")}</p>;
  return (
    <ul className="flex flex-col gap-2">
      {entries.map((e, i) => (
        <li key={`${e.block_id ?? "new"}-${i}`} className="bg-surface-container rounded-control px-3 py-2 text-body flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <Badge tone={CHANGE_TONE[e.change]}>{t(`change.${e.change}`)}</Badge>
          </div>
          {e.before !== undefined && e.change !== "added" && <del className="text-error whitespace-pre-wrap">{e.before}</del>}
          {e.after !== undefined && e.change !== "removed" && (
            <ins className="text-success no-underline whitespace-pre-wrap">{e.after}</ins>
          )}
        </li>
      ))}
    </ul>
  );
}
