import { HERO } from "./content";
import { ArrowRight, ButtonLink } from "./ui";
import WorkspaceMockup from "./WorkspaceMockup";

export default function Hero() {
  return (
    <section aria-labelledby="hero-title" className="relative px-4 pb-20 pt-16 sm:px-6 sm:pt-24 md:pb-28">
      <div className="mx-auto max-w-6xl">
        <div className="max-w-3xl">
          <p className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.02] px-3 py-1 font-mono text-xs text-zinc-400">
            <span className="size-1.5 rounded-full bg-blue-500" aria-hidden="true" />
            {HERO.eyebrow}
          </p>
          <h1
            id="hero-title"
            className="mt-6 text-balance text-4xl font-semibold leading-[1.08] tracking-[-0.03em] text-[#FAFAFA] sm:text-5xl lg:text-6xl"
          >
            {HERO.headline} <span className="text-zinc-500">{HERO.headlineMuted}</span>
          </h1>
          <p className="mt-6 max-w-2xl text-pretty text-base leading-relaxed text-zinc-400 sm:text-lg">{HERO.subline}</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <ButtonLink href="/register" className="h-11 px-5">
              {HERO.primaryCta}
              <ArrowRight />
            </ButtonLink>
            <ButtonLink href="#workspace" variant="secondary" className="h-11 px-5">
              {HERO.secondaryCta}
            </ButtonLink>
          </div>
          <ul className="mt-8 flex flex-wrap gap-x-5 gap-y-2 font-mono text-xs text-zinc-500">
            {HERO.proof.map((item) => (
              <li key={item} className="flex items-center gap-2">
                <span className="text-emerald-500" aria-hidden="true">
                  ✓
                </span>
                {item}
              </li>
            ))}
          </ul>
        </div>

        <div id="workspace" className="mt-14 scroll-mt-20 sm:mt-20">
          <WorkspaceMockup />
        </div>
      </div>
    </section>
  );
}
