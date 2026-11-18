import Link from "next/link";
import { useMessages, useTranslations } from "next-intl";
import LocaleSwitcher from "@/components/LocaleSwitcher";
import Logo from "@/components/Logo";
import { CONTACT_EMAIL, LEGAL_LINKS } from "../_landing/content";

export type LegalDoc = "privacy" | "terms";

interface LegalSection {
  title: string;
  paragraphs: Record<string, string>;
  link?: { label: string; href: string };
}

/**
 * Khung chung của `/privacy` và `/terms` — trang công khai (`proxy.ts` không gác). Chữ ở `messages/<locale>.json` →
 * `legal.<doc>.sections.s<n>` = `{ title, paragraphs: { p<n> }, link? }`, đọc qua `useMessages` theo thứ tự key nên
 * thêm / bớt đoạn không phải sửa code. Messages không dùng mảng (kiểu cây ở `messages/messages.test.ts`).
 * Google OAuth consent screen trỏ tới hai trang này, nên đổi đường dẫn thì phải đổi cả ở Google Cloud Console.
 */
export default function LegalDocument({ doc }: { doc: LegalDoc }) {
  const t = useTranslations("legal");
  const sections: LegalSection[] = Object.values(useMessages().legal[doc].sections);

  return (
    <div className="min-h-screen bg-surface font-sans text-on-surface antialiased">
      <header className="flex items-center justify-between gap-3 px-4 pt-6 sm:px-6">
        <Logo variant="wordmark" sizeClassName="h-[18px] w-auto" theme="light" href="/" />
        <LocaleSwitcher />
      </header>

      <main className="mx-auto max-w-[760px] px-4 pb-16 pt-12 sm:px-6">
        <h1 className="text-3xl font-bold tracking-[-0.02em] sm:text-4xl">{t(`${doc}.title`)}</h1>
        <p className="mt-3 text-[13px] text-on-surface-muted">{t("updated")}</p>
        <p className="mt-6 text-[15px] leading-7 text-on-surface-variant">{t(`${doc}.intro`)}</p>

        {sections.map((section) => (
          <section key={section.title} className="mt-10">
            <h2 className="text-lg font-bold">{section.title}</h2>
            {Object.values(section.paragraphs).map((paragraph) => (
              <p key={paragraph} className="mt-3 text-[15px] leading-7 text-on-surface-variant">
                {paragraph}
              </p>
            ))}
            {section.link && (
              <a
                href={section.link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-block text-[15px] font-semibold text-primary underline-offset-4 hover:underline"
              >
                {section.link.label}
              </a>
            )}
          </section>
        ))}

        <section className="mt-10">
          <h2 className="text-lg font-bold">{t("contact")}</h2>
          <a href={`mailto:${CONTACT_EMAIL}`} className="mt-3 inline-block text-[15px] font-semibold text-primary">
            {CONTACT_EMAIL}
          </a>
        </section>
      </main>

      <footer className="mx-auto flex max-w-[760px] flex-wrap gap-x-6 gap-y-2 px-4 pb-10 text-[13px] font-medium text-on-surface-variant sm:px-6">
        <Link href="/" className="transition-colors hover:text-on-surface">
          {t("backHome")}
        </Link>
        {LEGAL_LINKS.map((link) => (
          <Link key={link.href} href={link.href} className="transition-colors hover:text-on-surface">
            {t(link.key)}
          </Link>
        ))}
      </footer>
    </div>
  );
}
