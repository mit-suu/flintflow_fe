import { PLANS, type Plan } from "./content";
import { ButtonLink } from "./ui";

export default function Pricing() {
  return (
    <section id="bang-gia" aria-labelledby="pricing-title" className="relative scroll-mt-24 px-4 py-16 sm:px-8 lg:px-[72px] lg:pb-[88px] lg:pt-[72px]">
      <h2 id="pricing-title" className="sr-only">
        Bảng giá
      </h2>
      <div className="mx-auto grid max-w-[760px] items-stretch gap-[18px] sm:grid-cols-2">
        {PLANS.map((plan) => (
          <PlanCard key={plan.name} plan={plan} />
        ))}
      </div>
    </section>
  );
}

function PlanCard({ plan }: { plan: Plan }) {
  const featured = plan.recommended;
  return (
    <article
      className={`relative flex flex-col gap-3 rounded-[22px] p-[30px] ${
        featured
          ? "landing-gradient-border shadow-[0_24px_60px_rgba(139,92,240,0.18)]"
          : "border border-outline-variant bg-white"
      }`}
    >
      {featured && (
        <span className="absolute -top-3 right-6 rounded-full bg-[linear-gradient(135deg,#B98BF5,#8B5CF0)] px-3.5 py-[5px] text-[10.5px] font-extrabold text-white shadow-[0_8px_20px_rgba(139,92,240,0.4)]">
          PHỔ BIẾN NHẤT
        </span>
      )}
      <h3 className={`text-sm font-extrabold ${featured ? "text-[#5B2EC4]" : "text-on-surface-variant"}`}>{plan.name}</h3>
      <p className="text-4xl font-extrabold text-on-surface">
        {plan.price}
        <span className="text-sm font-semibold text-on-surface-subtle">{plan.unit}</span>
      </p>
      <p className="text-[13px] leading-[1.8] text-on-surface-variant">{plan.summary}</p>
      <ButtonLink
        href="/register"
        variant={featured ? "solid" : "secondary"}
        className="mt-auto w-full py-[13px] text-[13.5px]"
      >
        {plan.cta}
      </ButtonLink>
    </article>
  );
}
