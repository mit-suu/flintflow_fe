import * as motion from "motion/react-client";
import Link from "next/link";
import Logo from "@/components/Logo";
import { DashboardCollage } from "../_landing/Hero";
import LandingMotion from "../_landing/LandingMotion";
import { fadeUp, onLoad } from "../_landing/motion";
import { Diamond, Texture } from "../_landing/ui";

/**
 * Khung chung của các trang xác thực — cùng ngôn ngữ với landing: nền kem, phẳng, không viền.
 * Trái: form (trang con chỉ render card). Phải (≥ lg): khối `primary` đặc với collage dashboard của landing
 * — người dùng thấy ngay thứ họ sắp vào dùng.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <LandingMotion>
      <div className="relative isolate flex min-h-dvh flex-col bg-surface font-sans text-on-surface antialiased selection:bg-primary/20">
        <Texture kind="dots" mask="radial-gradient(ellipse 45% 55% at 20% 40%, #000, transparent)" className="-z-10" />

        <header className="flex items-center justify-between px-5 py-5 sm:px-8">
          <Logo variant="wordmark" sizeClassName="h-[18px] w-auto" theme="light" href="/" />
          <Link
            href="/"
            className="rounded-full px-3.5 py-2 text-[13px] font-semibold text-on-surface-variant transition-colors hover:bg-surface-container-lowest hover:text-on-surface"
          >
            ← Trang chủ
          </Link>
        </header>

        <div className="flex flex-1 gap-6 px-4 pb-6 sm:px-6 lg:pl-8">
          <main className="flex flex-1 items-center justify-center py-6 lg:py-10">
            <motion.div {...onLoad} variants={fadeUp} className="w-full max-w-[440px]">
              {children}
            </motion.div>
          </main>

          <aside
            aria-label="Giới thiệu FlintFlow"
            className="relative isolate hidden w-[48%] max-w-[720px] flex-col justify-center overflow-hidden rounded-[32px] bg-primary px-10 py-12 lg:flex xl:px-14"
          >
            <Texture kind="dots-light" mask="linear-gradient(#000 20%, transparent 70%)" className="-z-10" />
            <p className="inline-flex items-center gap-2.5 text-[13px] font-bold text-on-primary-container">
              <Diamond />
              AI Business Analyst
            </p>
            <p className="mt-3 max-w-md text-[34px] font-bold leading-[1.1] tracking-[-0.03em] text-on-primary xl:text-[40px]">
              AI soạn nháp.
              <br />
              <span className="text-primary-fixed-dim">Bạn quyết định.</span>
            </p>
            <div className="mt-10">
              <DashboardCollage />
            </div>
          </aside>
        </div>
      </div>
    </LandingMotion>
  );
}
