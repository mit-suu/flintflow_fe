import Logo from "@/components/Logo";
import { FINAL_CTA, NAV_LINKS } from "./content";
import { ArrowRight, ButtonLink, Diamond } from "./ui";

/* CTA cuối trang trong một thẻ thư mục lớn màu `primary` (cùng hình thẻ thư mục dashboard), rồi footer. */
export default function FinalCta() {
  return (
    <>
      <section aria-labelledby="cta-title" className="px-4 sm:px-6">
        <div className="relative mx-auto max-w-[1200px] pt-[30px]">
          <span aria-hidden="true" className="absolute inset-x-0 bottom-0 top-[20px] rounded-[28px] rounded-tl-none bg-primary-hover" />
          <svg aria-hidden="true" viewBox="0 0 128 24" className="absolute left-0 top-0 h-[32px] w-[170px] text-primary-hover" fill="currentColor">
            <path d="M0 24V16Q0 0 16 0H84C96 0 100 5 105 9.5C110 14 114 14 128 14V24Z" />
          </svg>
          <div className="relative flex flex-col items-start gap-8 rounded-[28px] bg-primary px-6 py-14 sm:px-12 lg:flex-row lg:items-end lg:justify-between lg:px-16 lg:py-20">
            <h2 id="cta-title" className="text-4xl font-bold leading-[1.08] tracking-[-0.03em] text-on-primary sm:text-5xl lg:text-[56px]">
              {FINAL_CTA.headline}
              <br />
              <span className="text-primary-fixed-dim">{FINAL_CTA.headlineAccent}</span>
            </h2>
            <div className="flex shrink-0 flex-col items-start gap-3">
              <ButtonLink href="/register" variant="inverse" className="h-14 px-7 text-[15px]">
                {FINAL_CTA.cta}
                <ArrowRight />
              </ButtonLink>
              <p className="text-[13px] text-on-primary-container">{FINAL_CTA.note}</p>
            </div>
          </div>
        </div>
      </section>

      <footer className="px-4 pb-10 pt-14 sm:px-6">
        <div className="mx-auto flex max-w-[1200px] flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3 text-[13px] text-on-surface-muted">
            <Logo variant="wordmark" sizeClassName="h-[18px] w-auto" theme="light" />
            <Diamond className="size-1.5" />
            <span>© 2026 FlintFlow</span>
          </div>
          <nav aria-label="Liên kết cuối trang" className="flex flex-wrap gap-x-6 gap-y-2 text-[13px] font-medium text-on-surface-variant">
            {NAV_LINKS.slice(1).map((link) => (
              <a key={link.href} href={link.href} className="transition-colors hover:text-on-surface">
                {link.label}
              </a>
            ))}
            <a href="mailto:hello@flintflow.app" className="transition-colors hover:text-on-surface">
              hello@flintflow.app
            </a>
          </nav>
        </div>
      </footer>
    </>
  );
}
