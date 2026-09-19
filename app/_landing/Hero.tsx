import * as motion from "motion/react-client";
import { PHASES } from "@/lib/constants/step-registry";
import { CHECK_CARD, HERO, PREVIEW_FOLDER, PREVIEW_PROJECTS } from "./content";
import { EASE_OUT, fadeUp, fadeUpThen, onLoad, stagger } from "./motion";
import { ArrowRight, ButtonLink, Diamond, Eyebrow, FolderShape, PhaseBar, Texture } from "./ui";

/*
 * Hero: chữ bên trái; bên phải là "ảnh chụp" dashboard dựng bằng chính ngôn ngữ của nó (card trắng nổi,
 * thẻ thư mục, card dự án tím pastel + thanh 12 giai đoạn) và thẻ kiểm tra 3 tầng; phía sau là hai tờ tài liệu xếp lệch.
 * Chuyển động khi tải: chữ hiện lần lượt → collage nổi lên, hai tờ tài liệu xoè ra → thanh tiến độ chạy tới đúng
 * giai đoạn → kết quả kiểm tra hiện sau cùng.
 */
export default function Hero() {
  return (
    <section aria-labelledby="hero-title" className="relative isolate px-4 pb-20 pt-10 sm:px-6 lg:pb-28 lg:pt-16">
      {/* "Sân khấu" tím nhạt phẳng ôm lấy collage, tràn ra mép phải; lưới chấm mờ dần quanh nó */}
      <motion.div
        aria-hidden="true"
        initial={{ opacity: 0, x: 48 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.6, ease: EASE_OUT }}
        className="absolute inset-y-6 right-0 -z-10 hidden w-[47%] rounded-l-[48px] bg-primary-fixed lg:block"
      />
      <Texture kind="dots" mask="radial-gradient(ellipse 40% 60% at 72% 50%, #000, transparent)" className="-z-10 hidden lg:block" />
      <div className="mx-auto grid max-w-[1200px] items-center gap-14 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:gap-14">
        <motion.div {...onLoad} variants={stagger(0.07)}>
          <motion.div variants={fadeUp}>
            <Eyebrow className="rounded-full bg-primary-soft px-3.5 py-1.5 text-primary-hover">{HERO.eyebrow}</Eyebrow>
          </motion.div>
          <motion.h1
            variants={fadeUp}
            id="hero-title"
            className="mt-6 text-[34px] font-bold leading-[1.05] tracking-[-0.04em] text-on-surface sm:text-[56px] xl:text-[60px]"
          >
            {HERO.headline}
            <br />
            <span className="text-primary">
              {HERO.headlineAccent}
              <span className="sr-only">.</span>
            </span>
            {/* Hạt kim cương "rơi" vào chỗ dấu chấm */}
            <motion.span
              aria-hidden="true"
              className="inline-block"
              initial={{ opacity: 0, y: -24, rotate: -90 }}
              animate={{ opacity: 1, y: 0, rotate: 0 }}
              transition={{ delay: 0.55, type: "spring", stiffness: 380, damping: 18 }}
            >
              <Diamond className="mb-2 ml-3 size-3.5 sm:size-4" />
            </motion.span>
          </motion.h1>
          <motion.p
            variants={fadeUp}
            className="mt-6 max-w-[540px] text-pretty text-base leading-relaxed text-on-surface-variant sm:text-[17px]"
          >
            {HERO.subline}
          </motion.p>
          <motion.div variants={fadeUp} className="mt-8 flex flex-wrap gap-3">
            <ButtonLink href="/register" className="group">
              {HERO.primaryCta}
              <ArrowRight className="size-4 transition-transform duration-200 group-hover:translate-x-0.5" />
            </ButtonLink>
            <ButtonLink href="#workspace" variant="secondary">
              {HERO.secondaryCta}
            </ButtonLink>
          </motion.div>
          <motion.ul variants={stagger(0.06)} className="mt-10 grid gap-2.5 text-[14px] font-medium text-on-surface-medium">
            {HERO.facts.map((fact) => (
              <motion.li key={fact} variants={fadeUp} className="flex items-center gap-3">
                <span aria-hidden="true" className="grid size-6 place-items-center rounded-inner bg-success-soft text-[12px] font-bold text-success">
                  ✓
                </span>
                {fact}
              </motion.li>
            ))}
          </motion.ul>
        </motion.div>

        <DashboardCollage />
      </div>
    </section>
  );
}

const sheet = (rotate: number, x: number, y: number) => ({
  hidden: { rotate: 0, x: 0, y: 0 },
  show: { rotate, x, y, transition: { delay: 0.35, duration: 0.55, ease: EASE_OUT } },
});

