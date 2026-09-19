import FinalCta from "./_landing/FinalCta";
import Hero, { HeroBackdrop } from "./_landing/Hero";
import HowItWorks from "./_landing/HowItWorks";
import Pricing from "./_landing/Pricing";
import Services from "./_landing/Services";
import SiteHeader from "./_landing/SiteHeader";
import WorkspacePreview from "./_landing/WorkspacePreview";

/*
 * Landing page — bản sáng theo mock L1 (flintflow-ui-design `_src/screens/02-L1.html`).
 * Mỗi section là một component trong `app/_landing/`; nội dung tĩnh ở `content.ts`.
 * Nền kem `surface`, tím landing (#B98BF5 → #8B5CF0 → #5B2EC4) cho điểm nhấn; utility ở globals.css (`.landing-*`).
 */
export default function LandingPage() {
  return (
    <div id="top" className="relative min-h-screen overflow-x-clip bg-surface font-sans text-on-surface antialiased selection:bg-[#8B5CF0]/20">
      <HeroBackdrop />
      <SiteHeader />
      <main>
        <Hero />
        <HowItWorks />
        <Services />
        <WorkspacePreview />
        <Pricing />
        <FinalCta />
      </main>
    </div>
  );
}
