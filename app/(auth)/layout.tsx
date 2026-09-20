import * as motion from "motion/react-client";
import Logo from "@/components/Logo";
import BackLink from "@/components/ui/BackLink";
import { DashboardCollage } from "../_landing/Hero";
import LandingMotion from "../_landing/LandingMotion";
import { fadeUp, onLoad } from "../_landing/motion";
import { Diamond, Texture } from "../_landing/ui";

/**
 * Khung chung của các trang xác thực — cùng ngôn ngữ với landing: nền kem, phẳng, không viền.
 * Trái (≥ lg): khối `primary` với collage dashboard của landing, neo đáy, tràn nhẹ khỏi mép dưới, thu nhỏ theo chiều cao màn hình.
 * Phải: form (trang con chỉ render card). Từ lg khung vừa đúng một màn hình, không cuộn trang.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <LandingMotion>
      <div className="relative isolate flex min-h-dvh gap-6 bg-surface p-4 font-sans text-on-surface antialiased selection:bg-primary/20 sm:p-6 lg:h-dvh lg:overflow-hidden">
        <Texture kind="dots" mask="radial-gradient(ellipse 40% 55% at 78% 45%, #000, transparent)" className="-z-10" />

        <aside
          aria-label="Giới thiệu FlintFlow"
          className="relative isolate hidden w-[46%] max-w-[680px] flex-col overflow-hidden rounded-[32px] bg-primary px-10 pt-10 lg:flex xl:px-12 [@media(max-height:760px)]:pt-8"
        >
          <Texture kind="dots-light" mask="linear-gradient(#000 20%, transparent 70%)" className="-z-10" />
          {/* Logo bản trắng trên nền tím */}
          <Logo variant="wordmark" sizeClassName="h-[18px] w-auto" theme="dark" href="/" />
          <p className="mt-12 inline-flex items-center gap-2.5 [@media(max-height:760px)]:mt-8 text-[13px] font-bold text-on-primary-container">
            <Diamond />
            Trợ lý BA bằng AI
          </p>
          <p className="mt-3 max-w-md text-[34px] font-bold leading-[1.1] tracking-[-0.03em] text-on-primary xl:text-[38px]">
            AI soạn nháp.
            <br />
            <span className="text-primary-fixed-dim">Bạn quyết định.</span>
          </p>
          {/* Collage neo đáy và tràn khỏi mép dưới có chủ ý, nhưng chỉ ăn một nửa phần đệm dưới của khung trắng
              (`-mb-3` = 12px < đệm 24px) ⇒ thẻ kiểm tra hiện đủ cả đệm và góc bo, không bị trông "co" lại.
              Màn thấp thì thu nhỏ bằng `zoom` (đổi kích thước layout thật) để phần trên không đẩy collage xuống. */}
          <div className="-mb-3 mt-auto pt-8 [@media(max-height:860px)]:[zoom:0.86] [@media(max-height:740px)]:[zoom:0.74]">
            <DashboardCollage />
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
