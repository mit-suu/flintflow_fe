import { PHASES } from "@/lib/constants/step-registry";
import { CHECK_CARD, HERO, PREVIEW_FOLDER, PREVIEW_PROJECTS } from "./content";
import { ArrowRight, ButtonLink, Diamond, Eyebrow, FolderShape, PhaseBar } from "./ui";

/*
 * Hero: chữ bên trái; bên phải là "ảnh chụp" dashboard dựng bằng chính ngôn ngữ của nó (cột xám nhạt,
 * thẻ thư mục, card dự án tím pastel + thanh 12 giai đoạn) và thẻ kiểm tra 3 tầng.
 */
export default function Hero() {
  return (
    <section aria-labelledby="hero-title" className="px-4 pb-20 pt-10 sm:px-6 lg:pb-28 lg:pt-16">
      <div className="mx-auto grid max-w-[1200px] items-center gap-14 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:gap-14">
        <div>
          <Eyebrow className="rounded-full bg-primary-soft px-3.5 py-1.5 text-primary-hover">{HERO.eyebrow}</Eyebrow>
          <h1
            id="hero-title"
            className="mt-6 text-[34px] font-bold leading-[1.05] tracking-[-0.04em] text-on-surface sm:text-[56px] xl:text-[60px]"
          >
            {HERO.headline}
            <br />
            <span className="text-primary">
              {HERO.headlineAccent}
              <span className="sr-only">.</span>
            </span>
            <Diamond className="mb-2 ml-3 size-3.5 sm:size-4" />
          </h1>
          <p className="mt-6 max-w-[540px] text-pretty text-base leading-relaxed text-on-surface-variant sm:text-[17px]">
            {HERO.subline}
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <ButtonLink href="/register">
              {HERO.primaryCta}
              <ArrowRight />
            </ButtonLink>
            <ButtonLink href="#workspace" variant="secondary">
              {HERO.secondaryCta}
            </ButtonLink>
          </div>
          <ul className="mt-10 grid gap-2.5 text-[14px] font-medium text-on-surface-medium">
            {HERO.facts.map((fact) => (
              <li key={fact} className="flex items-center gap-3">
                <span aria-hidden="true" className="grid size-6 place-items-center rounded-inner bg-success-soft text-[12px] font-bold text-success">
                  ✓
                </span>
                {fact}
              </li>
            ))}
          </ul>
        </div>

        <DashboardCollage />
      </div>
    </section>
  );
}

/* Minh hoạ tĩnh, không gọi API. Số giai đoạn lấy từ step registry thật. */
function DashboardCollage() {
  return (
    <figure aria-label="Minh hoạ dashboard FlintFlow">
      <div className="rounded-dialog bg-surface-sidebar p-4 sm:p-6">
        <div className="mb-4 flex items-center gap-2">
          <p className="text-[17px] font-semibold tracking-tight text-on-surface">Dự án của bạn</p>
          <span className="rounded-full bg-surface-container-highest px-2 py-0.5 text-[11px] font-bold text-on-surface-variant">3</span>
        </div>
        <div className="grid gap-3 sm:grid-cols-[0.85fr_1fr]">
          <FolderShape tone="amber" bodyClassName="flex min-h-[120px] flex-col gap-3 px-5 pb-4 pt-5">
            <span className="text-[15px] font-semibold text-on-surface">{PREVIEW_FOLDER.name}</span>
            <span aria-hidden="true" className="mt-auto h-px bg-on-surface/10" />
            <span className="text-right text-[12px] text-on-surface-variant">{PREVIEW_FOLDER.count}</span>
          </FolderShape>
          <div className="grid gap-3 sm:pt-[22px]">
            {PREVIEW_PROJECTS.map((project) => (
              <div key={project.name} className="rounded-card bg-surface-card px-4 py-3.5">
                <p className="flex items-center gap-1.5 text-[11.5px] font-semibold text-on-card-strong">
                  <span
                    aria-hidden="true"
                    className={`size-1.5 rounded-full ${project.status.tone === "ok" ? "bg-success" : "bg-accent-gold"}`}
                  />
                  {project.status.label}
                </p>
                <p className="mt-1 text-[14px] font-semibold text-on-card">{project.name}</p>
                <p className="mt-2.5 text-[11.5px] text-on-card-variant">
                  Giai đoạn {project.phasesDone + 1}/{PHASES.length} · {project.next}
                </p>
                <div className="mt-2">
                  <PhaseBar done={project.phasesDone} />
                </div>
              </div>
            ))}
          </div>
        </div>
        <CheckCard />
      </div>
    </figure>
  );
}

const TIER_STYLES = {
  ok: { tag: "bg-success-soft text-success", mark: "✓" },
  warn: { tag: "bg-accent-gold-soft text-accent-gold-text", mark: "!" },
} as const;

/* Hàng cuối của collage: kết quả kiểm tra 3 tầng trước khi chốt baseline. */
function CheckCard() {
  return (
    <div className="mt-3 rounded-card bg-surface-container-lowest p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[12.5px] font-bold text-on-surface">{CHECK_CARD.title}</p>
        <span className="inline-flex items-center gap-1 rounded-full bg-success-soft px-2 py-0.5 text-[10.5px] font-bold text-success">
          <span aria-hidden="true" className="size-1.5 rounded-full bg-success-dark" />
          {CHECK_CARD.status}
        </span>
      </div>
      <p className="mt-2 text-[26px] font-bold leading-none text-on-surface">
        {CHECK_CARD.count} <span className="text-[12.5px] font-medium text-on-surface-muted">{CHECK_CARD.countLabel}</span>
      </p>
      <div className="mt-3 grid grid-cols-3 gap-1.5">
        {CHECK_CARD.tiers.map((tier) => (
          <span key={tier.label} className={`rounded-inner px-2 py-1.5 text-[10.5px] font-bold ${TIER_STYLES[tier.tone].tag}`}>
            {TIER_STYLES[tier.tone].mark} {tier.label}
          </span>
        ))}
      </div>
    </div>
  );
}
