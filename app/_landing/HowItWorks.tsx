import { PHASE_LABELS_VI } from "@/lib/constants/step-registry";
import { HOW_HEADING, PHASE_GROUPS } from "./content";
import { SectionHeading, TONE_FILL } from "./ui";

/*
 * Bốn bước BA trải trên 12 giai đoạn thật: mỗi bước là một khối màu pastel (bộ màu thư mục của dashboard),
 * rộng theo số giai đoạn nó chứa, bên trong liệt kê từng giai đoạn.
 */
export default function HowItWorks() {
  return (
    <section id="cach-hoat-dong" aria-labelledby="how-title" className="scroll-mt-20 bg-surface-sidebar px-4 py-20 sm:px-6 lg:py-28">
      <div className="mx-auto max-w-[1200px]">
        <SectionHeading id="how-title" eyebrow={HOW_HEADING.eyebrow} title={HOW_HEADING.title} subline={HOW_HEADING.subline} />

        <ol className="mt-12 grid gap-3 md:grid-cols-2 lg:grid-cols-[2fr_2fr_4fr_2fr]">
          {PHASE_GROUPS.map((group, i) => (
            <li key={group.title} className={`flex flex-col rounded-card p-5 sm:p-6 ${TONE_FILL[group.tone].body}`}>
              <div className="flex items-baseline justify-between gap-3">
                <h3 className="text-[20px] font-bold tracking-tight text-on-surface">{group.title}</h3>
                <span className="font-mono text-[12px] font-bold text-on-surface/50">0{i + 1}</span>
              </div>
              <p className="mt-2 text-[13.5px] leading-relaxed text-on-surface-medium">{group.body}</p>
              <ul className="mt-6 flex flex-wrap gap-1.5 pt-1" aria-label={`Giai đoạn thuộc bước ${group.title}`}>
                {group.phases.map((phase) => (
                  <li
                    key={phase}
                    className="inline-flex items-center gap-1.5 rounded-inner bg-surface-container-lowest/70 px-2.5 py-1.5 text-[11.5px] font-semibold text-on-surface-dark"
                  >
                    <span className="font-mono text-[10.5px] text-on-surface-muted">{phase}</span>
                    {PHASE_LABELS_VI[phase]}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
