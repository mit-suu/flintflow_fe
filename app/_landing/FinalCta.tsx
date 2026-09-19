import { useTranslations } from "next-intl";
import Logo from "@/components/Logo";
import { STANDARDS } from "./content";
import { ArrowRight, buttonClass, cardClass } from "./ui";

/*
 * Bento box cuối trang: CTA email + footer trong cùng một khối.
 * Form là GET thuần tới /register (không JS, không endpoint mới) — email đi theo query `?email=`.
 */

/** `value` là chữ dịch khi `translate`, còn lại hiển thị nguyên (tên chuẩn, định dạng file, số). */
const CHECKLIST = [
  { key: "structure", value: "IEEE 830 / 29148" },
  { key: "trace", value: "automatic", translate: true },
  { key: "redFlags", value: "0" },
  { key: "deliverable", value: ".docx + Track Changes" },
] as const;

const CONTACT_EMAIL = "hello@flintflow.app";

const FOOTER_LINKS = [
  { href: "#cach-hoat-dong", key: "how" },
  { href: "#bang-gia", key: "pricing" },
] as const;

export default function FinalCta() {
  const t = useTranslations("landing");

  return (
    <section aria-labelledby="cta-title" className="px-4 pb-8 sm:px-6">
      <div className={`${cardClass} mx-auto max-w-6xl overflow-hidden`}>
        <div className="grid gap-10 p-6 sm:p-10 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-16 lg:p-14">
          <div>
            <h2
              id="cta-title"
              className="text-balance text-2xl font-semibold tracking-tight text-[#FAFAFA] sm:text-3xl md:text-4xl"
            >
              {t("cta.title")} <span className="text-zinc-500">{t("cta.titleMuted")}</span>
            </h2>
            <p className="mt-4 max-w-md text-zinc-400">{t("cta.body")}</p>

            <form action="/register" method="get" className="mt-8 flex max-w-md flex-col gap-2 sm:flex-row">
              <label htmlFor="cta-email" className="sr-only">
                {t("cta.emailLabel")}
              </label>
              <input
                id="cta-email"
                name="email"
                type="email"
                required
                autoComplete="email"
                placeholder={t("cta.emailPlaceholder")}
                className="h-10 min-w-0 flex-1 rounded-md border border-white/[0.12] bg-zinc-950 px-3 text-sm text-[#FAFAFA] placeholder:text-zinc-600 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <button type="submit" className={buttonClass("primary")}>
                {t("cta.submit")}
                <ArrowRight />
              </button>
            </form>

            <ul className="mt-6 flex flex-wrap gap-2" aria-label={t("a11y.standards")}>
              {[...STANDARDS, t("cta.fptTemplate")].map((std) => (
                <li
                  key={std}
                  className="rounded border border-white/[0.08] px-2 py-1 font-mono text-[11px] text-zinc-400"
                >
                  {std}
                </li>
              ))}
            </ul>
          </div>

          <dl className="self-end rounded-md border border-white/[0.06] bg-zinc-950/60 font-mono text-xs">
            {CHECKLIST.map((row) => (
              <div
                key={row.key}
                className="flex items-center justify-between gap-4 border-b border-white/[0.06] px-4 py-3 last:border-b-0"
              >
                <dt className="flex items-center gap-2 text-zinc-400">
                  <span className="text-emerald-500" aria-hidden="true">
                    ✓
                  </span>
                  {t(`cta.checklist.${row.key}`)}
                </dt>
                <dd className="text-right text-zinc-200">
                  {"translate" in row ? t(`cta.${row.value}`) : row.value}
                </dd>
              </div>
            ))}
          </dl>
        </div>

        <footer className="flex flex-col gap-4 border-t border-white/[0.06] px-6 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-10 lg:px-14">
          <div className="flex items-center gap-2 text-sm text-zinc-500">
            <Logo sizeClassName="w-5 h-5" theme="dark" showText={false} />
            <span>© 2026 FlintFlow</span>
          </div>
          <nav aria-label={t("a11y.footerNav")} className="flex flex-wrap gap-x-6 gap-y-2">
            {FOOTER_LINKS.map((link) => (
              <a key={link.href} href={link.href} className="text-sm text-zinc-500 transition-colors hover:text-[#FAFAFA]">
                {t(`nav.${link.key}`)}
              </a>
            ))}
            <a href={`mailto:${CONTACT_EMAIL}`} className="text-sm text-zinc-500 transition-colors hover:text-[#FAFAFA]">
              {CONTACT_EMAIL}
            </a>
          </nav>
        </footer>
      </div>
    </section>
  );
}
