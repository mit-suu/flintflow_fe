import Link from "next/link";
import Logo from "@/components/Logo";
import { NAV_LINKS } from "./content";
import { ButtonLink } from "./ui";

/* Thanh trên cùng, dính khi cuộn: nền trắng mờ, không viền — mục nav hover giống mục sidebar của dashboard. */
export default function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 bg-surface-container-lowest/90 backdrop-blur-md">
      <div className="mx-auto flex h-[68px] max-w-[1200px] items-center gap-2 px-4 sm:px-6">
        <Logo variant="wordmark" sizeClassName="h-[22px] w-auto" theme="light" href="/" className="mr-6" />
        <nav aria-label="Điều hướng chính" className="hidden items-center gap-1 md:flex">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="rounded-control px-3.5 py-2 text-[14px] font-semibold text-on-surface-variant transition-colors hover:bg-surface-sidebar hover:text-on-surface"
            >
              {link.label}
            </a>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <Link
            href="/login"
            className="hidden rounded-control px-3.5 py-2 text-[14px] font-bold text-on-surface transition-colors hover:bg-surface-sidebar sm:inline-flex"
          >
            Đăng nhập
          </Link>
          <ButtonLink href="/register" className="h-10 px-4 text-[13.5px]">
            Dùng thử miễn phí
          </ButtonLink>
        </div>
      </div>
    </header>
  );
}
