import type { ReactNode } from "react";
import { Blob } from "./ui";

/* Tuyên ngôn thứ hai (căn phải) + 3 dịch vụ; card giữa nền gradient tím. */
export default function Services() {
  return (
    <section aria-labelledby="services-title" className="relative overflow-hidden px-4 py-16 sm:px-8 lg:p-[88px_72px]">
      <Blob className="-left-32 -top-10 hidden h-[400px] w-[440px] -rotate-8 md:block" />
      <div className="relative mx-auto max-w-[1136px]">
        <h2
          id="services-title"
          className="ml-auto max-w-[980px] text-right text-3xl font-extrabold leading-[1.12] tracking-[-0.03em] text-on-surface sm:text-[40px] lg:text-[52px]"
        >
          Chúng tôi không bán một &ldquo;PRD generator&rdquo;.
          <br />
          FlintFlow <span className="landing-gradient-text">phản biện cho mục tiêu</span>{" "}
          <span className="landing-gradient-text-warm">cụ thể của bạn.</span>
        </h2>

        <div className="mt-10 grid gap-4 md:grid-cols-3 lg:mt-14">
          <ServiceCard
            title="Làm rõ ý tưởng"
            body="Dán ý tưởng thô, transcript phỏng vấn hay BRD cũ — nhận lại câu hỏi sắc như một BA senior."
          >
            <p className="rounded-xl bg-[#F4F3FE] px-3.5 py-[11px] text-[11.5px] font-semibold text-[#5B2EC4]">
              &ldquo;MVP có cần thanh toán tích hợp không?&rdquo; <span className="text-[#B0A6D0]">· scope</span>
            </p>
          </ServiceCard>

          <ServiceCard
            featured
            title="Xác minh & readiness"
            body="Completeness score, dependency ẩn, scope vượt MVP — biết chính xác khi nào tài liệu sẵn sàng."
          >
            <div className="flex flex-wrap gap-[7px]">
              <span className="rounded-full bg-white/20 px-[13px] py-1.5 text-[10.5px] font-bold text-white">Score 72/100</span>
              <span className="rounded-full bg-white/90 px-[13px] py-1.5 text-[10.5px] font-bold text-success">● Ready to plan</span>
            </div>
          </ServiceCard>

          <ServiceCard
            title="Bàn giao cho dev & khách"
            body="Gap report chỉ rõ chỗ thiếu, checklist ký duyệt scope bằng ngôn ngữ bình dân."
          >
            <div className="flex flex-wrap gap-[7px]">
              {[".docx", "gap report", "Track Changes"].map((chip) => (
                <span
                  key={chip}
                  className="rounded-full bg-surface-container-high px-3 py-1.5 font-mono text-[10px] font-bold text-on-surface-medium"
                >
                  {chip}
                </span>
              ))}
            </div>
          </ServiceCard>
        </div>
      </div>
    </section>
  );
}

function ServiceCard({
  title,
  body,
  featured = false,
  children,
}: {
  title: string;
  body: string;
  featured?: boolean;
  children: ReactNode;
}) {
  return (
    <article
      className={`flex min-h-[250px] flex-col gap-3.5 rounded-[22px] px-[26px] py-7 ${
        featured
          ? "bg-[linear-gradient(165deg,#5B2EC4,#8B5CF0_75%,#B98BF5)] shadow-[0_24px_60px_rgba(91,46,196,0.3)]"
          : "border border-outline-variant bg-white shadow-[0_8px_26px_rgba(25,24,23,0.05)]"
      }`}
    >
      <h3 className={`text-[17px] font-extrabold ${featured ? "text-white" : "text-on-surface"}`}>{title}</h3>
      <p className={`text-[12.5px] leading-[1.65] ${featured ? "text-white/80" : "text-on-surface-variant"}`}>{body}</p>
      <div className="mt-auto">{children}</div>
    </article>
  );
}
