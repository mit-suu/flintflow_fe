import { CHECK_CARD, HERO } from "./content";
import { ArrowDot, Blob, ButtonLink, GridBackdrop } from "./ui";

/*
 * Hero sáng: lưới + quầng tím/vàng phía trên, blob tím bên phải, thẻ kiểm tra 3 tầng nổi.
 * Dưới lg thẻ kiểm tra rơi xuống cuối luồng thay vì nổi tuyệt đối.
 */
export default function Hero() {
  return (
    <section aria-labelledby="hero-title" className="relative px-4 pb-16 pt-16 sm:px-8 sm:pt-20 lg:min-h-[740px] lg:px-[72px] lg:pb-24 lg:pt-[88px]">
      <Blob className="-right-24 top-4 hidden h-[500px] w-[540px] rotate-12 md:block lg:right-11 lg:top-12" />

      <div className="relative mx-auto flex max-w-[1136px] flex-col gap-6 lg:gap-[26px]">
        <p className="self-start rounded-full border border-outline-purple bg-white px-[18px] py-2 text-[12.5px] font-bold tracking-[0.04em] text-[#5B2EC4] shadow-[0_4px_14px_rgba(139,92,240,0.1)]">
          {HERO.eyebrow}
        </p>
        <h1
          id="hero-title"
          className="max-w-[720px] text-[42px] font-extrabold leading-[1.05] tracking-[-0.035em] text-on-surface sm:text-6xl lg:text-[68px]"
        >
          {HERO.headline}
          <br />
          <span className="landing-gradient-text">{HERO.headlineAccent}</span>
        </h1>
        <p className="max-w-[520px] text-base leading-[1.7] text-on-surface-variant sm:text-[17px]">{HERO.subline}</p>

        <div className="flex flex-wrap items-center gap-3.5">
          <ButtonLink href="/register">
            {HERO.primaryCta}
            <ArrowDot />
          </ButtonLink>
          <ButtonLink href="#workspace" variant="secondary">
            <span aria-hidden="true">▶</span>
            {HERO.secondaryCta}
          </ButtonLink>
        </div>

        <ul className="mt-4 flex flex-wrap gap-3.5 lg:mt-[22px]" aria-label="Số liệu nổi bật">
          {HERO.stats.map((stat) => (
            <li
              key={stat.label}
              className="min-w-[150px] rounded-[18px] border border-outline-variant bg-white/90 px-[22px] py-[18px] shadow-[0_6px_20px_rgba(25,24,23,0.05)] backdrop-blur-md"
            >
              <p className="text-[30px] font-extrabold text-on-surface">
                {stat.value}
                {stat.accent && <span className="text-[#8B5CF0]">{stat.accent}</span>}
              </p>
              <p className="mt-1 whitespace-pre-line text-[11.5px] leading-normal text-on-surface-muted">{stat.label}</p>
            </li>
          ))}
        </ul>

        <CheckCard />
      </div>

      <a
        href="#cach-hoat-dong"
        aria-label="Cuộn xuống phần Cách hoạt động"
        className="absolute bottom-5 left-1/2 hidden size-[52px] -translate-x-1/2 place-items-center rounded-full border-[1.5px] border-outline bg-white text-on-surface-variant shadow-[0_6px_18px_rgba(25,24,23,0.06)] transition-colors hover:text-on-surface lg:grid"
      >
        <span aria-hidden="true">↓</span>
      </a>
    </section>
  );
}

const TIER_STYLES = {
  ok: { bar: "bg-success-dark", tag: "bg-success-soft text-success" },
  warn: { bar: "bg-accent-gold", tag: "bg-accent-gold-soft text-accent-gold-text" },
} as const;

/* Minh hoạ kết quả kiểm tra 3 tầng — ví dụ tĩnh, không gọi API. */
function CheckCard() {
  return (
    <figure
      aria-label="Minh hoạ kết quả kiểm tra 3 tầng"
      className="mt-6 w-full max-w-[320px] rounded-[20px] border border-outline-variant bg-white/90 px-[22px] py-5 shadow-[0_30px_70px_rgba(91,46,196,0.16)] backdrop-blur-xl lg:absolute lg:right-8 lg:top-[324px] lg:mt-0"
    >
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-extrabold tracking-[0.08em] text-[#8B5CF0]">{CHECK_CARD.title}</span>
        <span className="rounded-full bg-success-soft px-[11px] py-1 text-[10.5px] font-bold text-success">{CHECK_CARD.status}</span>
      </div>
      <p className="mt-2.5 text-[26px] font-extrabold text-on-surface">
        {CHECK_CARD.count} <span className="text-[13px] font-semibold text-on-surface-subtle">{CHECK_CARD.countLabel}</span>
      </p>
      <div className="mt-3 flex gap-[5px]" aria-hidden="true">
        {CHECK_CARD.tiers.map((tier) => (
          <span key={tier.label} className={`h-[5px] flex-1 rounded-full ${TIER_STYLES[tier.tone].bar}`} />
        ))}
      </div>
      <div className="mt-3.5 flex flex-wrap gap-1.5">
        {CHECK_CARD.tiers.map((tier) => (
          <span key={tier.label} className={`rounded-full px-[11px] py-[5px] text-[10px] font-bold ${TIER_STYLES[tier.tone].tag}`}>
            {tier.label}
          </span>
        ))}
      </div>
    </figure>
  );
}

/* Lưới + quầng sáng phía trên cùng trang; đặt ở page để phủ cả header. */
export function HeroBackdrop() {
  return (
    <>
      <GridBackdrop mask="linear-gradient(#000 55%, transparent 100%)" className="bottom-auto h-[1150px]" />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-44 left-1/2 h-[640px] w-[1000px] max-w-[160vw] -translate-x-1/2 blur-[44px]"
        style={{
          background:
            "radial-gradient(ellipse at 55% 35%, rgba(185,139,245,0.3), rgba(242,197,114,0.14) 55%, transparent 75%)",
        }}
      />
    </>
  );
}
