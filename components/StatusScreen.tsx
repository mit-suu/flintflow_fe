import Link from "next/link";
import type { ReactNode } from "react";
import Logo from "@/components/Logo";
import Icon, { type IconName } from "@/components/ui/Icon";
import { LINK_PRIMARY } from "@/components/ui/link-styles";

interface StatusScreenProps {
  icon: IconName;
  eyebrow: string;
  title: string;
  body: string;
  /** Nhãn link về trang chủ (`/`). */
  homeLabel: string;
  /** Hành động thêm đứng trước link về trang chủ (vd nút "Thử lại" của trang lỗi). */
  action?: ReactNode;
  /** Dòng phụ nhỏ dưới cùng (vd mã lỗi `digest` để đối chiếu log server). */
  footnote?: string;
}

/**
 * Khung chung của trang lỗi (`app/error.tsx`, `app/global-error.tsx`) và trang bảo trì (`/maintenance`): nền kem
 * như landing/auth, logo FlintFlow, một thẻ ở giữa. Không tự lấy chuỗi — mọi chuỗi đi vào qua props để khung
 * không phụ thuộc i18n (nơi gọi tự dịch: `ErrorScreen`, trang bảo trì).
 */
export default function StatusScreen({ icon, eyebrow, title, body, homeLabel, action, footnote }: StatusScreenProps) {
  return (
    <div className="flex min-h-dvh flex-1 flex-col bg-surface p-4 font-sans text-on-surface antialiased sm:p-6">
      <header>
        <Logo variant="wordmark" sizeClassName="h-[18px] w-auto" theme="light" />
      </header>
      <main className="flex flex-1 items-center justify-center py-8">
        <section className="flex w-full max-w-[480px] flex-col items-center gap-4 rounded-[24px] bg-surface-container-lowest px-6 py-10 text-center sm:px-10">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-primary-soft text-primary">
            <Icon name={icon} size={24} />
          </span>
          <p className="text-[13px] font-bold text-primary">{eyebrow}</p>
          <h1 className="text-title font-bold tracking-tight text-on-surface">{title}</h1>
          <p className="text-body leading-[1.6] text-on-surface-muted">{body}</p>
          <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
            {action}
            <Link href="/" className={action ? LINK_SECONDARY_LG : LINK_PRIMARY}>
              {homeLabel}
            </Link>
          </div>
          {footnote ? <p className="font-mono text-caption text-on-surface-muted">{footnote}</p> : null}
        </section>
      </main>
    </div>
  );
}

/** Link phụ cùng cao với `Button` cỡ md (đứng cạnh nút "Thử lại"). */
const LINK_SECONDARY_LG =
  "inline-flex h-10 items-center justify-center rounded-control border border-outline bg-surface-container-lowest px-5 text-body font-bold text-on-surface-medium hover:bg-surface-container-low transition-colors";
