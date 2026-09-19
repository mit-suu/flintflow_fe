import Logo from "@/components/Logo";
import { STANDARDS } from "./content";
import { ArrowRight, buttonClass, cardClass } from "./ui";

/*
 * Bento box cuối trang: CTA email + footer trong cùng một khối.
 * Form là GET thuần tới /register (không JS, không endpoint mới) — email đi theo query `?email=`.
 */

const CHECKLIST = [
  { label: "Cấu trúc section", value: "IEEE 830 / 29148" },
  { label: "Truy vết UC ↔ NFR", value: "tự động" },
  { label: "Cờ đỏ trước baseline", value: "0" },
  { label: "File giao khách", value: ".docx + Track Changes" },
];

const FOOTER_LINKS = [
  { href: "#cach-hoat-dong", label: "Cách hoạt động" },
  { href: "#bang-gia", label: "Bảng giá" },
  { href: "mailto:hello@flintflow.app", label: "hello@flintflow.app" },
];

export default function FinalCta() {
  return (
    <section aria-labelledby="cta-title" className="px-4 pb-8 sm:px-6">
      <div className={`${cardClass} mx-auto max-w-6xl overflow-hidden`}>
        <div className="grid gap-10 p-6 sm:p-10 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-16 lg:p-14">
          <div>
            <h2
              id="cta-title"
              className="text-balance text-2xl font-semibold tracking-tight text-[#FAFAFA] sm:text-3xl md:text-4xl"
            >
              Khách sẽ còn đổi yêu cầu. <span className="text-zinc-500">Spec của bạn không cần vỡ theo.</span>
            </h2>
            <p className="mt-4 max-w-md text-zinc-400">
              Nhập email công việc để mở workspace mẫu — có sẵn một SRS để bạn thử quét mâu thuẫn và tạo Change
              Request.
            </p>

            <form action="/register" method="get" className="mt-8 flex max-w-md flex-col gap-2 sm:flex-row">
              <label htmlFor="cta-email" className="sr-only">
                Email công việc
              </label>
              <input
                id="cta-email"
                name="email"
                type="email"
                required
                autoComplete="email"
                placeholder="ban@congty.vn"
                className="h-10 min-w-0 flex-1 rounded-md border border-white/[0.12] bg-zinc-950 px-3 text-sm text-[#FAFAFA] placeholder:text-zinc-600 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <button type="submit" className={buttonClass("primary")}>
                Nhận demo
                <ArrowRight />
              </button>
            </form>

            <ul className="mt-6 flex flex-wrap gap-2" aria-label="Chuẩn định dạng hỗ trợ">
              {STANDARDS.map((std) => (
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
                key={row.label}
                className="flex items-center justify-between gap-4 border-b border-white/[0.06] px-4 py-3 last:border-b-0"
              >
                <dt className="flex items-center gap-2 text-zinc-400">
                  <span className="text-emerald-500" aria-hidden="true">
                    ✓
                  </span>
                  {row.label}
                </dt>
                <dd className="text-right text-zinc-200">{row.value}</dd>
              </div>
            ))}
          </dl>
        </div>

        <footer className="flex flex-col gap-4 border-t border-white/[0.06] px-6 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-10 lg:px-14">
          <div className="flex items-center gap-2 text-sm text-zinc-500">
            <Logo sizeClassName="w-5 h-5" theme="dark" showText={false} />
            <span>© 2026 FlintFlow</span>
          </div>
          <nav aria-label="Liên kết cuối trang" className="flex flex-wrap gap-x-6 gap-y-2">
            {FOOTER_LINKS.map((link) => (
              <a key={link.href} href={link.href} className="text-sm text-zinc-500 transition-colors hover:text-[#FAFAFA]">
                {link.label}
              </a>
            ))}
          </nav>
        </footer>
      </div>
    </section>
  );
}
