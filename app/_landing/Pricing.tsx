import { PLANS, type Plan } from "./content";
import { ButtonLink, cardClass, SectionHeading } from "./ui";

export default function Pricing() {
  return (
    <section
      id="bang-gia"
      aria-labelledby="pricing-title"
      className="scroll-mt-20 border-t border-white/[0.06] px-4 py-20 sm:px-6 md:py-28"
    >
      <div className="mx-auto max-w-6xl">
        <SectionHeading
          eyebrow="Bảng giá"
          title={<span id="pricing-title">Bắt đầu miễn phí. Nâng cấp khi dự án thật sự chạy.</span>}
          description="Credit dùng chung cho cả tổ chức. Không tính theo số ghế."
        />
        <div className="mt-12 grid gap-4 md:grid-cols-3">
          {PLANS.map((plan) => (
            <PlanCard key={plan.name} plan={plan} />
          ))}
        </div>
      </div>
    </section>
  );
}

function PlanCard({ plan }: { plan: Plan }) {
  const highlight = plan.recommended
    ? "border-white/25 bg-white/[0.04] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
    : "hover:border-white/[0.14]";

  return (
    <article className={`${cardClass} relative flex flex-col p-6 transition-colors ${highlight}`}>
      <header className="flex items-center justify-between gap-2">
        <h3 className="text-base font-medium text-[#FAFAFA]">{plan.name}</h3>
        {plan.recommended && (
          <span className="rounded-full border border-blue-500/30 bg-blue-500/10 px-2 py-0.5 font-mono text-[11px] text-blue-400">
            Khuyên dùng
          </span>
        )}
      </header>
      <p className="mt-1 text-sm text-zinc-500">{plan.tagline}</p>
      <p className="mt-6 flex items-baseline gap-1">
        <span className="text-3xl font-semibold tracking-tight text-[#FAFAFA]">{plan.price}</span>
        {plan.unit && <span className="text-sm text-zinc-500">{plan.unit}</span>}
      </p>

      <dl className="mt-6 flex-1 divide-y divide-white/[0.06] border-y border-white/[0.06]">
        {plan.specs.map((spec) => (
          <div key={spec.label} className="flex items-center justify-between gap-4 py-2.5">
            <dt className="text-sm text-zinc-500">{spec.label}</dt>
            <dd className="text-right font-mono text-[13px] text-zinc-200">{spec.value}</dd>
          </div>
        ))}
      </dl>

      <ButtonLink
        href="/register"
        variant={plan.recommended ? "primary" : "secondary"}
        className="mt-6 w-full"
      >
        {plan.cta}
      </ButtonLink>
    </article>
  );
}
