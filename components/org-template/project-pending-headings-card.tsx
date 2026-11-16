"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import Button from "@/components/ui/Button";
import { getSkeletonPending } from "@/lib/api/org-library";
import PendingHeadingsReview from "./pending-headings-review";

interface ProjectPendingHeadingsCardProps {
  projectId: string;
  canReview: boolean;
  /** Đổi giá trị ⇒ đọc lại số mục chờ (vd baseline đầu vừa tạo khung tự lưu). */
  refreshToken?: number;
  className?: string;
}

/**
 * Thẻ gọn trong dự án: khi mẫu khung tự lưu của dự án còn mục BA tự đặt chờ duyệt thì báo số mục và mở danh sách duyệt tại chỗ.
 * Không có khung riêng, hết mục chờ, hoặc tải lỗi ⇒ không hiện gì (không làm phiền workspace).
 */
export default function ProjectPendingHeadingsCard({ projectId, canReview, refreshToken = 0, className }: ProjectPendingHeadingsCardProps) {
  const t = useTranslations("app.org.pendingHeadings");
  const [count, setCount] = useState(0);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getSkeletonPending(projectId)
      .then((res) => !cancelled && setCount(res?.pending_count ?? 0))
      .catch(() => !cancelled && setCount(0));
    return () => {
      cancelled = true;
    };
  }, [projectId, refreshToken]);

  if (count === 0 && !open) return null;
  return (
    <section aria-label={t("cardTitle")} className={`rounded-card bg-surface-container-low p-3 flex flex-col gap-3 ${className ?? ""}`}>
      <div className="flex flex-wrap items-center gap-3">
        <p className="flex-1 min-w-[180px] text-body font-semibold text-on-surface">{t("cardSummary", { count })}</p>
        <Button size="sm" variant="secondary" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
          {open ? t("hide") : t("review")}
        </Button>
      </div>
      {open && <PendingHeadingsReview projectId={projectId} canReview={canReview} onChange={(next) => setCount(next.pending_count)} />}
    </section>
  );
}
