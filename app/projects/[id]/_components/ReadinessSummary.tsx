"use client";

import { useTranslations } from "next-intl";
import Icon from "@/components/ui/Icon";
import type { IssueCounts } from "./flag-rules";

interface ReadinessSummaryProps {
  /** null ⇒ đang tải. */
  counts: IssueCounts | null;
}

/**
 * Một dòng trả lời "đã chốt bản được chưa". Mục trống vì bước chưa chạy KHÔNG tính là vấn đề — tách riêng
 * thành "N mục chờ bước sau". Chỉ mô tả tình trạng; điều kiện chốt thật kiểm ở `POST /baseline`.
 */
export default function ReadinessSummary({ counts }: ReadinessSummaryProps) {
  const t = useTranslations("workspace.readiness");
  if (!counts) {
    return <div className="text-body text-on-surface-subtle italic">{t("checking")}</div>;
  }
  const { blocking, later } = counts;
  return (
    <p className="flex items-center gap-2 px-1 text-body text-on-surface" aria-label={t("summaryAria")}>
      <Icon name={blocking > 0 ? "warning" : "check-circle"} size={16} className={blocking > 0 ? "text-error" : "text-success"} />
      <span>
        {blocking > 0 ? (
          t.rich("blocking", { count: blocking, b: (chunks) => <span className="font-bold">{chunks}</span> })
        ) : (
          <span className="font-semibold">{t("none")}</span>
        )}
        {later > 0 && <span className="text-on-surface-muted"> · {t("later", { count: later })}</span>}
      </span>
    </p>
  );
}
