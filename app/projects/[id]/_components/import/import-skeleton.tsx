import Skeleton from "@/components/ui/Skeleton";

/** Bề rộng / lề cột giữa của màn đọc file — dùng chung với `ImportWorkspace` để skeleton và màn thật trùng khít. */
export const IMPORT_COLUMN = "max-w-[1180px] mx-auto w-full px-4 sm:px-6 py-8";

/**
 * Skeleton duy nhất của màn đọc file SRS (cả lúc trang còn đang đọc project lẫn lúc màn đọc file đang tải): đúng hình màn đọc
 * khung — tên file + tiêu đề, trang giấy bên trái, các ô dọc bên phải, dòng credit — để các nấc tải trùng khít nhau, chỉ có nội
 * dung thật hiện dần. `withHeader = false`: nằm trong cột của `ImportWorkspace` (đã có thanh trên + lề).
 */
export default function ImportSkeleton({ withHeader = true, label }: { withHeader?: boolean; label: string }) {
  const body = (
    <div role="status" aria-label={label} className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-2.5">
          <Skeleton className="h-5 w-56" />
          <Skeleton className="h-7 w-80" />
          <Skeleton className="h-4 w-[min(520px,100%)]" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-32 rounded-full" />
          <Skeleton className="h-8 w-36" />
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_380px] gap-6">
        <div className="flex flex-col gap-2 lg:h-0 lg:min-h-full">
          <div className="min-h-6 flex items-center">
            <Skeleton className="h-3.5 w-24" />
          </div>
          <div className="flex-1 min-h-0 flex flex-col rounded-card bg-surface-container p-3 sm:p-4">
            <div className="flex-1 min-h-0 overflow-hidden rounded-inner bg-surface-container-lowest px-6 sm:px-8 py-6 flex flex-col gap-1">
              {Array.from({ length: 8 }, (_, i) => (
                <div key={i} className="px-3 py-2.5 flex flex-col gap-1.5">
                  <Skeleton className={`h-3.5 ${i % 3 === 1 ? "w-1/3" : "w-1/2"}`} />
                  <Skeleton className="h-1.5 w-11/12" />
                  <Skeleton className="h-1.5 w-2/3" />
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <div className="min-h-6 flex items-center">
            <Skeleton className="h-3.5 w-28" />
          </div>
          <div className="rounded-card bg-surface-container p-1.5 flex flex-col gap-0.5">
            {Array.from({ length: 11 }, (_, i) => (
              <div key={i} className="min-h-[52px] px-2.5 py-2 flex items-center gap-3">
                <Skeleton className="size-8 rounded-inner" />
                <div className="flex-1 flex flex-col gap-1.5">
                  <Skeleton className="h-3 w-1/2" />
                  <Skeleton className="h-2.5 w-1/3" />
                </div>
                <Skeleton className="h-4 w-6" />
              </div>
            ))}
          </div>
        </div>
      </div>
      <Skeleton className="h-[62px] w-full rounded-card" />
    </div>
  );
  if (!withHeader) return body;
  return (
    <div className="h-screen flex flex-col overflow-hidden bg-surface-container-lowest">
      <div aria-hidden className="h-[58px] shrink-0 px-4 flex items-center gap-3">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-3.5 w-40" />
        <div className="ml-auto flex items-center gap-1.5">
          <Skeleton className="h-8 w-24" />
          <Skeleton className="size-8 rounded-full" />
        </div>
      </div>
      <div className="flex-1 min-h-0 overflow-hidden">
        <div className={IMPORT_COLUMN}>{body}</div>
      </div>
    </div>
  );
}
