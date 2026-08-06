import Link from "next/link";
import Logo from "../../../components/Logo";

export default function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="w-full min-h-screen relative overflow-hidden flex flex-col bg-[#f8f8fb]">
      {/* Background Decor */}
      <div className="absolute inset-0 grid-pattern pointer-events-none z-0" />

      {/* Blobs */}
      <div className="absolute -top-32 -left-32 w-[600px] h-[600px] bg-[#d3d0ff]/70 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute -bottom-40 -right-20 w-[600px] h-[600px] bg-[#f9e2b4]/40 rounded-full blur-[120px] pointer-events-none" />

      {/* Header */}
      <header className="w-full max-w-[1400px] mx-auto px-6 md:px-12 py-6 md:py-8 flex justify-between items-center relative z-10">
        <Link href="/" className="flex items-center gap-2">
          <Logo sizeClassName="w-9 h-9" />
          <span className="text-xl font-bold text-on-surface tracking-tight">
            FlintFlow
          </span>
        </Link>
        <nav className="flex items-center gap-6 md:gap-8">
          <Link
            className="text-on-surface-variant hover:text-primary transition-colors text-[15px]"
            href="#"
          >
            Pricing
          </Link>
          <Link
            className="text-on-surface-variant hover:text-primary transition-colors text-[15px]"
            href="#"
          >
            Docs
          </Link>
          <Link
            href="/register"
            className="px-5 py-2.5 border border-surface-variant/60 rounded-full text-on-surface font-medium hover:bg-surface-container transition-colors shadow-sm bg-surface-container-lowest text-[15px]"
          >
            Đăng ký miễn phí
          </Link>
        </nav>
      </header>

      {/* Content Area */}
      <div className="flex-1 flex flex-col lg:flex-row px-6 md:px-12 relative z-10 w-full max-w-[1400px] mx-auto mt-2 lg:mt-4 pb-12 items-center lg:items-start justify-between gap-10">
        {/* Left Hero */}
        <div className="w-full lg:w-[500px] flex flex-col relative pt-4 lg:pt-10">
          <div className="inline-flex items-center gap-1.5 bg-white border border-[#e2dfff] text-primary px-3 py-1.5 rounded-full w-fit mb-6 lg:mb-8 shadow-sm">
            <span className="material-symbols-outlined text-[14px]">✦</span>
            <span className="text-[12px] font-medium text-primary">
              AI Business Analyst
            </span>
          </div>

          <h1 className="text-4xl md:text-5xl lg:text-[72px] leading-[1.05] tracking-tight mb-6 lg:mb-8 font-bold text-on-surface">
            Ý tưởng
            <br />
            <span className="text-primary flex items-center gap-2">
              <span className="text-primary/70">→</span>{" "}
              <span className="bg-gradient-to-r from-[#7b75e5] via-[#a39de8] to-[#d6a56e] bg-clip-text text-transparent">
                PRD
              </span>
            </span>
            trước khi <br />
            code.
          </h1>

          <p className="text-on-surface-variant text-[15px] md:text-[16px] leading-[1.6] mb-8 lg:mb-12 max-w-[420px]">
            Làm rõ · Xác minh · Bàn giao. FlintFlow đặt câu hỏi đúng, phát hiện lỗ
            hổng và mâu thuẫn — để dev nhận được tài liệu thật sự sẵn sàng.
          </p>

          {/* Floating Fragments */}
          <div className="relative flex flex-col gap-4 max-w-full">
            {/* Card 1 */}
            <div className="bg-surface-container-lowest rounded-[16px] p-4 shadow-sm border border-surface-variant/40 max-w-[380px] flex items-center gap-3">
              <div className="w-8 h-8 rounded-[8px] bg-primary flex items-center justify-center shrink-0 text-white font-bold text-[14px]">
                F
              </div>
              <p className="text-[14px] text-on-surface">
                &quot;MVP có cần thanh toán tích hợp không?&quot;{" "}
                <span className="text-primary/70 text-[13px]">
                  · clarifying
                </span>
              </p>
            </div>

            {/* Card 2 */}
            <div className="bg-surface-container-lowest rounded-[16px] p-4 shadow-sm border border-surface-variant/40 max-w-[420px] flex items-center gap-3 ml-0 sm:ml-4">
              <div className="w-2.5 h-2.5 rounded-full bg-[#34a853] ml-2 shrink-0" />
              <p className="text-[14px] text-on-surface font-medium ml-1">
                Sẵn sàng lập kế hoạch triển khai
              </p>
            </div>

            {/* Card 3 */}
            <div className="bg-surface-container-lowest rounded-[16px] p-4 shadow-sm border border-surface-variant/40 max-w-[400px] flex items-center gap-3">
              <span className="bg-[#fcedce] text-[#845400] px-2 py-1 rounded-[4px] text-[10px] font-bold tracking-wide ml-1 shrink-0">
                ASSUMPTION
              </span>
              <p className="text-[14px] text-on-surface ml-1">
                2 giả định cần bạn xác nhận
              </p>
            </div>
          </div>
        </div>

        {/* Right Auth Section */}
        <div className="w-full lg:w-auto flex justify-center lg:justify-end items-start pt-2 lg:pt-6 relative">
          {children}
        </div>
      </div>
    </main>
  );
}
