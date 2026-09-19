import FinalCta from "./_landing/FinalCta";
import Hero from "./_landing/Hero";
import HowItWorks from "./_landing/HowItWorks";
import Modes from "./_landing/Modes";
import Pricing from "./_landing/Pricing";
import SiteHeader from "./_landing/SiteHeader";
import WorkspacePreview from "./_landing/WorkspacePreview";

/*
 * Landing page — cùng ngôn ngữ hình ảnh với dashboard: phẳng, không viền, nền trắng / xám nhạt, màu pastel của thẻ
 * thư mục, card dự án + thanh 12 giai đoạn, tím `primary` của hệ thống. Điểm nhấn riêng của landing: khối `primary`
 * đặc, thẻ thư mục cỡ lớn và hạt kim cương vàng lấy từ logo.
 * Mỗi section là một component trong `app/_landing/`; nội dung tĩnh ở `content.ts`.
 */
export default function LandingPage() {
  return (
    <div id="top" className="min-h-screen overflow-x-clip bg-surface-container-lowest font-sans text-on-surface antialiased selection:bg-primary/20">
      <SiteHeader />
      <main>
        <Hero />
        <HowItWorks />
        <Modes />
        <WorkspacePreview />
        <Pricing />
        <FinalCta />
      </main>
    </div>
  );
}
