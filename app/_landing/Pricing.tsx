import { useTranslations } from "next-intl";
import { PLANS, type Plan } from "./content";
import * as motion from "motion/react-client";
import { fadeUp, inView, stagger } from "./motion";
import { ButtonLink, Diamond, SectionHeading, Texture } from "./ui";

/* Hai gói phẳng: Free nền xám ấm, Pro nền mực đậm để nổi — nhãn "Phổ biến nhất" vàng như hạt kim cương logo. */
export default function Pricing() {
  const t = useTranslations("landing.pricing");

  return (
    <section id="bang-gia" aria-labelledby="pricing-title" className="relative mt-20 scroll-mt-24 bg-surface-container-lowest px-4 py-20 sm:px-6 lg:mt-28 lg:py-28">
      <Texture kind="dots" mask="radial-gradient(ellipse 45% 55% at 50% 60%, #000, transparent)" />
      <div className="relative mx-auto max-w-[1200px]">
        <SectionHeading
          id="pricing-title"
          eyebrow={t("eyebrow")}
          title={t("title")}
          subline={t("subline")}
          align="center"
        />
        <motion.div {...inView} variants={stagger(0.1)} className="mx-auto mt-12 grid max-w-[820px] gap-4 sm:grid-cols-2">
          {PLANS.map((plan) => (
            <PlanCard key={plan.id} plan={plan} />
          ))}
        </motion.div>
      </div>
    </section>
  );
}

function PlanCard({ plan }: { plan: Plan }) {
  const t = useTranslations("landing.pricing");
  const featured = plan.recommended;

  return (
    <motion.article variants={fadeUp} className={`flex flex-col rounded-dialog p-7 sm:p-8 ${featured ? "bg-on-surface text-surface" : "bg-surface-container"}`}>
      <header className="flex items-center justify-between gap-2">
        <h3 className={`text-[15px] font-bold ${featured ? "text-surface" : "text-on-surface"}`}>{t(`plans.${plan.id}.name`)}</h3>
        {featured && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-gold px-2.5 py-1 text-[11px] font-bold text-on-surface">
            {t("popular")}
          </span>
        )}
      </header>
      <p className="mt-4 flex items-baseline gap-1">
        <span className={`text-5xl font-bold tracking-tight ${featured ? "text-surface" : "text-on-surface"}`}>
          {t("price", { k: plan.priceK })}
        </span>
        <span className={`text-[14px] font-medium ${featured ? "text-surface/60" : "text-on-surface-muted"}`}>{t("perMonth")}</span>
      </p>
      <ul className="mt-6 flex-1 space-y-2.5">
        {plan.features.map((feature) => (
          <li key={feature} className={`flex items-center gap-2.5 text-[14px] ${featured ? "text-surface/85" : "text-on-surface-medium"}`}>
            <Diamond className="size-1.5" />
            {t(feature, { count: plan.credits })}
          </li>
        ))}
      </ul>
      <ButtonLink href="/register" variant={featured ? "primary" : "inverse"} className="mt-8 w-full">
        {t(`plans.${plan.id}.cta`)}
      </ButtonLink>
    </motion.article>
  );
}
