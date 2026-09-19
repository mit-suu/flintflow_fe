import FinalCta from "./_landing/FinalCta";
import Hero from "./_landing/Hero";
import HowItWorks from "./_landing/HowItWorks";
import Pricing from "./_landing/Pricing";
import SiteHeader from "./_landing/SiteHeader";

/*
 * Landing page. Mỗi section là một component trong `app/_landing/`; nội dung tĩnh ở `content.ts`.
 * Nền zinc-950 + lưới 1px (`.landing-grid` trong globals.css), một màu nhấn duy nhất (blue-500),
 * emerald / red chỉ dùng cho trạng thái pass / fail.
 */
export default function LandingPage() {
  return (
    <div className="landing-grid relative min-h-screen overflow-x-clip bg-zinc-950 font-sans text-[#FAFAFA] antialiased selection:bg-blue-500/30">
      <SiteHeader />
      <main>
        <Hero />
        <HowItWorks />
        <Pricing />
        <FinalCta />
      </main>
    </div>
  );
}
