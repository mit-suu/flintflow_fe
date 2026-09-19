import Link from "next/link";
import Logo from "../components/Logo";

export default function LandingPage() {
  return (
    <div className="bg-[#0f0e13] text-[#f3f4f6] font-sans antialiased relative min-h-screen overflow-x-hidden">
      {/* Background Orbs */}
      <div
        className="bg-orb w-[600px] h-[600px] top-[-100px] right-[-200px]"
        data-purpose="bg-decoration"
      />
      <div
        className="bg-orb w-[800px] h-[800px] top-[40%] left-[-300px]"
        data-purpose="bg-decoration"
      />
      <div
        className="bg-orb w-[500px] h-[500px] bottom-[-100px] right-[-100px] opacity-30"
        data-purpose="bg-decoration"
      />

      {/* BEGIN: Header */}
      <header
        className="fixed top-0 left-0 right-0 z-50 px-6 py-4 border-b border-white/5 backdrop-blur-md"
        data-purpose="main-header"
      >
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          {/* Logo */}
          <Logo variant="wordmark" sizeClassName="h-5 w-auto" theme="dark" href="/" />
          {/* Navigation */}
          <nav className="hidden md:flex items-center gap-1 bg-[#1a1921] rounded-full px-1 py-1 border border-white/5">
            <Link
              className="px-4 py-1.5 text-sm font-medium text-white bg-[#272630] rounded-full"
              href="#"
            >
              Home
            </Link>
            <a
              className="px-4 py-1.5 text-sm font-medium text-gray-400 hover:text-white transition-colors"
              href="#cach-hoat-dong"
            >
              Cách hoạt động
            </a>
            <a
              className="px-4 py-1.5 text-sm font-medium text-gray-400 hover:text-white transition-colors"
              href="#pricing"
            >
              Pricing
            </a>
            <a
              className="px-4 py-1.5 text-sm font-medium text-gray-400 hover:text-white transition-colors"
              href="#workspace-preview"
            >
              Docs
            </a>
          </nav>
          {/* Auth */}
          <div className="flex items-center gap-4">
            <Link
              className="text-sm font-medium text-gray-300 hover:text-white transition-colors"
              href="/login"
            >
              Sign in
            </Link>
            <Link
              className="bg-[#7c3aed] hover:bg-[#8b5cf6] text-white text-sm font-medium px-5 py-2 rounded-full transition-colors shadow-[0_0_15px_rgba(139,92,246,0.5)]"
              href="/register"
            >
              Dùng thử miễn phí
            </Link>
          </div>
        </div>
      </header>
      {/* END: Header */}

      {/* BEGIN: Main Content */}
      <main className="pt-32 pb-20 overflow-hidden">
        {/* BEGIN: Hero Section */}
        <section
          className="max-w-7xl mx-auto px-6 pt-10 pb-24 relative"
          data-purpose="hero-section"
        >
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Hero Text */}
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#4c1d95]/50 border border-[#8b5cf6]/30 text-[#c4b5fd] text-xs font-semibold mb-6 tracking-wide">
                <span className="w-1.5 h-1.5 rounded-full bg-[#a78bfa]" />
                AI BUSINESS ANALYST
              </div>
              <h1 className="text-6xl md:text-7xl font-extrabold tracking-tight leading-[1.1] mb-6">
                Ideas that
                <br />
                go <span className="text-gradient-purple">deeper.</span>
              </h1>
              <p className="text-lg text-gray-400 mb-10 max-w-xl leading-relaxed">
                FlintFlow phản biện ý tưởng của bạn như một BA thực thụ — đặt câu
                hỏi đúng, bắt giả định và mâu thuẫn, bàn giao Brief &amp; PRD mà
                dev thật sự dùng được. Trước khi bạn tốn một dòng code.
              </p>
              <div className="flex flex-wrap items-center gap-4 mb-16">
                <Link
                  className="bg-gradient-to-r from-[#7c3aed] to-[#8b5cf6] text-white font-medium px-6 py-3 rounded-full flex items-center gap-2 shadow-[0_0_20px_rgba(139,92,246,0.4)] hover:shadow-[0_0_30px_rgba(139,92,246,0.6)] transition-all"
                  href="/register"
                >
                  Bắt đầu miễn phí
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      d="M14 5l7 7m0 0l-7 7m7-7H3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                    />
                  </svg>
                </Link>
                <a
                  className="bg-[#1a1921] hover:bg-[#272630] text-white font-medium px-6 py-3 rounded-full flex items-center gap-2 border border-white/10 transition-colors"
                  href="#workspace-preview"
                >
                  <svg
                    className="w-4 h-4"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      clipRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z"
                      fillRule="evenodd"
                    />
                  </svg>
                  2 phút demo
                </a>
              </div>
              {/* Metrics */}
              <div className="grid grid-cols-3 gap-4 border-t border-white/5 pt-8">
                <div className="glass-card p-4">
                  <div className="text-2xl font-bold text-white mb-1">
                    120<span className="text-[#a78bfa]">+</span>
                  </div>
                  <div className="text-xs text-gray-500">
                    credits miễn phí
                    <br />
                    mỗi tháng
                  </div>
                </div>
                <div className="glass-card p-4">
                  <div className="text-2xl font-bold text-white mb-1">
                    &lt; 3s
                  </div>
                  <div className="text-xs text-gray-500">
                    AI bắt đầu
                    <br />
                    phản hồi
                  </div>
                </div>
                <div className="glass-card p-4">
                  <div className="text-2xl font-bold text-white mb-1">
                    100%
                  </div>
                  <div className="text-xs text-gray-500">
                    nội dung do
                    <br />
                    bạn duyệt
                  </div>
                </div>
              </div>
            </div>
            {/* Hero Visual (Right Side) */}
            <div className="relative hidden lg:block">
              <div className="absolute right-0 top-1/2 transform -translate-y-1/2 z-10 w-80 glass-card p-5 border-white/10 bg-[#0f0e13]/80 shadow-2xl">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs font-semibold text-gray-400 tracking-wider">
                    READINESS
                  </span>
                  <span className="text-[10px] bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full border border-green-500/30">
                    ✦ Ready to plan
                  </span>
                </div>
                <div className="mb-4">
                  <div className="flex items-baseline gap-2 mb-1">
                    <span className="text-3xl font-bold text-white">0</span>
                    <span className="text-sm text-gray-400">
                      câu hỏi mở còn chặn
                    </span>
                  </div>
                  <div className="h-1.5 w-full bg-[#1a1921] rounded-full overflow-hidden flex">
                    <div className="h-full bg-green-500 w-1/3" />
                    <div className="h-full bg-yellow-500 w-1/3 border-l border-[#0f0e13]" />
                    <div className="h-full bg-red-500 w-1/3 border-l border-[#0f0e13]" />
                  </div>
                </div>
                <div className="flex gap-2 text-[10px] font-medium">
                  <div className="px-2 py-1 bg-[#1a1921] rounded border border-white/5 text-gray-300">
                    FACT ✓
                  </div>
                  <div className="px-2 py-1 bg-yellow-500/10 rounded border border-yellow-500/20 text-yellow-500">
                    ASSUMPTION ⚠
                  </div>
                  <div className="px-2 py-1 bg-red-500/10 rounded border border-red-500/20 text-red-400">
                    CONFLICT X
                  </div>
                </div>
              </div>
            </div>
          </div>
          {/* Scroll Indicator */}
          <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 flex justify-center">
            <div className="w-8 h-8 rounded-full border border-white/10 flex items-center justify-center text-gray-500">
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  d="M19 14l-7 7m0 0l-7-7m7 7V3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                />
              </svg>
            </div>
          </div>
        </section>
        {/* END: Hero Section */}

        {/* BEGIN: Value Proposition Section */}
        <section
          id="cach-hoat-dong"
          className="max-w-7xl mx-auto px-6 py-24"
          data-purpose="value-prop"
        >
          <div className="max-w-3xl mb-16">
            <h2 className="text-3xl md:text-4xl font-bold leading-tight mb-4">
              FlintFlow là một{" "}
              <span className="text-[#a78bfa]">
                AI Business Analyst full-cycle
              </span>{" "}
              — đào sâu vào ý tưởng của bạn và{" "}
              <span className="text-[#a78bfa]">làm việc</span> như một{" "}
              <span className="text-yellow-500">cộng sự</span>, không phải một
              cái máy sinh văn bản.
            </h2>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Feature 1 */}
            <div className="glass-card p-6 border-white/5 hover:border-[#8b5cf6]/30 transition-colors group">
              <div className="text-4xl font-bold text-[#272630] group-hover:text-[#4c1d95]/50 transition-colors mb-4">
                01
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">
                Làm rõ có cấu trúc
              </h3>
              <p className="text-sm text-gray-400">
                Hỏi theo nhóm user - pain - scope - metrics — kèm lý do vì sao câu
                hỏi quan trọng.
              </p>
            </div>
            {/* Feature 2 */}
            <div className="glass-card p-6 border-[#8b5cf6]/30 bg-[#4c1d95]/10 relative overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-br from-[#7c3aed]/10 to-transparent" />
              <div className="text-4xl font-bold text-[#4c1d95]/50 mb-4 relative z-10">
                02
              </div>
              <h3 className="text-lg font-semibold text-white mb-2 relative z-10">
                Xác minh mọi thứ
              </h3>
              <p className="text-sm text-gray-300 relative z-10">
                Fact tách khỏi giả định, mâu thuẫn bị bắt,{" "}
                <span className="text-yellow-400 font-medium">
                  &quot;nhanh&quot; phải thành con số.
                </span>
              </p>
            </div>
            {/* Feature 3 */}
            <div className="glass-card p-6 border-white/5 hover:border-[#8b5cf6]/30 transition-colors group">
              <div className="text-4xl font-bold text-[#272630] group-hover:text-[#4c1d95]/50 transition-colors mb-4">
                03
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">
                Không template rác
              </h3>
              <p className="text-sm text-gray-400">
                Chỉ những gì business của bạn thật sự cần — không filler, không
                đoán bừa.
              </p>
            </div>
            {/* Feature 4 */}
            <div className="glass-card p-6 border-white/5 hover:border-[#8b5cf6]/30 transition-colors group">
              <div className="text-4xl font-bold text-[#272630] group-hover:text-[#4c1d95]/50 transition-colors mb-4">
                04
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">
                Bàn giao linh hoạt
              </h3>
              <p className="text-sm text-gray-400">
                Brief - PRD - stories + AC - gap report — Markdown, PDF, CSV vào
                Jira.
              </p>
            </div>
          </div>
        </section>
        {/* END: Value Proposition Section */}

        {/* BEGIN: Detailed Features Section */}
        <section
          className="max-w-7xl mx-auto px-6 py-24 relative"
          data-purpose="detailed-features"
        >
          <div className="text-right max-w-3xl ml-auto mb-16">
            <h2 className="text-4xl md:text-5xl font-bold leading-tight mb-4">
              Chúng tôi không bán một &quot;PRD
              <br />
              generator&quot;.
              <br />
              FlintFlow{" "}
              <span className="text-[#a78bfa]">
                phản biện cho mục tiêu cụ thể
              </span>
              <br />
              của <span className="text-yellow-500">bạn.</span>
            </h2>
          </div>
          <div className="grid lg:grid-cols-3 gap-6">
            {/* Card 1 */}
            <div className="bg-[#f3f4f6] rounded-2xl p-8 text-[#0f0e13] flex flex-col h-[320px]">
              <h3 className="text-xl font-bold mb-3">Làm rõ ý tưởng</h3>
              <p className="text-sm text-gray-600 mb-auto">
                Dàn ý tưởng thô, transcript phỏng vấn hay BRD cũ — nhận lại câu
                hỏi sắc như một BA senior.
              </p>
              <div className="bg-white rounded-lg p-3 text-xs font-medium border border-gray-200 shadow-sm mt-6">
                &quot;MVP có cần thanh toán tích hợp không?&quot;{" "}
                <span className="text-gray-400 ml-2">scope</span>
              </div>
            </div>
            {/* Card 2 */}
            <div className="bg-[#7c3aed] rounded-2xl p-8 text-white flex flex-col h-[320px] relative overflow-hidden">
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-[#a78bfa]/40 via-transparent to-transparent" />
              <h3 className="text-xl font-bold mb-3 relative z-10">
                Xác minh &amp; readiness
              </h3>
              <p className="text-sm text-[#ede9fe] mb-auto relative z-10">
                Completeness score, dependency ẩn, scope vượt MVP — biết chính xác
                khi nào tài liệu sẵn sàng.
              </p>
              <div className="flex items-center gap-2 mt-6 relative z-10">
                <span className="bg-black/20 px-3 py-1.5 rounded text-xs font-medium">
                  Score 72/100
                </span>
                <span className="bg-black/20 text-green-300 px-3 py-1.5 rounded text-xs font-medium">
                  ✦ Ready to plan
                </span>
              </div>
            </div>
            {/* Card 3 */}
            <div className="bg-[#fdf8f6] rounded-2xl p-8 text-[#0f0e13] flex flex-col h-[320px]">
              <h3 className="text-xl font-bold mb-3">Bàn giao cho dev &amp; khách</h3>
              <p className="text-sm text-gray-600 mb-auto">
                Gap report chỉ rõ chỗ thiếu, checklist ký duyệt scope bằng ngôn ngữ
                bình dân.
              </p>
              <div className="flex gap-2 mt-6">
                <span className="bg-white border border-gray-200 px-3 py-1.5 rounded text-xs font-medium text-gray-500">
                  .md
                </span>
                <span className="bg-white border border-gray-200 px-3 py-1.5 rounded text-xs font-medium text-gray-500">
                  .pdf
                </span>
                <span className="bg-white border border-gray-200 px-3 py-1.5 rounded text-xs font-medium text-gray-500">
                  .csv → Jira
                </span>
              </div>
            </div>
          </div>
        </section>
        {/* END: Detailed Features Section */}

        {/* BEGIN: Workspace Preview Section */}
        <section
          id="workspace-preview"
          className="max-w-5xl mx-auto px-6 py-24"
          data-purpose="workspace-preview"
        >
          <div className="text-center mb-12">
            <p className="text-xs font-bold tracking-widest text-gray-500 uppercase mb-2">
              BÊN TRONG WORKSPACE
            </p>
          </div>
          {/* Mockup UI */}
          <div className="glass-card border-white/10 rounded-xl overflow-hidden shadow-2xl bg-[#0f0e13]/80">
            {/* Top bar */}
            <div className="border-b border-white/5 p-3 flex items-center justify-between bg-[#1a1921]/50">
              <div className="flex gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-gray-600" />
                <div className="w-2.5 h-2.5 rounded-full bg-gray-600" />
                <div className="w-2.5 h-2.5 rounded-full bg-gray-600" />
              </div>
              <div className="text-xs text-gray-400 font-medium">
                Lumen — SaaS quản lý khoá học
              </div>
              <div className="text-[10px] bg-green-500/10 text-green-400 px-2 py-0.5 rounded border border-green-500/20">
                ✦ Ready to plan implementation
              </div>
            </div>
            {/* Main Area */}
            <div className="p-6 grid md:grid-cols-12 gap-6 bg-[#0f0e13]">
              {/* Chat / Input side */}
              <div className="md:col-span-5 space-y-4">
                <div className="bg-[#4c1d95]/30 border border-[#8b5cf6]/20 rounded-lg p-3 text-sm text-[#ede9fe] ml-auto max-w-[90%]">
                  Mình muốn làm app đặt lịch spa tại nhà...
                </div>
                <div className="bg-[#1a1921] border border-white/5 rounded-lg p-4 text-sm">
                  <div className="text-gray-300 mb-2">
                    3 câu hỏi trước khi viết scope:
                  </div>
                  <ol className="list-decimal list-inside text-gray-400 space-y-1 mb-4">
                    <li>Ai trả tiền — khách hay spa?</li>
                    <li>Kỹ thuật viên là nhân viên hay đối tác?</li>
                  </ol>
                  <div className="flex items-center gap-2 text-xs bg-[#4c1d95]/20 text-[#c4b5fd] p-2 rounded border border-[#8b5cf6]/20">
                    <svg
                      className="w-3 h-3"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                    Câu 2 quyết định 40% khối lượng MVP
                  </div>
                </div>
              </div>
              {/* Document / Output side */}
              <div className="md:col-span-7 space-y-4">
                <div className="bg-[#1a1921] border border-white/5 rounded-lg p-4">
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="text-white font-semibold text-sm">
                      3. Value proposition
                    </h4>
                    <span className="text-[10px] text-gray-500 bg-[#0f0e13] px-2 py-0.5 rounded border border-white/5">
                      Draft — chờ duyệt
                    </span>
                  </div>
                  <p className="text-sm text-gray-400 mb-4">
                    &quot;Nền tảng duy nhất giúp spa solo giữ chân khách quen bằng
                    nhắc lịch tự động...&quot;
                  </p>
                  <div className="flex gap-2">
                    <button type="button" className="bg-[#7c3aed] hover:bg-[#8b5cf6] text-white text-xs px-3 py-1.5 rounded font-medium flex items-center gap-1 transition-colors">
                      ✓ Accept
                    </button>
                    <button type="button" className="bg-[#272630] hover:bg-[#32303e] text-gray-300 text-xs px-3 py-1.5 rounded font-medium flex items-center gap-1 transition-colors">
                      ✎ Edit
                    </button>
                    <button type="button" className="bg-[#272630] hover:bg-[#32303e] text-gray-300 text-xs px-3 py-1.5 rounded font-medium flex items-center gap-1 transition-colors">
                      ⟳ Regenerate
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-green-500/5 border border-green-500/20 rounded-lg p-3">
                    <div className="text-[10px] font-bold text-green-500 mb-1">
                      FACT • IQ Scan
                    </div>
                    <div className="text-xs text-gray-400">
                      Khách trả tiền trực tiếp cho spa
                    </div>
                  </div>
                  <div className="bg-yellow-500/5 border border-yellow-500/20 rounded-lg p-3">
                    <div className="text-[10px] font-bold text-yellow-500 mb-1">
                      ASSUMPTION • do AI
                    </div>
                    <div className="text-xs text-gray-400">
                      Kỹ thuật viên dùng smartphone riêng
                    </div>
                  </div>
                </div>
                <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 flex items-center gap-2">
                  <span className="text-red-400 text-xs font-bold">
                    ⚠ Xung đột:
                  </span>
                  <span className="text-xs text-gray-300">
                    &quot;solo spa&quot; ↔ flow &quot;phân ca 5 nhân viên&quot; — bấm
                    để xem
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>
        {/* END: Workspace Preview Section */}

        {/* BEGIN: Pricing Section */}
        <section
          id="pricing"
          className="max-w-7xl mx-auto px-6 py-24"
          data-purpose="pricing"
        >
          <div className="grid md:grid-cols-3 gap-6">
            {/* Free Plan */}
            <div className="glass-card p-8 border-white/5 flex flex-col">
              <h3 className="text-lg font-semibold text-white mb-2">Free</h3>
              <div className="flex items-baseline gap-1 mb-4">
                <span className="text-4xl font-bold text-white">0đ</span>
                <span className="text-sm text-gray-500">/tháng</span>
              </div>
              <p className="text-sm text-gray-400 mb-8 flex-grow">
                120 credits/tháng • 3 projects • Export Markdown &amp; CSV
              </p>
              <Link
                className="block w-full py-3 px-4 bg-[#1a1921] hover:bg-[#272630] text-center text-white text-sm font-medium rounded-lg border border-white/10 transition-colors"
                href="/register"
              >
                Bắt đầu miễn phí
              </Link>
            </div>
            {/* Pro Plan */}
            <div className="glass-card p-8 border-[#8b5cf6]/50 bg-[#4c1d95]/10 relative flex flex-col transform md:-translate-y-4 shadow-[0_0_30px_rgba(139,92,246,0.15)]">
              <div className="absolute top-0 right-0 transform translate-x-2 -translate-y-3">
                <span className="bg-[#8b5cf6] text-white text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                  Phổ biến nhất
                </span>
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">Pro</h3>
              <div className="flex items-baseline gap-1 mb-4">
                <span className="text-4xl font-bold text-white">249k</span>
                <span className="text-sm text-gray-500">/tháng</span>
              </div>
              <p className="text-sm text-gray-400 mb-8 flex-grow">
                600 credits/tháng • Projects không giới hạn • Export PDF •
                Verification sâu
              </p>
              <Link
                className="block w-full py-3 px-4 bg-[#7c3aed] hover:bg-[#8b5cf6] text-center text-white text-sm font-medium rounded-lg transition-colors shadow-lg"
                href="/register"
              >
                Nâng cấp Pro
              </Link>
            </div>
            {/* Credit Pack */}
            <div className="glass-card p-8 border-white/5 flex flex-col">
              <h3 className="text-lg font-semibold text-white mb-2">
                Credit Pack
              </h3>
              <div className="flex items-baseline gap-1 mb-4">
                <span className="text-4xl font-bold text-white">99k</span>
                <span className="text-sm text-gray-500">/200 credits</span>
              </div>
              <p className="text-sm text-gray-400 mb-8 flex-grow">
                Mua lẻ khi cần • Không hết hạn • Không reset theo chu kỳ
              </p>
              <Link
                className="block w-full py-3 px-4 bg-[#1a1921] hover:bg-[#272630] text-center text-white text-sm font-medium rounded-lg border border-white/10 transition-colors"
                href="/register"
              >
                Mua pack
              </Link>
            </div>
          </div>
        </section>
        {/* END: Pricing Section */}

        {/* BEGIN: CTA Section */}
        <section
          className="max-w-4xl mx-auto px-6 py-24 text-center"
          data-purpose="bottom-cta"
        >
          <h2 className="text-4xl md:text-5xl font-bold mb-10 leading-tight">
            Ý tưởng tiếp theo của bạn
            <br />
            xứng đáng một BA{" "}
            <span className="text-[#a78bfa]">không bao giờ ngủ.</span>
          </h2>
          <div className="flex flex-col items-center gap-4">
            <Link
              className="bg-gradient-to-r from-[#8b5cf6] to-[#a78bfa] text-white font-medium px-8 py-4 rounded-full flex items-center gap-2 text-lg shadow-[0_0_20px_rgba(139,92,246,0.3)] hover:shadow-[0_0_30px_rgba(139,92,246,0.5)] transition-all"
              href="/register"
            >
              Tạo project đầu tiên — miễn phí
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  d="M14 5l7 7m0 0l-7 7m7-7H3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                />
              </svg>
            </Link>
            <p className="text-xs text-gray-500">
              Không cần thẻ • 120 credits tặng sẵn
            </p>
          </div>
        </section>
        {/* END: CTA Section */}
      </main>
      {/* END: Main Content */}

      {/* BEGIN: Footer */}
      <footer
        className="border-t border-white/5 py-8 mt-10 relative z-10"
        data-purpose="main-footer"
      >
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Logo sizeClassName="w-4 h-4" theme="dark" />
            <span className="text-sm text-gray-500 font-medium">© 2024 FlintFlow</span>
          </div>
          <div className="flex items-center gap-6">
            <a
              className="text-sm text-gray-500 hover:text-white transition-colors"
              href="#"
            >
              Điều khoản
            </a>
            <a
              className="text-sm text-gray-500 hover:text-white transition-colors"
              href="#"
            >
              Bảo mật
            </a>
            <a
              className="text-sm text-gray-500 hover:text-white transition-colors"
              href="mailto:hello@flintflow.app"
            >
              hello@flintflow.app
            </a>
          </div>
        </div>
      </footer>
      {/* END: Footer */}
    </div>
  );
}
