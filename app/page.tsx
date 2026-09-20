import FinalCta from "./_landing/FinalCta";
import Hero from "./_landing/Hero";
import HowItWorks from "./_landing/HowItWorks";
import Modes from "./_landing/Modes";
import Pricing from "./_landing/Pricing";
import LandingMotion from "./_landing/LandingMotion";
import SiteHeader from "./_landing/SiteHeader";
import WorkspacePreview from "./_landing/WorkspacePreview";

/*
 * Landing page — cùng ngôn ngữ hình ảnh với dashboard: phẳng, không viền, màu pastel của thẻ thư mục, card dự án +
 * thanh 12 giai đoạn, tím `primary` của hệ thống. Nền kem `surface` xen khối trắng; hoạ tiết phẳng mang nghĩa sản phẩm
 * (lưới chấm, tờ tài liệu xếp chồng, dải 12 giai đoạn) thay cho blob / gradient.
 * Mỗi section là một component trong `app/_landing/`; nội dung tĩnh ở `content.ts`.
 */
export default function LandingPage() {
  return (
    <LandingMotion>
      <div id="top" className="relative min-h-screen overflow-x-clip bg-surface font-sans text-on-surface antialiased selection:bg-primary/20">
        <SiteHeader />
        <main className="relative">
          <Hero />
          <HowItWorks />
          <Modes />
          <WorkspacePreview />
          <Pricing />
          <FinalCta />
        </main>
      </div>
    </LandingMotion>
  );
}
