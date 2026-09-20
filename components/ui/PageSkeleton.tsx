import Skeleton from "./Skeleton";

/**
 * Hình dạng khối giữ chỗ. Chọn cái GẦN GIỐNG nội dung thật nhất — mục đích của skeleton là giữ đúng
 * chỗ để lúc dữ liệu về không bị nhảy layout, không phải để "có cái gì đó động đậy".
 *
 * - `page`    trang chung: tiêu đề + vài khối nội dung (mặc định)
 * - `cards`   lưới thẻ số liệu / thẻ ngắn
 * - `list`    danh sách dòng có avatar-ish + 2 dòng chữ
 * - `table`   bảng: hàng tiêu đề + các hàng dữ liệu
 * - `form`    thẻ form: nhãn + ô nhập
 * - `workspace` màn hình làm việc 2 pane (chat | tài liệu)
 */
export type PageSkeletonVariant = "page" | "cards" | "list" | "table" | "form" | "workspace";

interface PageSkeletonProps {
  variant?: PageSkeletonVariant;
  /** Số dòng/thẻ giữ chỗ. Mỗi variant có mặc định riêng. */
  rows?: number;
  /** Mô tả cho trình đọc màn hình, vd "Đang tải danh sách người dùng". */
  label?: string;
  /** Trang đã tự bọc thẻ trắng quanh chỗ này rồi ⇒ bỏ viền/nền của skeleton cho khỏi lồng hai lớp. */
  bare?: boolean;
  className?: string;
}

const DEFAULT_ROWS: Record<PageSkeletonVariant, number> = {
  page: 3,
  cards: 4,
  list: 5,
  table: 6,
  form: 2,
  workspace: 0,
};

const range = (n: number) => Array.from({ length: n }, (_, i) => i);

/** Thẻ trắng bọc ngoài — cùng bo góc/viền với card thật để không xê dịch lúc đổi sang nội dung. */
function Card({ bare, children, className }: { bare: boolean; children: React.ReactNode; className?: string }) {
  const chrome = bare ? "" : "bg-surface-container-lowest border border-outline-variant rounded-card";
  return <div className={`${chrome} ${className ?? ""}`}>{children}</div>;
}

function Body({ variant, rows, bare }: { variant: PageSkeletonVariant; rows: number; bare: boolean }) {
  switch (variant) {
    case "cards":
      return (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {range(rows).map((i) => (
            <Card key={i} bare={bare} className="px-5 py-4 flex flex-col gap-2.5">
              <Skeleton className="h-3 w-1/2" />
              <Skeleton className="h-6 w-2/3" />
            </Card>
          ))}
        </div>
      );

    case "list":
      return (
        <Card bare={bare} className="overflow-hidden divide-y divide-outline-variant">
          {range(rows).map((i) => (
            <div key={i} className="flex items-center gap-3.5 px-5 py-4">
              <Skeleton className="size-9 rounded-full shrink-0" />
              <div className="flex-1 flex flex-col gap-2">
                <Skeleton className="h-3.5 w-1/3" />
                <Skeleton className="h-3 w-2/3" />
              </div>
              <Skeleton className="h-3 w-16 shrink-0" />
            </div>
          ))}
        </Card>
      );

    case "table":
      return (
        <Card bare={bare} className="overflow-hidden">
          <div className="flex items-center gap-4 px-4 py-3 bg-surface-container-low border-b border-outline-variant">
            {range(4).map((i) => (
              <Skeleton key={i} className="h-2.5 flex-1" />
            ))}
          </div>
          <div className="divide-y divide-outline-variant">
            {range(rows).map((i) => (
              <div key={i} className="flex items-center gap-4 px-4 py-3.5">
                {range(4).map((j) => (
                  <Skeleton key={j} className="h-3.5 flex-1" />
                ))}
              </div>
            ))}
          </div>
        </Card>
      );

    case "form":
      return (
        <div className="flex flex-col gap-6 max-w-[760px]">
          {range(rows).map((i) => (
            <Card key={i} bare={bare} className="p-6 flex flex-col gap-4">
              <Skeleton className="h-4 w-40" />
              {range(3).map((j) => (
                <div key={j} className="flex flex-col gap-1.5">
                  <Skeleton className="h-2.5 w-24" />
                  <Skeleton className="h-9 w-full" />
                </div>
              ))}
            </Card>
          ))}
        </div>
      );

    case "workspace":
      return (
        <div className="flex-1 flex gap-4 min-h-0">
          {/* Pane chat */}
          <Card bare={bare} className="w-[38%] min-w-[300px] p-5 flex flex-col gap-4">
            {range(4).map((i) => (
              <div key={i} className={`flex flex-col gap-2 ${i % 2 ? "items-end" : ""}`}>
                <Skeleton className={`h-3 ${i % 2 ? "w-1/3" : "w-2/5"}`} />
                <Skeleton className={`h-12 ${i % 2 ? "w-3/4" : "w-full"} rounded-card`} />
              </div>
            ))}
            <div className="mt-auto">
              <Skeleton className="h-16 w-full rounded-card" />
            </div>
          </Card>
          {/* Pane tài liệu */}
          <Card bare={bare} className="flex-1 p-6 flex flex-col gap-3.5">
            <Skeleton className="h-5 w-1/3" />
            <Skeleton className="h-2.5 w-1/5" />
            <div className="h-2" />
            {range(9).map((i) => (
              <Skeleton key={i} className={`h-3 ${i % 4 === 3 ? "w-2/3" : "w-full"}`} />
            ))}
          </Card>
        </div>
      );

    case "page":
    default:
      return (
        <div className="flex flex-col gap-4">
          {range(rows).map((i) => (
            <Card key={i} bare={bare} className="p-5 flex flex-col gap-3">
              <Skeleton className="h-4 w-1/4" />
              <Skeleton className="h-3 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </Card>
          ))}
        </div>
      );
  }
}

/**
 * Khối giữ chỗ cỡ cả trang, dùng cho lần **đầu vào trang** khi chưa có dữ liệu.
 *
 * Cố tình KHÔNG phải "trang trắng + spinner": người dùng nhìn thấy ngay bố cục sắp hiện ra, và khi dữ
 * liệu về thì nội dung thế vào đúng chỗ thay vì đẩy layout nhảy một phát.
 * Dùng cho phần thân trang; thanh điều hướng/topbar thật nên vẽ luôn (không cần giữ chỗ).
 */
export default function PageSkeleton({ variant = "page", rows, label, bare = false, className }: PageSkeletonProps) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label={label ?? "Đang tải"}
      className={`flex flex-col gap-4 ${className ?? ""}`}
      data-testid="page-skeleton"
      data-variant={variant}
    >
      <Body variant={variant} rows={rows ?? DEFAULT_ROWS[variant]} bare={bare} />
    </div>
  );
}
