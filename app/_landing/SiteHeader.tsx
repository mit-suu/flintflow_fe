import Link from "next/link";
import Logo from "@/components/Logo";
import { NAV_LINKS } from "./content";
import { ButtonLink } from "./ui";

export default function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-white/[0.06] bg-zinc-950/80 backdrop-blur-sm">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Logo
          sizeClassName="w-6 h-6"
          theme="dark"
          showText={true}
          textClassName="text-[#FAFAFA] font-semibold text-[15px] tracking-tight"
          href="/"
        />
        <nav aria-label="Điều hướng chính" className="hidden items-center gap-1 md:flex">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="rounded-md px-3 py-1.5 text-sm text-zinc-400 transition-colors hover:bg-white/[0.04] hover:text-[#FAFAFA]"
            >
              {link.label}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <Link href="/login" className="rounded-md px-3 py-1.5 text-sm text-zinc-400 transition-colors hover:text-[#FAFAFA]">
            Đăng nhập
          </Link>
          <ButtonLink href="/register" className="h-8 px-3 text-[13px]">
            Dùng thử
          </ButtonLink>
        </div>
      </div>
    </header>
  );
}
