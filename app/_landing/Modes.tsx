import { MODES, MODES_HEADING, type Mode } from "./content";
import { Blob } from "./ui";

/* Ba chế độ bắt đầu dự án (căn phải) — cùng một quy trình; card giữa nền gradient tím. */
export default function Modes() {
  return (
    <section aria-labelledby="modes-title" className="relative overflow-hidden px-4 py-16 sm:px-8 lg:p-[88px_72px]">
      <Blob className="-left-32 -top-10 hidden h-[400px] w-[440px] -rotate-8 md:block" />
      <div className="relative mx-auto max-w-[1136px]">
        <h2
          id="modes-title"
          className="ml-auto max-w-[980px] text-right text-3xl font-extrabold leading-[1.12] tracking-[-0.03em] text-on-surface sm:text-[40px] lg:text-[52px]"
        >
          {MODES_HEADING.lead}
          <span className="landing-gradient-text">{MODES_HEADING.accent}</span>
        </h2>

        <div className="mt-10 grid gap-4 md:grid-cols-3 lg:mt-14">
          {MODES.map((mode) => (
            <ModeCard key={mode.title} mode={mode} />
          ))}
        </div>
      </div>
    </section>
  );
}

function ModeCard({ mode }: { mode: Mode }) {
  const { featured = false } = mode;
  return (
    <article
      className={`flex min-h-[250px] flex-col gap-3.5 rounded-[22px] px-[26px] py-7 ${
        featured
          ? "bg-[linear-gradient(165deg,#554DB0,#6A62C4_75%,#8E87D6)] shadow-[0_24px_60px_rgba(85,77,176,0.3)]"
          : "border border-outline-variant bg-white shadow-[0_8px_26px_rgba(25,24,23,0.05)]"
      }`}
    >
      <h3 className={`text-[17px] font-extrabold ${featured ? "text-white" : "text-on-surface"}`}>{mode.title}</h3>
      <p className={`text-[12.5px] leading-[1.65] ${featured ? "text-white/80" : "text-on-surface-variant"}`}>{mode.body}</p>
      <div className="mt-auto">
        {mode.quote && (
          <p className="rounded-xl bg-primary-soft px-3.5 py-[11px] text-[11.5px] font-semibold text-primary-hover">
            {mode.quote.text} <span className="text-[#A7A2CF]">{mode.quote.tag}</span>
          </p>
        )}
        {mode.chips && (
          <div className="flex flex-wrap gap-[7px]">
            {mode.chips.map((chip) => (
              <span
                key={chip}
                className={
                  featured
                    ? "rounded-full bg-white/20 px-[13px] py-1.5 text-[10.5px] font-bold text-white"
                    : "rounded-full bg-surface-container-high px-3 py-1.5 font-mono text-[10px] font-bold text-on-surface-medium"
                }
              >
                {chip}
              </span>
            ))}
          </div>
        )}
      </div>
    </article>
  );
}
