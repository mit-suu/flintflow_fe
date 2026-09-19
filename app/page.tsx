import Link from "next/link";
import Logo from "../components/Logo";

/*
 * Landing page — định vị mới: nền tảng AI soạn, kiểm chứng và quản lý thay đổi SRS
 * (thay cho "AI BA sinh Brief & PRD" cũ). Thứ tự section, anchor id và data-purpose giữ nguyên;
 * chỗ đổi nội dung được đánh dấu [CẬP NHẬT]. Nội dung lặp lại tách thành mảng bên dưới để sửa
 * copy không phải lội JSX.
 *
 * Số liệu gói cước khớp `flintflow_be/src/modules/billing/plan.config.ts` — đổi ở BE thì đổi ở đây.
 */

const NAV_LINKS = [
  { href: "#cach-hoat-dong", label: "Cách hoạt động" },
  { href: "#workspace-preview", label: "Xem demo" },
  { href: "#pricing", label: "Bảng giá" },
];

// [CẬP NHẬT] Metric hero: bỏ "< 3s" / "120 credits" cũ, dùng con số phản ánh sản phẩm hiện tại.
const HERO_METRICS = [
  { value: "3", label: "cách bắt đầu, một chuẩn chất lượng" },
  { value: "0", label: "cờ đỏ trước khi chốt baseline" },
  { value: "100", label: "credit miễn phí mỗi tháng" },
];

// [CẬP NHẬT] Section "Cách hoạt động": 3 chế độ làm việc + luồng Change Request sau baseline.
const MODES = [
  {
    no: "01",
    title: "Sửa SRS đang có",
    body: "Tải lên file .docx đang dùng. FlintFlow đọc, kiểm lỗi và trả lại chính file đó kèm Track Changes.",
  },
  {
    no: "02",
    title: "Tạo mới theo mẫu FPT",
    body: "Chưa có mẫu? Đi từ ý tưởng thô tới SRS chuẩn FPT — AI chỉ hỏi phần còn thiếu.",
    featured: true,
  },
  {
    no: "03",
    title: "Theo mẫu của khách",
    body: "Khách bắt buộc mẫu riêng? Tải mẫu lên, nội dung được điền đúng chỗ, giữ nguyên định dạng.",
  },
  {
    no: "04",
    title: "Đổi yêu cầu, không vỡ tài liệu",
    body: "Sau baseline, mỗi thay đổi là một Change Request: thấy ngay phần bị ảnh hưởng, duyệt rồi mới ghi.",
  },
];

// [CẬP NHẬT] Bảng giá theo plan.config.ts: Free 100 credit, Pro 199k / 1.000 credit, gói lẻ 100/500/1.500.
const PLANS = [
  {
    name: "Free",
    price: "0đ",
    unit: "/tháng",
    perks: ["100 credit làm mới mỗi tháng", "Đủ 3 cách bắt đầu một SRS", "Không cần thẻ thanh toán"],
    cta: "Bắt đầu miễn phí",
  },
  {
    name: "Pro",
    price: "199k",
    unit: "/tháng",
    perks: [
      "1.000 credit mỗi tháng — gấp 10 lần Free",
      "Đủ cho nhiều dự án chạy song song",
      "Đổi gói ngay trong app, không cần liên hệ",
    ],
    cta: "Dùng gói Pro",
    featured: true,
  },
  {
    name: "Gói credit",
    price: "Mua lẻ",
    unit: "khi cần",
    perks: ["Gói 100 · 500 · 1.500 credit", "Cộng thẳng vào ví của tổ chức", "Dùng kèm với mọi gói"],
    cta: "Xem gói credit",
  },
];

function ArrowRight({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M14 5l7 7m0 0l-7 7m7-7H3" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg className="w-4 h-4 mt-0.5 shrink-0 text-brand-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} />
    </svg>
  );
}

