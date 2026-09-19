interface SkeletonProps {
  className?: string;
}

/** Khối giữ chỗ khi tải; `motion-safe` ⇒ tắt nhấp nháy khi user bật giảm chuyển động. */
export default function Skeleton({ className }: SkeletonProps) {
  return <div aria-hidden className={`rounded-[10px] bg-surface-container-high motion-safe:animate-pulse ${className ?? ""}`} />;
}
