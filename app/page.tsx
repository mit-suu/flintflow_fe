import Link from "next/link";

const features = [
  {
    title: "Làm rõ yêu cầu",
    label: "Clarification",
    description:
      "AI đặt câu hỏi đúng trọng tâm để biến ý tưởng ban đầu thành yêu cầu rõ ràng, có ngữ cảnh và có thể triển khai.",
  },
  {
    title: "Phân tích ngữ cảnh",
    label: "Analysis",
    description:
      "Tổng hợp mục tiêu kinh doanh, người dùng, ràng buộc và rủi ro để đội sản phẩm hiểu cùng một bức tranh.",
  },
  {
    title: "Sinh đặc tả 15 section chuẩn",
    label: "Specification",
    description:
      "Tự động tạo tài liệu đặc tả phần mềm đầy đủ từ business goals, user journey đến acceptance criteria.",
  },
  {
    title: "Xác minh & hoàn thiện",
    label: "Verification",
    description:
      "Rà soát khoảng trống, mâu thuẫn và điểm thiếu chắc chắn trước khi xuất bản tài liệu cho team kỹ thuật.",
  },
];

const steps = [
  "Nhập ý tưởng",
  "AI phân tích & hỏi lại",
  "Sinh tài liệu đặc tả",
  "Review & Export",
];

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <header className="sticky top-0 z-50 border-b border-slate-800 bg-slate-950/95 backdrop-blur">
        <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-lg font-black text-white shadow-lg shadow-indigo-600/20">
              FF
            </span>
            <span className="text-sm font-bold tracking-tight text-white sm:text-base">FlintFlow</span>
          </Link>

          <div className="hidden items-center gap-6 text-sm font-medium text-slate-300 md:flex">
            <a href="#tinh-nang" className="transition hover:text-white">
              Tính năng
            </a>
            <a href="#quy-trinh" className="transition hover:text-white">
              Quy trình
            </a>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/login"
              className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-200 transition hover:bg-slate-900 hover:text-white"
            >
              Đăng nhập
            </Link>
            <Link
              href="/register"
              className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-indigo-600/20 transition hover:bg-indigo-500"
            >
              Bắt đầu miễn phí
            </Link>
          </div>
        </nav>
      </header>

      <section className="mx-auto grid max-w-7xl gap-12 px-4 py-20 sm:px-6 sm:py-24 lg:px-8 lg:py-28">
        <div className="max-w-4xl">
          <div className="mb-6 inline-flex rounded-full border border-indigo-500/30 bg-indigo-600/10 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-indigo-300">
            AI-Powered Specification Engine
          </div>
          <h1 className="max-w-5xl text-4xl font-black tracking-tight text-white sm:text-5xl lg:text-6xl">
            Từ ý tưởng đến đặc tả phần mềm hoàn chỉnh trong vài phút
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-8 text-slate-300 sm:text-lg">
            FlintFlow giúp BA, PM và đội phát triển làm rõ yêu cầu, phân tích ngữ cảnh và sinh tài liệu đặc tả có cấu trúc để bắt đầu dự án nhanh hơn.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/register"
              className="inline-flex items-center justify-center rounded-xl bg-indigo-600 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-indigo-600/20 transition hover:bg-indigo-500"
            >
              Dùng thử miễn phí
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center justify-center rounded-xl border border-slate-700 px-6 py-3 text-sm font-bold text-slate-200 transition hover:border-slate-600 hover:bg-slate-900 hover:text-white"
            >
              Đăng nhập
            </Link>
          </div>
        </div>
      </section>

      <section id="tinh-nang" className="border-y border-slate-800 bg-slate-900/40 py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-wide text-indigo-300">Tính năng</p>
            <h2 className="mt-3 text-3xl font-black tracking-tight text-white">Bốn hoạt động BA trong một luồng làm việc</h2>
          </div>

          <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {features.map((feature) => (
              <article key={feature.label} className="rounded-lg border border-slate-800 bg-slate-950 p-6">
                <p className="text-xs font-semibold uppercase tracking-wide text-indigo-300">{feature.label}</p>
                <h3 className="mt-4 text-lg font-bold text-white">{feature.title}</h3>
                <p className="mt-3 text-sm leading-6 text-slate-400">{feature.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="quy-trinh" className="py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-wide text-indigo-300">Quy trình</p>
            <h2 className="mt-3 text-3xl font-black tracking-tight text-white">Từ brief thô đến tài liệu sẵn sàng review</h2>
          </div>

          <div className="mt-10 grid gap-4 md:grid-cols-4">
            {steps.map((step, index) => (
              <div key={step} className="rounded-lg border border-slate-800 bg-slate-900 p-6">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-sm font-black text-white">
                  {index + 1}
                </div>
                <h3 className="mt-5 text-base font-bold text-white">{step}</h3>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-slate-800 bg-slate-900/40 py-16">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-6 px-4 sm:px-6 md:flex-row md:items-center lg:px-8">
          <div>
            <h2 className="text-2xl font-black tracking-tight text-white">Sẵn sàng chuẩn hóa yêu cầu dự án?</h2>
            <p className="mt-2 text-sm text-slate-400">Bắt đầu với một ý tưởng ngắn, FlintFlow sẽ giúp bạn đi tiếp phần còn lại.</p>
          </div>
          <Link
            href="/register"
            className="rounded-xl bg-indigo-600 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-indigo-600/20 transition hover:bg-indigo-500"
          >
            Bắt đầu miễn phí
          </Link>
        </div>
      </section>

      <footer className="border-t border-slate-800 py-6">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 text-xs text-slate-500 sm:px-6 md:flex-row md:items-center md:justify-between lg:px-8">
          <span>© {new Date().getFullYear()} FlintFlow. All rights reserved.</span>
          <span>AI Specification Platform</span>
        </div>
      </footer>
    </main>
  );
}