export default function LandingPage() {
  return (
    <div className="bg-dark-900 text-[#f3f4f6] font-sans antialiased relative min-h-screen overflow-x-hidden">
      {/* Background Orbs */}
      <div className="bg-orb w-[600px] h-[600px] top-[-100px] right-[-200px]" data-purpose="bg-decoration" />
      <div className="bg-orb w-[800px] h-[800px] top-[40%] left-[-300px]" data-purpose="bg-decoration" />
      <div
        className="bg-orb w-[500px] h-[500px] bottom-[-100px] right-[-100px] opacity-30"
        data-purpose="bg-decoration"
      />

      {/* BEGIN: Header */}
      <header
        className="fixed top-0 left-0 right-0 z-50 px-4 sm:px-6 py-3 sm:py-4 border-b border-white/5 bg-dark-900/70 backdrop-blur-md"
        data-purpose="main-header"
      >
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <Logo
            sizeClassName="w-8 h-8"
            theme="dark"
            showText={true}
            textClassName="text-white font-extrabold text-lg tracking-tight"
            href="/"
          />
          {/* [CẬP NHẬT] Nav tiếng Việt thống nhất, bỏ mục "Docs" trỏ nhầm vào demo */}
          <nav className="hidden md:flex items-center gap-1 bg-dark-800 rounded-full p-1 border border-white/5">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                className="px-4 py-1.5 text-sm font-medium text-gray-400 rounded-full hover:text-white hover:bg-dark-700 transition-colors"
                href={link.href}
              >
                {link.label}
              </a>
            ))}
          </nav>
          <div className="flex items-center gap-3 sm:gap-4">
            <Link className="text-sm font-medium text-gray-300 hover:text-white transition-colors" href="/login">
              Đăng nhập
            </Link>
            <Link
              className="bg-brand-600 hover:bg-brand-500 text-white text-sm font-semibold px-4 sm:px-5 py-2 rounded-full transition-all shadow-[0_0_15px_rgba(139,92,246,0.45)] hover:-translate-y-px"
              href="/register"
            >
              <span className="sm:hidden">Dùng thử</span>
              <span className="hidden sm:inline">Dùng thử miễn phí</span>
            </Link>
          </div>
        </div>
      </header>
      {/* END: Header */}

      {/* BEGIN: Main Content */}
      <main className="pt-24 sm:pt-32 pb-16 sm:pb-20 overflow-hidden">
        {/* BEGIN: Hero Section */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 pt-8 sm:pt-10 pb-16 sm:pb-24 relative" data-purpose="hero-section">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            {/* Hero Text */}
            <div className="max-w-2xl landing-fade-up">
              {/* [CẬP NHẬT] Badge + headline + mô tả theo định vị SRS */}
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-900/50 border border-brand-500/30 text-brand-300 text-xs font-semibold mb-6 tracking-wide">
                <span className="w-1.5 h-1.5 rounded-full bg-brand-400 animate-pulse" />
                NỀN TẢNG AI SOẠN &amp; QUẢN LÝ SRS
              </div>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-extrabold tracking-tight leading-[1.1] mb-6">
                Từ ý tưởng thô
                <br />
                đến SRS <span className="text-gradient-purple">đã chốt.</span>
              </h1>
              <p className="text-base sm:text-lg text-gray-400 mb-8 sm:mb-10 max-w-xl leading-relaxed">
                FlintFlow hỏi đúng phần còn thiếu, bắt mâu thuẫn trước khi dev phát hiện và giữ tài liệu
                luôn khớp khi khách đổi yêu cầu. Bạn chỉ việc duyệt.
              </p>
              {/* [CẬP NHẬT] CTA chính nói rõ kết quả; CTA phụ dẫn tới demo workspace */}
              <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-3 sm:gap-4 mb-12 sm:mb-16">
                <Link
                  className="group bg-gradient-to-r from-brand-600 to-brand-500 text-white font-semibold px-6 py-3 rounded-full flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(139,92,246,0.4)] hover:shadow-[0_0_30px_rgba(139,92,246,0.6)] hover:-translate-y-0.5 transition-all"
                  href="/register"
                >
                  Tạo SRS đầu tiên — miễn phí
                  <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                </Link>
                <a
                  className="bg-dark-800 hover:bg-dark-700 text-white font-medium px-6 py-3 rounded-full flex items-center justify-center gap-2 border border-white/10 transition-colors"
                  href="#workspace-preview"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                    <path
                      clipRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z"
                      fillRule="evenodd"
                    />
                  </svg>
                  Xem workspace
                </a>
              </div>
              {/* Metrics */}
              <div className="grid grid-cols-3 gap-3 sm:gap-4 border-t border-white/5 pt-8">
                {HERO_METRICS.map((m) => (
                  <div key={m.label} className="glass-card p-3 sm:p-4">
                    <div className="text-xl sm:text-2xl font-bold text-white mb-1">{m.value}</div>
                    <div className="text-[11px] sm:text-xs text-gray-500 leading-snug">{m.label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Hero Visual — [CẬP NHẬT] hiện cả trên mobile (xếp dưới text) thay vì ẩn hẳn */}
            <div className="relative landing-fade-up [animation-delay:150ms]">
              <div className="relative mx-auto max-w-md lg:max-w-none lg:w-[26rem] lg:ml-auto">
                {/* Thẻ tiến độ kiểm chứng */}
                <div className="glass-card p-5 border-white/10 bg-dark-900/80 shadow-2xl landing-float">
                  <div className="flex items-center justify-between gap-3 mb-4">
                    <span className="text-xs font-semibold text-gray-400 tracking-wider">KIỂM CHỨNG SRS</span>
                    <span className="text-[10px] bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full border border-green-500/30 whitespace-nowrap">
                      ✦ Sẵn sàng baseline
                    </span>
                  </div>
                  <div className="mb-4">
                    <div className="flex items-baseline gap-2 mb-2">
                      <span className="text-3xl font-bold text-white">0</span>
                      <span className="text-sm text-gray-400">cờ đỏ còn chặn</span>
                    </div>
                    <div className="h-1.5 w-full bg-dark-800 rounded-full overflow-hidden">
                      <div className="h-full w-full bg-gradient-to-r from-brand-500 to-green-500" />
                    </div>
                  </div>
                  <ul className="space-y-2 text-xs">
                    <li className="flex items-center justify-between rounded-lg bg-dark-800 border border-white/5 px-3 py-2">
                      <span className="text-gray-300">Mâu thuẫn giữa UC &amp; NFR</span>
                      <span className="text-green-400 font-medium">Đã sửa</span>
                    </li>
                    <li className="flex items-center justify-between rounded-lg bg-dark-800 border border-white/5 px-3 py-2">
                      <span className="text-gray-300">Chức năng thiếu truy vết</span>
                      <span className="text-green-400 font-medium">Đã sửa</span>
                    </li>
                    <li className="flex items-center justify-between rounded-lg bg-yellow-500/10 border border-yellow-500/20 px-3 py-2">
                      <span className="text-gray-300">Giả định cần khách xác nhận</span>
                      <span className="text-yellow-400 font-medium">Chờ duyệt</span>
                    </li>
                  </ul>
                </div>
                {/* Thẻ Change Request nổi */}
                <div className="hidden sm:flex absolute -bottom-8 -left-6 lg:-left-16 items-center gap-3 glass-card px-4 py-3 border-brand-500/30 bg-brand-900/60 shadow-xl">
                  <span className="w-8 h-8 rounded-full bg-brand-600 flex items-center justify-center text-xs font-bold">
                    CR
                  </span>
                  <div>
                    <div className="text-xs font-semibold text-white">CR-012 · 3 chỗ bị ảnh hưởng</div>
                    <div className="text-[11px] text-brand-200">Xuất .docx kèm Track Changes</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          {/* Scroll Indicator */}
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 hidden lg:flex justify-center">
            <a
              href="#cach-hoat-dong"
              aria-label="Cuộn xuống"
              className="w-8 h-8 rounded-full border border-white/10 flex items-center justify-center text-gray-500 hover:text-white hover:border-white/30 transition-colors animate-bounce"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M19 14l-7 7m0 0l-7-7m7 7V3" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} />
              </svg>
            </a>
          </div>
        </section>
        {/* END: Hero Section */}

        {/* BEGIN: Value Proposition Section — [CẬP NHẬT] 4 card = 3 chế độ + Change Request */}
        <section
          id="cach-hoat-dong"
          className="max-w-7xl mx-auto px-4 sm:px-6 py-16 sm:py-24 scroll-mt-24"
          data-purpose="value-prop"
        >
          <div className="max-w-3xl mb-10 sm:mb-16">
            <p className="text-xs font-bold tracking-widest text-brand-400 uppercase mb-3">Cách hoạt động</p>
            <h2 className="text-balance text-3xl md:text-4xl font-bold leading-tight">
              Dù bắt đầu từ đâu, bạn cũng về đích với{" "}
              <span className="text-brand-400">một SRS đúng mẫu</span> và{" "}
              <span className="text-yellow-500">sẵn sàng thay đổi.</span>
            </h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            {MODES.map((mode) =>
              mode.featured ? (
                <div
                  key={mode.no}
                  className="glass-card landing-lift p-6 border-brand-500/30 bg-brand-900/10 relative overflow-hidden"
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-brand-600/15 to-transparent" />
                  <div className="relative">
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-4xl font-bold text-brand-900/60">{mode.no}</span>
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-brand-300 bg-brand-900/60 border border-brand-500/30 px-2 py-0.5 rounded-full">
                        Đề xuất
                      </span>
                    </div>
                    <h3 className="text-lg font-semibold text-white mb-2">{mode.title}</h3>
                    <p className="text-sm text-gray-300 leading-relaxed">{mode.body}</p>
                  </div>
                </div>
              ) : (
                <div key={mode.no} className="glass-card landing-lift p-6 border-white/5 group">
                  <div className="text-4xl font-bold text-dark-700 group-hover:text-brand-900/60 transition-colors mb-4">
                    {mode.no}
                  </div>
                  <h3 className="text-lg font-semibold text-white mb-2">{mode.title}</h3>
                  <p className="text-sm text-gray-400 leading-relaxed">{mode.body}</p>
                </div>
              ),
            )}
          </div>
        </section>
        {/* END: Value Proposition Section */}

        {/* BEGIN: Detailed Features Section — [CẬP NHẬT] lợi ích: hỏi đúng · kiểm chứng · bàn giao */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 py-16 sm:py-24 relative" data-purpose="detailed-features">
          <div className="lg:text-right max-w-3xl lg:ml-auto mb-10 sm:mb-16">
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold leading-tight">
              Không phải máy sinh văn bản.
              <br />
              FlintFlow <span className="text-brand-400">soát từng yêu cầu</span>
              <br className="hidden sm:block" /> như một BA <span className="text-yellow-500">khó tính.</span>
            </h2>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {/* Card 1 */}
            <div className="landing-lift bg-[#f3f4f6] rounded-2xl p-6 sm:p-8 text-dark-900 flex flex-col min-h-[280px] sm:min-h-[320px] border border-transparent">
              <h3 className="text-xl font-bold mb-3">Hỏi đúng chỗ còn thiếu</h3>
              <p className="text-sm text-gray-600 mb-auto leading-relaxed">
                Đưa biên bản họp, ghi chú hay SRS cũ — FlintFlow chỉ hỏi những gì tài liệu chưa có. Không bắt
                bạn khai lại từ đầu.
              </p>
              <div className="bg-white rounded-lg p-3 text-xs font-medium border border-gray-200 shadow-sm mt-6 flex items-start justify-between gap-3">
                <span>&quot;Công trình trên 7 tầng có cần văn bản PCCC khi nộp hồ sơ?&quot;</span>
                <span className="text-gray-400 shrink-0">UC-03</span>
              </div>
            </div>
            {/* Card 2 */}
            <div className="landing-lift bg-brand-600 rounded-2xl p-6 sm:p-8 text-white flex flex-col min-h-[280px] sm:min-h-[320px] relative overflow-hidden border border-transparent">
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-brand-400/40 via-transparent to-transparent" />
              <h3 className="text-xl font-bold mb-3 relative z-10">Kiểm chứng trước khi chốt</h3>
              <p className="text-sm text-brand-100 mb-auto relative z-10 leading-relaxed">
                Mâu thuẫn, giả định và yêu cầu thiếu truy vết đều bị gắn cờ, kèm đường sửa. Chỉ chốt baseline
                khi cờ đỏ về 0.
              </p>
              <div className="flex flex-wrap items-center gap-2 mt-6 relative z-10">
                <span className="bg-black/20 px-3 py-1.5 rounded text-xs font-medium">Cờ đỏ: 0</span>
                <span className="bg-black/20 text-green-300 px-3 py-1.5 rounded text-xs font-medium">
                  ✦ Baseline v1.0
                </span>
              </div>
            </div>
            {/* Card 3 */}
            <div className="landing-lift bg-[#fdf8f6] rounded-2xl p-6 sm:p-8 text-dark-900 flex flex-col min-h-[280px] sm:min-h-[320px] md:col-span-2 lg:col-span-1 border border-transparent">
              <h3 className="text-xl font-bold mb-3">Bàn giao đúng định dạng</h3>
              <p className="text-sm text-gray-600 mb-auto leading-relaxed">
                Xuất Word, PDF hoặc gói bàn giao cho dev. Bản chưa chốt có watermark DRAFT để không ai dùng
                nhầm.
              </p>
              <div className="flex flex-wrap gap-2 mt-6">
                {[".docx", ".pdf", "Handoff"].map((fmt) => (
                  <span
                    key={fmt}
                    className="bg-white border border-gray-200 px-3 py-1.5 rounded text-xs font-medium text-gray-500"
                  >
                    {fmt}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </section>
        {/* END: Detailed Features Section */}

        {/* BEGIN: Workspace Preview Section — [CẬP NHẬT] demo luồng Change Request thay cho chat Brief cũ */}
        <section
          id="workspace-preview"
          className="max-w-5xl mx-auto px-4 sm:px-6 py-16 sm:py-24 scroll-mt-24"
          data-purpose="workspace-preview"
        >
          <div className="text-center mb-10 sm:mb-12 max-w-2xl mx-auto">
            <p className="text-xs font-bold tracking-widest text-gray-500 uppercase mb-3">Bên trong workspace</p>
            <h2 className="text-balance text-2xl sm:text-3xl md:text-4xl font-bold leading-tight">
              Chat bên trái, tài liệu bên phải.{" "}
              <span className="text-brand-400">Bạn luôn là người duyệt.</span>
            </h2>
          </div>
          {/* Mockup UI (trang trí, không tương tác) */}
          <div
            className="glass-card border-white/10 rounded-xl overflow-hidden shadow-2xl bg-dark-900/80"
            aria-hidden="true"
          >
            {/* Top bar */}
            <div className="border-b border-white/5 p-3 flex items-center justify-between gap-3 bg-dark-800/50">
              <div className="flex gap-1.5 shrink-0">
                <div className="w-2.5 h-2.5 rounded-full bg-gray-600" />
                <div className="w-2.5 h-2.5 rounded-full bg-gray-600" />
                <div className="w-2.5 h-2.5 rounded-full bg-gray-600" />
              </div>
              <div className="text-xs text-gray-400 font-medium truncate">Cổng cấp phép xây dựng — SRS v2.4</div>
              <div className="hidden sm:block text-[10px] bg-brand-500/10 text-brand-300 px-2 py-0.5 rounded border border-brand-500/20 whitespace-nowrap">
                CR-012 · Chờ duyệt
              </div>
            </div>
            {/* Main Area */}
            <div className="p-4 sm:p-6 grid md:grid-cols-12 gap-4 sm:gap-6 bg-dark-900">
              {/* Chat side */}
              <div className="md:col-span-5 space-y-4">
                <div className="bg-brand-900/30 border border-brand-500/20 rounded-lg p-3 text-sm text-brand-100 ml-auto max-w-[90%]">
                  Bổ sung: công trình trên 7 tầng phải có văn bản thẩm duyệt PCCC.
                </div>
                <div className="bg-dark-800 border border-white/5 rounded-lg p-4 text-sm">
                  <div className="text-gray-300 mb-2">Yêu cầu này chạm tới 3 chỗ:</div>
                  <ol className="list-decimal list-inside text-gray-400 space-y-1 mb-4">
                    <li>F-S04-01 — thêm kiểm tra hồ sơ</li>
                    <li>UC-03 — thêm điều kiện nộp</li>
                    <li>UC-07 — thêm bước thẩm định</li>
                  </ol>
                  <div className="flex items-center gap-2 text-xs bg-brand-900/20 text-brand-300 p-2 rounded border border-brand-500/20">
                    <svg className="w-3 h-3 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                    Các phần khác của tài liệu giữ nguyên
                  </div>
                </div>
              </div>
              {/* Document side */}
              <div className="md:col-span-7 space-y-4">
                <div className="bg-dark-800 border border-white/5 rounded-lg p-4">
                  <div className="flex flex-wrap justify-between items-start gap-2 mb-3">
                    <h4 className="text-white font-semibold text-sm">F-S04-01 · Nộp hồ sơ cấp phép</h4>
                    <span className="text-[10px] text-gray-500 bg-dark-900 px-2 py-0.5 rounded border border-white/5">
                      Đề xuất — chờ duyệt
                    </span>
                  </div>
                  <div className="text-sm space-y-1 mb-4 font-mono">
                    <p className="text-gray-500">Validation: hồ sơ phải có bản vẽ thiết kế.</p>
                    <p className="text-green-400 bg-green-500/10 rounded px-2 py-1">
                      + Số tầng &gt; 7 → bắt buộc văn bản thẩm duyệt PCCC.
                    </p>
                  </div>
                  {/* [CẬP NHẬT] Nút giả chuyển thành span: mockup không tương tác, tránh focus bàn phím vô nghĩa */}
                  <div className="flex flex-wrap gap-2 text-xs font-medium">
                    <span className="bg-brand-600 text-white px-3 py-1.5 rounded">✓ Chấp nhận</span>
                    <span className="bg-dark-700 text-gray-300 px-3 py-1.5 rounded">✎ Sửa qua chat</span>
                    <span className="bg-dark-700 text-gray-300 px-3 py-1.5 rounded">⟳ Đề xuất lại</span>
                  </div>
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="bg-green-500/5 border border-green-500/20 rounded-lg p-3">
                    <div className="text-[10px] font-bold text-green-500 mb-1">ĐÃ XÁC NHẬN • email 10/09</div>
                    <div className="text-xs text-gray-400">Áp dụng cho công trình trên 7 tầng</div>
                  </div>
                  <div className="bg-yellow-500/5 border border-yellow-500/20 rounded-lg p-3">
                    <div className="text-[10px] font-bold text-yellow-500 mb-1">GIẢ ĐỊNH • cần xác nhận</div>
                    <div className="text-xs text-gray-400">Văn bản PCCC nộp dạng PDF</div>
                  </div>
                </div>
                <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                  <span className="text-red-400 text-xs font-bold whitespace-nowrap">⚠ Mâu thuẫn:</span>
                  <span className="text-xs text-gray-300">
                    UC-07 &quot;thẩm định 5 ngày&quot; ↔ NFR-02 &quot;tối đa 3 ngày&quot;
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>
        {/* END: Workspace Preview Section */}

        {/* BEGIN: Pricing Section — [CẬP NHẬT] thêm tiêu đề, giá theo plan.config.ts, quyền lợi dạng danh sách */}
        <section
          id="pricing"
          className="max-w-7xl mx-auto px-4 sm:px-6 py-16 sm:py-24 scroll-mt-24"
          data-purpose="pricing"
        >
          <div className="text-center max-w-2xl mx-auto mb-10 sm:mb-16">
            <p className="text-xs font-bold tracking-widest text-brand-400 uppercase mb-3">Bảng giá</p>
            <h2 className="text-balance text-3xl md:text-4xl font-bold leading-tight mb-4">
              Bắt đầu miễn phí. Trả tiền khi dự án lớn lên.
            </h2>
            <p className="text-gray-400">Mọi gói đều dùng chung một ví credit cho cả tổ chức.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6 md:items-stretch">
            {PLANS.map((plan) => (
              <div
                key={plan.name}
                className={
                  plan.featured
                    ? "glass-card landing-lift p-8 border-brand-500/50 bg-brand-900/10 relative flex flex-col md:-translate-y-4 md:hover:-translate-y-6 shadow-[0_0_30px_rgba(139,92,246,0.15)]"
                    : "glass-card landing-lift p-8 border-white/5 flex flex-col"
                }
              >
                {plan.featured && (
                  <span className="absolute -top-3 right-6 bg-brand-500 text-white text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                    Phổ biến nhất
                  </span>
                )}
                <h3 className="text-lg font-semibold text-white mb-2">{plan.name}</h3>
                <div className="flex items-baseline gap-1 mb-6">
                  <span className="text-4xl font-bold text-white">{plan.price}</span>
                  <span className="text-sm text-gray-500">{plan.unit}</span>
                </div>
                <ul className="space-y-3 text-sm text-gray-300 mb-8 flex-grow">
                  {plan.perks.map((perk) => (
                    <li key={perk} className="flex items-start gap-2">
                      <CheckIcon />
                      {perk}
                    </li>
                  ))}
                </ul>
                <Link
                  className={
                    plan.featured
                      ? "block w-full py-3 px-4 bg-brand-600 hover:bg-brand-500 text-center text-white text-sm font-semibold rounded-lg transition-colors shadow-lg"
                      : "block w-full py-3 px-4 bg-dark-800 hover:bg-dark-700 text-center text-white text-sm font-medium rounded-lg border border-white/10 transition-colors"
                  }
                  href="/register"
                >
                  {plan.cta}
                </Link>
              </div>
            ))}
          </div>
        </section>
        {/* END: Pricing Section */}

        {/* BEGIN: CTA Section — [CẬP NHẬT] headline + dòng phụ theo gói Free thật (100 credit) */}
        <section className="max-w-4xl mx-auto px-4 sm:px-6 py-16 sm:py-24 text-center" data-purpose="bottom-cta">
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-8 sm:mb-10 leading-tight">
            Khách đổi yêu cầu lần nữa?
            <br />
            <span className="text-brand-400">SRS của bạn vẫn đứng vững.</span>
          </h2>
          <div className="flex flex-col items-center gap-4">
            <Link
              className="group bg-gradient-to-r from-brand-500 to-brand-400 text-white font-semibold px-6 sm:px-8 py-4 rounded-full flex items-center gap-2 text-base sm:text-lg shadow-[0_0_20px_rgba(139,92,246,0.3)] hover:shadow-[0_0_30px_rgba(139,92,246,0.5)] hover:-translate-y-0.5 transition-all"
              href="/register"
            >
              Tạo project đầu tiên — miễn phí
              <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
            </Link>
            <p className="text-xs text-gray-500">Không cần thẻ • 100 credit mỗi tháng</p>
          </div>
        </section>
        {/* END: CTA Section */}
      </main>
      {/* END: Main Content */}

      {/* BEGIN: Footer */}
      <footer className="border-t border-white/5 py-8 mt-10 relative z-10" data-purpose="main-footer">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Logo sizeClassName="w-6 h-6" theme="dark" showText={false} />
            {/* [CẬP NHẬT] năm bản quyền */}
            <span className="text-sm text-gray-500 font-medium">© 2026 FlintFlow</span>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
            <a className="text-sm text-gray-500 hover:text-white transition-colors" href="#">
              Điều khoản
            </a>
            <a className="text-sm text-gray-500 hover:text-white transition-colors" href="#">
              Bảo mật
            </a>
            <a className="text-sm text-gray-500 hover:text-white transition-colors" href="mailto:hello@flintflow.app">
              hello@flintflow.app
            </a>
          </div>
        </div>
      </footer>
      {/* END: Footer */}
    </div>
  );
}
