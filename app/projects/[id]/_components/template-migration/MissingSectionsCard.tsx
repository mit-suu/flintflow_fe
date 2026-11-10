"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import Badge from "@/components/ui/Badge";
import { crPrefillHref } from "../mode1/prefill";

export interface MissingSectionItem {
  id: string;
  label: string;
  guidance?: string | null;
}

interface MissingSectionsCardProps {
  projectId: string;
  items: readonly MissingSectionItem[];
  /** Viewer không tạo được change request. */
  canWrite: boolean;
  className?: string;
}

/**
 * Mục của mẫu mới mà tài liệu cũ chưa có (cờ đỏ chặn phát hành tới khi viết xong). Nút "Viết" mở form change request điền sẵn tên mục —
 * cùng đường soạn mục trống của gap report, không có ô sửa trực tiếp.
 */
export default function MissingSectionsCard({ projectId, items, canWrite, className }: MissingSectionsCardProps) {
  const t = useTranslations("mode1.templateMigration.missing");
  if (items.length === 0) return null;
  return (
    <section aria-label={t("aria")} className={`rounded-card bg-error-container p-3 flex flex-col gap-2 ${className ?? ""}`}>
      <div className="flex flex-wrap items-center gap-2">
        <h4 className="text-body font-extrabold text-on-error-container">{t("title", { count: items.length })}</h4>
        <Badge tone="danger">{t("blocksRelease")}</Badge>
      </div>
      <ul className="flex flex-col gap-1.5">
        {items.map((item) => (
          <li key={item.id} className="rounded-control bg-surface-container-lowest px-3 py-2 flex flex-wrap items-center gap-x-3 gap-y-1">
            <div className="flex-1 min-w-[180px] flex flex-col">
              <span className="text-body font-semibold text-on-surface break-words">{item.label}</span>
              {item.guidance && <span className="text-caption text-on-surface-muted break-words">{item.guidance}</span>}
            </div>
            {canWrite && (
              <Link
                href={crPrefillHref(projectId, {
                  title: t("prefillTitle", { label: item.label }),
                  description: t("prefillDescription", { label: item.label }),
                  source: "gap_report",
                  ref: item.label,
                })}
                scroll={false}
                className="text-caption font-bold text-primary hover:underline shrink-0"
              >
                {t("write")}
              </Link>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
