import Logo from "@/components/Logo";
import { FINAL_CTA } from "./content";
import { ArrowDot, Blob, ButtonLink, GridBackdrop } from "./ui";

/* CTA cuối trang + footer trong cùng một khối nền trắng. */
export default function FinalCta() {
  return (
    <section
      aria-labelledby="cta-title"
      className="relative overflow-hidden border-t border-outline-variant bg-white px-4 pb-11 pt-20 sm:px-8 lg:px-[72px] lg:pt-24"
    >
      <GridBackdrop mask="radial-gradient(ellipse 60% 70% at 50% 30%, #000, transparent)" className="opacity-55" />
      <Blob className="-bottom-32 -right-28 hidden h-[420px] w-[460px] rotate-20 md:block" />

      <div className="relative flex flex-col items-center gap-6 text-center">
        <h2
          id="cta-title"
          className="text-4xl font-extrabold leading-[1.06] tracking-[-0.035em] text-on-surface sm:text-5xl lg:text-[58px]"
        >
          {FINAL_CTA.headline}
          <br />
          <span className="bg-[linear-gradient(95deg,#B98BF5,#8B5CF0_45%,#D9932B)] bg-clip-text text-transparent">
            {FINAL_CTA.headlineAccent}
          </span>
        </h2>
        <ButtonLink href="/register" className="pl-[30px] text-base">
          {FINAL_CTA.cta}
          <ArrowDot className="size-11" />
        </ButtonLink>
        <p className="text-[12.5px] text-on-surface-subtle">{FINAL_CTA.note}</p>
      </div>

      <footer className="relative mx-auto mt-20 flex max-w-[1136px] flex-col gap-4 border-t border-outline-variant pt-[26px] sm:flex-row sm:items-center sm:justify-between lg:mt-[88px]">
        <div className="flex items-center gap-[9px] text-[13px] text-on-surface-muted">
          <Logo sizeClassName="w-6 h-6" theme="light" />
          <span>© 2026 FlintFlow</span>
        </div>
        <nav aria-label="Liên kết cuối trang" className="flex flex-wrap gap-x-[22px] gap-y-2 text-[13px] text-on-surface-muted">
          <a href="#cach-hoat-dong" className="transition-colors hover:text-on-surface">
            Cách hoạt động
          </a>
          <a href="#bang-gia" className="transition-colors hover:text-on-surface">
            Bảng giá
          </a>
          <a href="mailto:hello@flintflow.app" className="transition-colors hover:text-on-surface">
            hello@flintflow.app
          </a>
        </nav>
      </footer>
    </section>
  );
}