/* Minh hoạ tĩnh, không gọi API. Số giai đoạn lấy từ step registry thật. */
function DashboardCollage() {
  return (
    <motion.figure {...onLoad} variants={stagger(0.12, 0.2)} aria-label="Minh hoạ dashboard FlintFlow" className="relative mx-2 sm:mx-4">
      {/* Hai tờ "tài liệu" nằm gọn sau card rồi xoè ra, lệch góc nhẹ */}
      <motion.div aria-hidden="true" variants={sheet(3, 12, 20)} className="absolute inset-0 rounded-dialog bg-folder-rose" />
      <motion.div aria-hidden="true" variants={sheet(-2.5, -8, 12)} className="absolute inset-0 rounded-dialog bg-folder-blue" />
      <motion.div
        variants={{
          hidden: { opacity: 0, y: 24, scale: 0.97 },
          show: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.5, ease: EASE_OUT, staggerChildren: 0.12, delayChildren: 0.25 } },
        }}
        className="relative rounded-dialog bg-surface-container-lowest p-4 shadow-[0_1px_2px_rgba(25,24,23,0.04),0_12px_32px_rgba(25,24,23,0.08)] sm:p-6"
      >
        <div className="mb-4 flex items-center gap-2">
          <p className="text-[17px] font-semibold tracking-tight text-on-surface">Dự án của bạn</p>
          <span className="rounded-full bg-surface-container-highest px-2 py-0.5 text-[11px] font-bold text-on-surface-variant">3</span>
        </div>
        <div className="grid gap-3 sm:grid-cols-[0.85fr_1fr]">
          <motion.div variants={fadeUp}>
            <FolderShape tone="amber" className="h-full" bodyClassName="flex min-h-[120px] flex-col gap-3 px-5 pb-4 pt-5">
              <span className="text-[15px] font-semibold text-on-surface">{PREVIEW_FOLDER.name}</span>
              <span aria-hidden="true" className="mt-auto h-px bg-on-surface/10" />
              <span className="text-right text-[12px] text-on-surface-variant">{PREVIEW_FOLDER.count}</span>
            </FolderShape>
          </motion.div>
          <div className="grid gap-3 sm:pt-[22px]">
            {PREVIEW_PROJECTS.map((project) => (
              <motion.div
                key={project.name}
                variants={fadeUpThen(0, 0.3)}
                className="rounded-card bg-surface-card px-4 py-3.5"
              >
                <p className="flex items-center gap-1.5 text-[11.5px] font-semibold text-on-card-strong">
                  <span
                    aria-hidden="true"
                    className={`size-1.5 rounded-full ${project.status.tone === "ok" ? "bg-success" : "bg-accent-gold"}`}
                  />
                  {project.status.label}
                </p>
                <p className="mt-1 text-[14px] font-semibold text-on-card">{project.name}</p>
                <p className="mt-2.5 text-[11.5px] text-on-card-variant">
                  Giai đoạn {project.phasesDone + 1}/{PHASES.length} · {project.next}
                </p>
                <div className="mt-2">
                  <PhaseBar done={project.phasesDone} />
                </div>
              </motion.div>
            ))}
          </div>
        </div>
        <CheckCard />
      </motion.div>
    </motion.figure>
  );
}

const TIER_STYLES = {
  ok: { tag: "bg-success-soft text-success", mark: "✓" },
  warn: { tag: "bg-accent-gold-soft text-accent-gold-text", mark: "!" },
} as const;

/* Hàng cuối của collage: kết quả kiểm tra 3 tầng — từng tầng "đóng dấu" lần lượt. */
function CheckCard() {
  return (
    <motion.div variants={fadeUpThen(0.12, 0.35)} className="mt-3 rounded-card bg-surface-sidebar p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[12.5px] font-bold text-on-surface">{CHECK_CARD.title}</p>
        <span className="inline-flex items-center gap-1 rounded-full bg-success-soft px-2 py-0.5 text-[10.5px] font-bold text-success">
          <span aria-hidden="true" className="size-1.5 rounded-full bg-success-dark" />
          {CHECK_CARD.status}
        </span>
      </div>
      <p className="mt-2 text-[26px] font-bold leading-none text-on-surface">
        {CHECK_CARD.count} <span className="text-[12.5px] font-medium text-on-surface-muted">{CHECK_CARD.countLabel}</span>
      </p>
      <div className="mt-3 grid grid-cols-3 gap-1.5">
        {CHECK_CARD.tiers.map((tier) => (
          <motion.span
            key={tier.label}
            variants={{
              hidden: { opacity: 0, scale: 0.85 },
              show: { opacity: 1, scale: 1, transition: { type: "spring", stiffness: 420, damping: 22 } },
            }}
            className={`rounded-inner px-2 py-1.5 text-[10.5px] font-bold ${TIER_STYLES[tier.tone].tag}`}
          >
            {TIER_STYLES[tier.tone].mark} {tier.label}
          </motion.span>
        ))}
      </div>
    </motion.div>
  );
}
