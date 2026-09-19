import Link from "next/link";
import { useTranslations } from "next-intl";
import Logo from "@/components/Logo";
import LocaleSwitcher from "@/components/LocaleSwitcher";
import { NAV_LINKS } from "./content";
import { ButtonLink } from "./ui";

export default function SiteHeader() {
  const t = useTranslations("landing");

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
        <nav aria-label={t("a11y.mainNav")} className="hidden items-center gap-1 md:flex">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="rounded-md px-3 py-1.5 text-sm text-zinc-400 transition-colors hover:bg-white/[0.04] hover:text-[#FAFAFA]"
            >
              {t(`nav.${link.key}`)}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <LocaleSwitcher />
          <Link href="/login" className="rounded-md px-3 py-1.5 text-sm text-zinc-400 transition-colors hover:text-[#FAFAFA]">
            {t("header.login")}
          </Link>
          <ButtonLink href="/register" className="h-8 px-3 text-[13px]">
            {t("header.tryFree")}
          </ButtonLink>
        </div>
      </div>
    </header>
  );
}
