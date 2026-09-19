"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import Logo from "@/components/Logo";
import { NAV_LINKS } from "./content";
import { ArrowRight } from "./ui";

type SectionHref = (typeof NAV_LINKS)[number]["href"];

/**
 * Header dạng "pill" nổi, dính khi cuộn — phẳng như card sidebar của dashboard (nền trắng, bóng mềm, không viền).
 * Nav là một rãnh xám kiểu segmented control; mục đang xem tô như mục sidebar đang chọn (`primary-fixed` + chữ
 * `primary`) và tự đổi theo section đang nằm giữa màn hình.
 */
export default function SiteHeader() {
  const [active, setActive] = useState<SectionHref>(NAV_LINKS[0].href);

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return; // jsdom / trình duyệt cũ: giữ mục đầu
    const sections = NAV_LINKS.map((link) => document.querySelector<HTMLElement>(link.href)).filter(
      (el): el is HTMLElement => el !== null
    );
    // Dải quan sát là một đường ngang ở ~40% chiều cao màn hình: section nào cắt qua đường đó là section đang xem.
    // `#top` bọc cả trang nên luôn cắt qua ⇒ chỉ chọn nó khi không section nào khác cắt qua.
    const visible = new Set<string>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const id = `#${entry.target.id}`;
          if (entry.isIntersecting) visible.add(id);
          else visible.delete(id);
        }
        const current = NAV_LINKS.slice(1).find((link) => visible.has(link.href));
        setActive(current ? current.href : NAV_LINKS[0].href);
      },
      { rootMargin: "-40% 0px -59% 0px" }
    );
    sections.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return (
    <header className="sticky top-0 z-50 flex justify-center px-4 pt-4 sm:px-6 sm:pt-5">
      <div className="flex w-full max-w-[1120px] items-center gap-2 rounded-full bg-surface-container-lowest/90 py-2 pl-5 pr-2 shadow-[0_1px_2px_rgba(25,24,23,0.04),0_10px_30px_rgba(25,24,23,0.07)] backdrop-blur-lg">
        <Logo variant="wordmark" sizeClassName="h-5 w-auto" theme="light" href="/" className="mr-3" />
        <nav aria-label="Điều hướng chính" className="mx-auto hidden items-center gap-0.5 rounded-full bg-surface-sidebar p-1 md:flex">
          {NAV_LINKS.map((link) => {
            const current = link.href === active;
            return (
              <a
                key={link.href}
                href={link.href}
                aria-current={current ? "location" : undefined}
                className={`rounded-full px-4 py-2 text-[13px] transition-colors ${
                  current
                    ? "bg-primary-fixed font-bold text-primary"
                    : "font-semibold text-on-surface-variant hover:bg-surface-container-lowest hover:text-on-surface"
                }`}
              >
                {link.label}
              </a>
            );
          })}
        </nav>
        <div className="ml-auto flex items-center gap-1.5 md:ml-0">
          <Link
            href="/login"
            className="hidden rounded-full px-4 py-2.5 text-[13px] font-bold text-on-surface transition-colors hover:bg-surface-sidebar sm:inline-flex"
          >
            Đăng nhập
          </Link>
          <Link
            href="/register"
            className="inline-flex items-center gap-1.5 rounded-full bg-primary py-2.5 pl-5 pr-4 text-[13px] font-bold text-on-primary transition-colors hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          >
            Dùng thử miễn phí
            <ArrowRight className="size-3.5" />
          </Link>
        </div>
      </div>
    </header>
  );
}
