import { MODES, MODES_HEADING } from "./content";
import { FolderShape, SectionHeading } from "./ui";

/* Ba cách bắt đầu dự án, vẽ bằng thẻ thư mục của dashboard — mỗi chế độ một màu, cùng tone với bước tạo dự án. */
export default function Modes() {
  return (
    <section id="che-do" aria-labelledby="modes-title" className="scroll-mt-24 px-4 py-20 sm:px-6 lg:py-28">
      <div className="mx-auto max-w-[1200px]">
        <SectionHeading id="modes-title" eyebrow={MODES_HEADING.eyebrow} title={MODES_HEADING.title} />

        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {MODES.map((mode) => (
            <FolderShape key={mode.title} tone={mode.tone} bodyClassName="flex min-h-[260px] flex-col gap-3 px-6 pb-6 pt-7">
              <h3 className="text-[20px] font-bold tracking-tight text-on-surface">{mode.title}</h3>
              <p className="text-[14px] leading-relaxed text-on-surface-medium">{mode.body}</p>
              <span aria-hidden="true" className="mt-auto h-px bg-on-surface/10" />
              <ul className="flex flex-wrap gap-1.5">
                {mode.tags.map((tag) => (
                  <li key={tag} className="rounded-inner bg-surface-container-lowest/70 px-2.5 py-1 text-[12px] font-semibold text-on-surface-dark">
                    {tag}
                  </li>
                ))}
              </ul>
            </FolderShape>
          ))}
        </div>
      </div>
    </section>
  );
}
