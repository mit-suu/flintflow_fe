interface SkeletonProps {
  className?: string;
}

/**
 * Khối giữ chỗ khi tải. Hiệu ứng là **vệt gradient quét ngang** (`.ff-skeleton` ở `app/globals.css`),
 * không phải nhấp nháy đục/trong — vệt quét cho cảm giác "đang chạy" mà không làm nháy cả trang.
 * Bản thân class đã tắt animation khi user bật "giảm chuyển động".
 */
export default function Skeleton({ className }: SkeletonProps) {
  return <div aria-hidden className={`ff-skeleton rounded-control ${className ?? ""}`} />;
}
