"use client";

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
  if (!counts) {
    return <div className="text-[11.5px] text-on-surface-subtle italic">Đang kiểm tra tài liệu…</div>;
  }
  const { blocking, later } = counts;
  return (
    <p className="flex items-center gap-2 px-1 text-[12.5px] text-on-surface" aria-label="Tóm tắt kiểm tra tài liệu">
      <Icon name={blocking > 0 ? "warning" : "check-circle"} size={16} className={blocking > 0 ? "text-error" : "text-success"} />
      <span>
        {blocking > 0 ? (
          <>
            <span className="font-bold">{blocking} vấn đề</span> cần bạn xử lý
          </>
        ) : (
          <span className="font-semibold">Không có vấn đề cần xử lý</span>
        )}
        {later > 0 && <span className="text-on-surface-muted"> · {later} mục chờ bước sau</span>}
      </span>
    </p>
  );
}
