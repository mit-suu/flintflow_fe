import type { ReactNode } from "react";
import { cardClass, SectionHeading } from "./ui";

/*
 * Bento bất đối xứng: cột trái 1/3 xếp hai bước đầu, card lớn 2/3 bên phải cho bước 03
 * (Change Request + Track Changes). Trên mobile đọc tuần tự 01 → 02 → 03.
 */

export default function HowItWorks() {
  return (
    <section
      id="cach-hoat-dong"
      aria-labelledby="how-title"
      className="scroll-mt-20 border-t border-white/[0.06] px-4 py-20 sm:px-6 md:py-28"
    >
      <div className="mx-auto max-w-6xl">
        <SectionHeading
          eyebrow="Cách hoạt động"
          title={<span id="how-title">Ba bước. Không bước nào để spec tự vỡ.</span>}
          description="Scope creep không đến từ một yêu cầu lớn — nó đến từ hai mươi dòng email không ai đối chiếu lại với spec."
        />

        <div className="mt-12 grid gap-4 lg:grid-cols-3 lg:grid-rows-2">
          <StepCard step="01" title="Quét mâu thuẫn tài liệu có sẵn" body="Thả file .docx đang dùng. FlintFlow bóc từng UC, NFR, business rule và chỉ ra chỗ chúng đá nhau.">
            <ul className="space-y-1.5 font-mono text-xs">
              <li className="flex gap-2 text-red-400">
                <span aria-hidden="true">✕</span>UC-07 ↔ NFR-02 · thời hạn
              </li>
              <li className="flex gap-2 text-amber-400">
                <span aria-hidden="true">!</span>UC-12 · thiếu actor
              </li>
              <li className="flex gap-2 text-emerald-400">
                <span aria-hidden="true">✓</span>142 yêu cầu nhất quán
              </li>
            </ul>
          </StepCard>

          <StepCard
            step="02"
            title="Chuẩn hoá theo template"
            body="Mẫu FPT hoặc mẫu bắt buộc của khách — nội dung vào đúng section, đúng cột, giữ nguyên định dạng gốc."
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
  { id: "F-S04-01", note: "thêm validation PCCC" },
  { id: "UC-03", note: "thêm điều kiện nộp" },
  { id: "UC-07", note: "thêm bước thẩm định" },
];

function ChangeRequestCard() {
  return (
    <article
      className={`${cardClass} flex flex-col p-6 transition-colors hover:border-white/[0.14] sm:p-8 lg:col-span-2 lg:col-start-2 lg:row-span-2 lg:row-start-1`}
    >
      <span className="font-mono text-xs text-zinc-600">03</span>
      <h3 className="mt-3 text-lg font-medium text-[#FAFAFA] sm:text-xl">Đổi yêu cầu không vỡ spec</h3>
      <p className="mt-2 max-w-lg text-sm leading-relaxed text-zinc-400">
        Khách thêm một dòng trong email? FlintFlow khoanh vùng mọi chỗ bị ảnh hưởng, soạn Change Request — bạn
        duyệt rồi mới ghi. File trả về giữ nguyên Track Changes.
      </p>

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
          <p className="mt-4 text-zinc-600">47 section khác · không đổi</p>
        </div>

        {/* Track Changes */}
        <div className="rounded-md border border-white/[0.06] bg-[#FAFAFA] p-4 text-[13px] leading-relaxed text-zinc-700">
          <div className="mb-3 flex items-center justify-between font-mono text-[11px] text-zinc-400">
            <span>srs_v2.4.docx</span>
            <span>Track Changes</span>
          </div>
          <p className="font-medium text-zinc-900">UC-03 · Nộp hồ sơ — Điều kiện</p>
          <p className="mt-2">
            Người nộp đã đăng nhập và có bản vẽ thiết kế hợp lệ
            <del className="text-red-600 decoration-red-600">.</del>
            <ins className="text-blue-600 decoration-blue-600">
              ; công trình trên 7 tầng phải có văn bản thẩm duyệt PCCC.
            </ins>
          </p>
          <p className="mt-3 inline-flex items-center gap-1.5 rounded border border-zinc-200 px-1.5 py-0.5 font-mono text-[10px] text-zinc-500">
            <span className="size-1.5 rounded-full bg-blue-600" aria-hidden="true" />
            tác giả: CR-012
          </p>
        </div>
      </div>
    </article>
  );
}
