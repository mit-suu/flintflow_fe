import { PROCESS, STATEMENT } from "./content";
import { GridBackdrop } from "./ui";

/* Tuyên ngôn + 4 bước đánh số; bước 02 nổi bật bằng viền gradient. */
export default function HowItWorks() {
  return (
    <section
      id="cach-hoat-dong"
      aria-labelledby="how-title"
      className="relative scroll-mt-24 border-t border-outline-variant bg-white px-4 py-16 sm:px-8 lg:px-[72px] lg:pb-20 lg:pt-[72px]"
    >
      <GridBackdrop mask="radial-gradient(ellipse 70% 80% at 50% 0%, #000, transparent)" className="opacity-60" />
      <div className="relative mx-auto max-w-[1136px]">
        <h2
          id="how-title"
          className="max-w-[880px] text-2xl font-bold leading-[1.45] tracking-[-0.01em] text-on-surface sm:text-[34px]"
        >
          {STATEMENT.lead}
          <span className="font-extrabold text-primary">{STATEMENT.highlight}</span>
          {STATEMENT.middle}
          <span className="landing-gradient-text-warm font-extrabold">{STATEMENT.gradient}</span>
          {STATEMENT.tail}
        </h2>

        <ol className="mt-10 grid gap-3.5 sm:grid-cols-2 lg:mt-[52px] lg:grid-cols-4">
          {PROCESS.map((item) => {
            const featured = "featured" in item && item.featured;
            return (
              <li
                key={item.step}
                className={`flex flex-col gap-10 rounded-[20px] px-[22px] py-6 ${
                  featured
                    ? "landing-gradient-border shadow-[0_16px_44px_rgba(106,98,196,0.16)] [--landing-fill:#F8F7FC]"
                    : "border border-outline-variant bg-surface"
                }`}
              >
                <span className={`font-mono text-[22px] font-extrabold ${featured ? "text-primary" : "text-[#C9C5BD]"}`}>
                  {item.step}
                </span>
                <div>
                  <h3 className="text-[15px] font-extrabold text-on-surface">{item.title}</h3>
                  <p className="mt-[7px] text-[12.5px] leading-relaxed text-on-surface-variant">
                    {item.body}
                    {"emphasis" in item && <span className="font-bold text-[#B8860B]">{item.emphasis}</span>}
                    {"emphasis" in item && "."}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
