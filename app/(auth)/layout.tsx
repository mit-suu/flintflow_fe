import * as motion from "motion/react-client";
import Logo from "@/components/Logo";
import BackLink from "@/components/ui/BackLink";
import { DashboardCollage } from "../_landing/Hero";
import LandingMotion from "../_landing/LandingMotion";
import { fadeUp, onLoad } from "../_landing/motion";
import { Diamond, Texture } from "../_landing/ui";

/**
 * Khung chung của các trang xác thực — cùng ngôn ngữ với landing: nền kem, phẳng, không viền.
 * Trái (≥ lg): khối `primary` với collage dashboard của landing, collage tràn khỏi mép dưới có chủ ý.
 * Phải: form (trang con chỉ render card). Từ lg khung vừa đúng một màn hình, không cuộn trang.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <LandingMotion>
      <div className="relative isolate flex min-h-dvh gap-6 bg-surface p-4 font-sans text-on-surface antialiased selection:bg-primary/20 sm:p-6 lg:h-dvh lg:overflow-hidden">
        <Texture kind="dots" mask="radial-gradient(ellipse 40% 55% at 78% 45%, #000, transparent)" className="-z-10" />

        <aside
          aria-label="Giới thiệu FlintFlow"
          className="relative isolate hidden w-[46%] max-w-[680px] flex-col overflow-hidden rounded-[32px] bg-primary px-10 pt-10 lg:flex xl:px-12"
        >
          <Texture kind="dots-light" mask="linear-gradient(#000 20%, transparent 70%)" className="-z-10" />
          {/* Logo bản trắng trên nền tím */}
          <Logo variant="wordmark" sizeClassName="h-[18px] w-auto" theme="dark" href="/" />
          <p className="mt-12 inline-flex items-center gap-2.5 text-[13px] font-bold text-on-primary-container">
            <Diamond />
            AI Business Analyst
          </p>
          <p className="mt-3 max-w-md text-[34px] font-bold leading-[1.1] tracking-[-0.03em] text-on-primary xl:text-[38px]">
            AI soạn nháp.
            <br />
            <span className="text-primary-fixed-dim">Bạn quyết định.</span>
          </p>
          {/* Collage neo đáy, tràn khỏi mép dưới — khung cao thấp thế nào cũng không đẩy trang cuộn */}
          <div className="relative mt-10 min-h-0 flex-1">
            <div className="absolute inset-x-0 top-0">
              <DashboardCollage />
            </div>
          </div>
        </aside>

        <div className="flex min-h-0 flex-1 flex-col">
          <header className="flex items-center justify-between gap-4">
            {/* Logo ở đây chỉ khi panel trái ẩn (màn nhỏ) */}
            <Logo variant="wordmark" sizeClassName="h-[18px] w-auto" theme="light" href="/" className="lg:hidden" />
            <BackLink href="/" tone="white" className="ml-auto">
              Trang chủ
            </BackLink>
          </header>
          <main className="flex min-h-0 flex-1 items-center justify-center py-6 lg:py-4">
            <motion.div {...onLoad} variants={fadeUp} className="w-full max-w-[440px]">
              {children}
            </motion.div>
          </main>
        </div>
      </div>
    </LandingMotion>
  );
}
