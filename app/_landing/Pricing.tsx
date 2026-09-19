import { useFormatter, useTranslations } from "next-intl";
import { PLANS, type Plan, type SpecValue } from "./content";
import { ButtonLink, cardClass, SectionHeading } from "./ui";

export default function Pricing() {
  const t = useTranslations("landing.pricing");

  return (
    <section
      id="bang-gia"
      aria-labelledby="pricing-title"
      className="scroll-mt-20 border-t border-white/[0.06] px-4 py-20 sm:px-6 md:py-28"
    >
      <div className="mx-auto max-w-6xl">
        <SectionHeading
          eyebrow={t("eyebrow")}
          title={<span id="pricing-title">{t("title")}</span>}
          description={t("description")}
        />
        <div className="mt-12 grid gap-4 md:grid-cols-3">
          {PLANS.map((plan) => (
            <PlanCard key={plan.id} plan={plan} />
          ))}
        </div>
      </div>
    </section>
  );
}

function PlanCard({ plan }: { plan: Plan }) {
  const t = useTranslations("landing.pricing");
  const tPlan = useTranslations("landing.plans");
  const format = useFormatter();

  const valueText = (value: SpecValue): string => {
    if ("key" in value) return t(`values.${value.key}`);
    if ("numbers" in value) return value.numbers.map((n) => format.number(n)).join(" · ");
    return value.text;
  };

  const highlight = plan.recommended
    ? "border-white/25 bg-white/[0.04] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
    : "hover:border-white/[0.14]";

  return (
    <article className={`${cardClass} relative flex flex-col p-6 transition-colors ${highlight}`}>
      <header className="flex items-center justify-between gap-2">
        <h3 className="text-base font-medium text-[#FAFAFA]">{tPlan(`${plan.id}.name`)}</h3>
        {plan.recommended && (
          <span className="rounded-full border border-blue-500/30 bg-blue-500/10 px-2 py-0.5 font-mono text-[11px] text-blue-400">
            {t("recommended")}
          </span>
        )}
      </header>
      <p className="mt-1 text-sm text-zinc-500">{tPlan(`${plan.id}.tagline`)}</p>
      <p className="mt-6 flex items-baseline gap-1">
        <span className="text-3xl font-semibold tracking-tight text-[#FAFAFA]">
          {plan.priceK === null ? t("byPack") : t("price", { k: plan.priceK })}
        </span>
        {plan.priceK !== null && <span className="text-sm text-zinc-500">{t("perMonth")}</span>}
      </p>

      <dl className="mt-6 flex-1 divide-y divide-white/[0.06] border-y border-white/[0.06]">
        {plan.specs.map((spec) => (
          <div key={spec.label} className="flex items-center justify-between gap-4 py-2.5">
            <dt className="text-sm text-zinc-500">{t(`specs.${spec.label}`)}</dt>
            <dd className="text-right font-mono text-[13px] text-zinc-200">{valueText(spec.value)}</dd>
          </div>
        ))}
      </dl>

      <ButtonLink
        href="/register"
        variant={plan.recommended ? "primary" : "secondary"}
        className="mt-6 w-full"
      >
        {tPlan(`${plan.id}.cta`)}
      </ButtonLink>
    </article>
  );
}
