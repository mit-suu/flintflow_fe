import Link from "next/link";
import Logo from "@/components/Logo";
import { NAV_LINKS } from "./content";
import { ButtonLink } from "./ui";

/* Thanh điều hướng dạng "pill" trắng mờ, dính trên đầu trang khi cuộn. */
export default function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 flex justify-center px-4 pt-4 sm:px-6 sm:pt-6">
      <div className="flex w-full max-w-[1080px] items-center gap-1.5 rounded-full border border-outline-variant bg-white/85 py-2 pl-5 pr-2.5 shadow-[0_8px_28px_rgba(25,24,23,0.06)] backdrop-blur-lg">
        <Logo variant="wordmark" sizeClassName="h-5 w-auto" theme="light" href="/" className="mr-4" />
        <nav aria-label="Điều hướng chính" className="hidden items-center gap-1 md:flex">
          {NAV_LINKS.map((link, i) => (
            <a
              key={link.href}
              href={link.href}
              aria-current={i === 0 ? "page" : undefined}
              className={
                i === 0
                  ? "rounded-full bg-on-surface px-[18px] py-2.5 text-[13px] font-bold text-white"
                  : "rounded-full px-[18px] py-2.5 text-[13px] font-semibold text-on-surface-variant transition-colors hover:bg-surface-container hover:text-on-surface"
              }
            >
              {link.label}
            </a>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <Link
            href="/login"
            className="hidden rounded-full px-[18px] py-2.5 text-[13px] font-bold text-on-surface transition-colors hover:bg-surface-container sm:inline-flex"
          >
            Đăng nhập
          </Link>
          <ButtonLink href="/register" variant="solid">
            Dùng thử miễn phí
          </ButtonLink>
        </div>
      </div>
    </header>
  );
}
