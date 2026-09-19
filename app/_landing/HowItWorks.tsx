import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { cardClass, SectionHeading } from "./ui";

/*
 * Bento bất đối xứng: cột trái 1/3 xếp hai bước đầu, card lớn 2/3 bên phải cho bước 03
 * (Change Request + Track Changes). Trên mobile đọc tuần tự 01 → 02 → 03.
 * Nội dung tài liệu mẫu (impact, đoạn Track Changes) luôn tiếng Anh như SRS thật — chỉ khung UI được dịch (T25).
 */

export default function HowItWorks() {
  const t = useTranslations("landing.how");

  return (
    <section
      id="cach-hoat-dong"
      aria-labelledby="how-title"
      className="scroll-mt-20 border-t border-white/[0.06] px-4 py-20 sm:px-6 md:py-28"
    >
      <div className="mx-auto max-w-6xl">
        <SectionHeading
          eyebrow={t("eyebrow")}
          title={<span id="how-title">{t("title")}</span>}
          description={t("description")}
        />

        <div className="mt-12 grid gap-4 lg:grid-cols-3 lg:grid-rows-2">
          <StepCard step="01" title={t("scan.title")} body={t("scan.body")}>
            <ul className="space-y-1.5 font-mono text-xs">
              <li className="flex gap-2 text-red-400">
                <span aria-hidden="true">✕</span>
                {t("scan.flagDeadline")}
              </li>
              <li className="flex gap-2 text-amber-400">
                <span aria-hidden="true">!</span>
                {t("scan.flagActor")}
              </li>
              <li className="flex gap-2 text-emerald-400">
                <span aria-hidden="true">✓</span>
                {t("scan.consistent", { count: 142 })}
              </li>
            </ul>
          </StepCard>

          <StepCard
            step="02"
            title={t("template.title")}
            body={t("template.body")}
            className="lg:row-start-2"
          >
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 font-mono text-xs">
              <dt className="text-zinc-300">use_cases[]</dt>
              <dd className="text-zinc-500">→ §2.2 Use Cases</dd>
              <dt className="text-zinc-300">nfrs[]</dt>
              <dd className="text-zinc-500">→ §4 Non-functional</dd>
              <dt className="text-zinc-300">glossary[]</dt>
              <dd className="text-zinc-500">→ §5.5 Glossary</dd>
            </dl>
          </StepCard>

          <ChangeRequestCard />
        </div>
      </div>
    </section>
  );
}

function StepCard({
  step,
  title,
  body,
  className = "",
  children,
}: {
  step: string;
  title: string;
  body: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <article className={`${cardClass} flex flex-col p-6 transition-colors hover:border-white/[0.14] ${className}`}>
      <span className="font-mono text-xs text-zinc-600">{step}</span>
      <h3 className="mt-3 text-base font-medium text-[#FAFAFA]">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-zinc-400">{body}</p>
      <div className="mt-6 border-t border-white/[0.06] pt-4">{children}</div>
    </article>
  );
}

const IMPACT = [
  { id: "F-S04-01", note: "add fire-safety validation" },
  { id: "UC-03", note: "add submission precondition" },
  { id: "UC-07", note: "add review step" },
];

function ChangeRequestCard() {
  const t = useTranslations("landing.how.change");

  return (
    <article
      className={`${cardClass} flex flex-col p-6 transition-colors hover:border-white/[0.14] sm:p-8 lg:col-span-2 lg:col-start-2 lg:row-span-2 lg:row-start-1`}
    >
      <span className="font-mono text-xs text-zinc-600">03</span>
      <h3 className="mt-3 text-lg font-medium text-[#FAFAFA] sm:text-xl">{t("title")}</h3>
      <p className="mt-2 max-w-lg text-sm leading-relaxed text-zinc-400">{t("body")}</p>

      <div className="mt-8 grid flex-1 gap-4 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        {/* Vùng ảnh hưởng */}
        <div className="rounded-md border border-white/[0.06] bg-zinc-950/60 p-4 font-mono text-xs">
          <p className="text-zinc-500">impact_analysis</p>
          <p className="mt-3 text-blue-400">CR-012</p>
          <ul className="mt-2 space-y-2 border-l border-white/[0.08] pl-3">
            {IMPACT.map((item) => (
              <li key={item.id}>
                <span className="text-zinc-200">{item.id}</span>
                <span className="block text-zinc-500">{item.note}</span>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-zinc-600">{t("untouched", { count: 47 })}</p>
        </div>

        {/* Track Changes */}
        <div className="rounded-md border border-white/[0.06] bg-[#FAFAFA] p-4 text-[13px] leading-relaxed text-zinc-700">
          <div className="mb-3 flex items-center justify-between font-mono text-[11px] text-zinc-400">
            <span>srs_v2.4.docx</span>
            <span>Track Changes</span>
          </div>
          <p className="font-medium text-zinc-900">UC-03 · Submit application — Preconditions</p>
          <p className="mt-2">
            The applicant is logged in and has a valid design drawing
            <del className="text-red-600 decoration-red-600">.</del>
            <ins className="text-blue-600 decoration-blue-600">
              ; buildings over 7 floors must have a fire-safety approval document.
            </ins>
          </p>
          <p className="mt-3 inline-flex items-center gap-1.5 rounded border border-zinc-200 px-1.5 py-0.5 font-mono text-[10px] text-zinc-500">
            <span className="size-1.5 rounded-full bg-blue-600" aria-hidden="true" />
            author: CR-012
          </p>
        </div>
      </div>
    </article>
  );
}
