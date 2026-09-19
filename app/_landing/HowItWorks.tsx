import { PHASE_LABELS_VI } from "@/lib/constants/step-registry";
import { HOW_HEADING, PHASE_GROUPS } from "./content";
import * as motion from "motion/react-client";
import { fadeUp, fadeUpThen, inView, stagger } from "./motion";
import { PhaseRibbon, SectionHeading, TONE_FILL, Texture } from "./ui";

/*
 * Bốn bước BA trải trên 12 giai đoạn thật: mỗi bước là một khối màu pastel (bộ màu thư mục của dashboard),
 * rộng theo số giai đoạn nó chứa, bên trong liệt kê từng giai đoạn. Mép trên là dải 12 giai đoạn cùng bộ màu.
 */
export default function HowItWorks() {
  return (
    <section id="cach-hoat-dong" aria-labelledby="how-title" className="relative scroll-mt-24 bg-surface-container-lowest px-4 pb-20 pt-0 sm:px-6 lg:pb-28">
      <Texture kind="dots" mask="radial-gradient(ellipse 55% 60% at 100% 0%, #000, transparent)" />
      <PhaseRibbon groups={PHASE_GROUPS} className="relative mx-auto h-1.5 max-w-[1200px] -translate-y-1/2" />
      <div className="relative mx-auto max-w-[1200px] pt-16 lg:pt-24">
        <SectionHeading id="how-title" eyebrow={HOW_HEADING.eyebrow} title={HOW_HEADING.title} subline={HOW_HEADING.subline} />

        <motion.ol {...inView} variants={stagger(0.08)} className="mt-12 grid gap-3 md:grid-cols-2 lg:grid-cols-[2fr_2fr_4fr_2fr]">
          {PHASE_GROUPS.map((group, i) => (
            <motion.li key={group.title} variants={fadeUpThen(0.04, 0.2)} className={`flex flex-col rounded-card p-5 sm:p-6 ${TONE_FILL[group.tone].body}`}>
              <div className="flex items-baseline justify-between gap-3">
                <h3 className="text-[20px] font-bold tracking-tight text-on-surface">{group.title}</h3>
                <span className="font-mono text-[12px] font-bold text-on-surface/50">0{i + 1}</span>
              </div>
              <p className="mt-2 text-[13.5px] leading-relaxed text-on-surface-medium">{group.body}</p>
              <ul className="mt-6 flex flex-wrap gap-1.5 pt-1" aria-label={`Giai đoạn thuộc bước ${group.title}`}>
                {group.phases.map((phase) => (
                  <motion.li
                    key={phase}
                    variants={fadeUp}
                    className="inline-flex items-center gap-1.5 rounded-inner bg-surface-container-lowest/70 px-2.5 py-1.5 text-[11.5px] font-semibold text-on-surface-dark"
                  >
                    <span className="font-mono text-[10.5px] text-on-surface-muted">{phase}</span>
                    {PHASE_LABELS_VI[phase]}
                  </motion.li>
                ))}
              </ul>
            </motion.li>
          ))}
        </motion.ol>
      </div>
    </section>
  );
}
