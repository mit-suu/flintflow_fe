"use client";

import { useState } from "react";
import Link from "next/link";
import Logo from "../../components/Logo";

export default function LogoPreviewPage() {
  const [bgMode, setBgMode] = useState<"light" | "warm" | "dark" | "purple">("warm");

  const bgStyles = {
    warm: "bg-[#F5F3F0] text-[#191817]",
    light: "bg-white text-[#191817]",
    dark: "bg-[#121118] text-white",
    purple: "bg-[#1E1B4B] text-white",
  };

  return (
    <div className={`min-h-screen p-8 transition-colors duration-300 font-sans ${bgStyles[bgMode]}`}>
      {/* Top bar */}
      <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-4 pb-8 border-b border-gray-200/40">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">
            FlintFlow Brand Assets & Logo Showcase
          </h1>
          <p className="text-sm opacity-70 mt-1">
            Bản xem trước đầy đủ các biến thể logo: Dark / Light, Tách nền Icon, Wordmark và Logo chữ.
          </p>
        </div>

        {/* Background Switcher */}
        <div className="flex items-center gap-2 bg-white/10 backdrop-blur-md p-1.5 rounded-full border border-gray-200/30">
          <span className="text-xs font-bold px-3 opacity-80">Nền xem thử:</span>
          <button
            onClick={() => setBgMode("warm")}
            className={`px-3 py-1 text-xs font-bold rounded-full transition-all cursor-pointer ${
              bgMode === "warm"
                ? "bg-[#E4E1DC] text-[#191817] shadow-sm"
                : "opacity-70 hover:opacity-100"
            }`}
          >
            Warm (#F5F3F0)
          </button>
          <button
            onClick={() => setBgMode("light")}
            className={`px-3 py-1 text-xs font-bold rounded-full transition-all cursor-pointer ${
              bgMode === "light"
                ? "bg-white text-[#191817] shadow-sm"
                : "opacity-70 hover:opacity-100"
            }`}
          >
            Pure White
          </button>
          <button
            onClick={() => setBgMode("dark")}
            className={`px-3 py-1 text-xs font-bold rounded-full transition-all cursor-pointer ${
              bgMode === "dark"
                ? "bg-[#2A2832] text-white shadow-sm"
                : "opacity-70 hover:opacity-100"
            }`}
          >
            Dark (#121118)
          </button>
          <button
            onClick={() => setBgMode("purple")}
            className={`px-3 py-1 text-xs font-bold rounded-full transition-all cursor-pointer ${
              bgMode === "purple"
                ? "bg-[#312E81] text-white shadow-sm"
                : "opacity-70 hover:opacity-100"
            }`}
          >
            Deep Indigo
          </button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto py-10 space-y-12">

        {/* Section 1: Official Component Logo (`<Logo />`) */}
        <section className="space-y-4">
          <h2 className="text-lg font-bold tracking-tight opacity-90 flex items-center gap-2">
            <span>1.</span> Logo Component (`&lt;Logo /&gt;`)
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            
            {/* Card 1: Default Light Icon + Typography */}
            <div className="p-6 rounded-[20px] border border-gray-200/30 bg-white/40 backdrop-blur-sm flex flex-col gap-3">
              <span className="text-xs font-semibold opacity-60">Icon Light + Typography</span>
              <div className="py-4 flex items-center">
                <Logo sizeClassName="w-8 h-8" theme="light" showText={true} />
              </div>
              <code className="text-[11px] opacity-75 font-mono bg-black/5 p-2 rounded">
                &lt;Logo theme=&quot;light&quot; sizeClassName=&quot;w-8 h-8&quot; /&gt;
              </code>
            </div>

            {/* Card 2: Dark Icon + Typography (for Dark UI) */}
            <div className="p-6 rounded-[20px] border border-gray-200/30 bg-black/40 backdrop-blur-sm flex flex-col gap-3">
              <span className="text-xs font-semibold text-white/70">Icon Dark + Typography (Nền tối)</span>
              <div className="py-4 flex items-center">
                <Logo
                  sizeClassName="w-8 h-8"
                  theme="dark"
                  showText={true}
                  textClassName="text-white font-extrabold text-[15px] tracking-tight"
                />
              </div>
              <code className="text-[11px] text-white/80 font-mono bg-white/10 p-2 rounded">
                &lt;Logo theme=&quot;dark&quot; textClassName=&quot;text-white ...&quot; /&gt;
              </code>
            </div>

            {/* Card 3: Icon only */}
            <div className="p-6 rounded-[20px] border border-gray-200/30 bg-white/40 backdrop-blur-sm flex flex-col gap-3">
              <span className="text-xs font-semibold opacity-60">Icon Only (Thanh bên thu gọn, favicon)</span>
              <div className="py-4 flex items-center gap-4">
                <Logo sizeClassName="w-6 h-6" theme={bgMode === "dark" || bgMode === "purple" ? "dark" : "light"} showText={false} />
                <Logo sizeClassName="w-8 h-8" theme={bgMode === "dark" || bgMode === "purple" ? "dark" : "light"} showText={false} />
                <Logo sizeClassName="w-10 h-10" theme={bgMode === "dark" || bgMode === "purple" ? "dark" : "light"} showText={false} />
              </div>
              <code className="text-[11px] opacity-75 font-mono bg-black/5 p-2 rounded">
                &lt;Logo showText=&#123;false&#125; sizeClassName=&quot;w-8 h-8&quot; /&gt;
              </code>
            </div>

          </div>
        </section>


        {/* Section 2: Full Wordmark Image Files (Transparent) */}
        <section className="space-y-4">
          <h2 className="text-lg font-bold tracking-tight opacity-90 flex items-center gap-2">
            <span>2.</span> Wordmark Logo Tách Nền (Full Graphic Wordmark)
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

            {/* Wordmark Light */}
            <div className="p-6 rounded-[20px] border border-gray-200/40 bg-white p-8 flex flex-col gap-4 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#191817]">Wordmark Light (Tách nền)</span>
                <span className="text-[11px] px-2 py-0.5 rounded bg-gray-100 text-gray-600 font-mono">
                  flintflow-wordmark-light-transparent.png
                </span>
              </div>
              <div className="py-6 flex items-center justify-center bg-[#FAF9F7] rounded-[14px] border border-[#ECEAE5]">
                <img
                  src="/logo/flintflow-wordmark-light-transparent.png"
                  alt="FlintFlow Wordmark Light"
                  className="h-12 object-contain"
                />
              </div>
              <p className="text-xs text-gray-500">
                Thích hợp cho Header Landing Page, Báo cáo PRD xuất bản trên nền sáng.
              </p>
            </div>

            {/* Wordmark Dark */}
            <div className="p-6 rounded-[20px] border border-gray-700/60 bg-[#121118] p-8 flex flex-col gap-4 shadow-sm text-white">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white">Wordmark Dark (Tách nền)</span>
                <span className="text-[11px] px-2 py-0.5 rounded bg-gray-800 text-gray-300 font-mono">
                  flintflow-wordmark-dark-transparent.png
                </span>
              </div>
              <div className="py-6 flex items-center justify-center bg-[#1A1824] rounded-[14px] border border-gray-800">
                <img
                  src="/logo/flintflow-wordmark-dark-transparent.png"
                  alt="FlintFlow Wordmark Dark"
                  className="h-12 object-contain"
                />
              </div>
              <p className="text-xs text-gray-400">
                Thích hợp cho Dark Mode, Footer nền tối, hoặc Slide thuyết trình.
              </p>
            </div>

          </div>
        </section>


        {/* Section 3: Transparent Icons Isolated */}
        <section className="space-y-4">
          <h2 className="text-lg font-bold tracking-tight opacity-90 flex items-center gap-2">
            <span>3.</span> Biểu Tượng Icon &quot;F&quot; Tách Nền
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">

            {/* Icon Light on Light BG */}
            <div className="p-6 rounded-[18px] bg-white border border-[#E4E1DC] flex flex-col items-center gap-3 text-center">
              <span className="text-xs font-bold text-[#191817]">Icon Light (Nền sáng)</span>
              <div className="w-20 h-20 flex items-center justify-center p-2">
                <img
                  src="/logo/flintflow-icon-light-transparent.png"
                  alt="Icon Light"
                  className="w-full h-full object-contain drop-shadow-sm"
                />
              </div>
              <span className="text-[10.5px] text-gray-500 font-mono">flintflow-icon-light-transparent.png</span>
            </div>

            {/* Icon Light on Warm BG */}
            <div className="p-6 rounded-[18px] bg-[#F5F3F0] border border-[#E4E1DC] flex flex-col items-center gap-3 text-center">
              <span className="text-xs font-bold text-[#191817]">Icon Light (Nền Warm #F5F3F0)</span>
              <div className="w-20 h-20 flex items-center justify-center p-2">
                <img
                  src="/logo/flintflow-icon-light-transparent.png"
                  alt="Icon Light"
                  className="w-full h-full object-contain"
                />
              </div>
              <span className="text-[10.5px] text-gray-500 font-mono">Sidebar / Dashboard</span>
            </div>

            {/* Icon Dark on Dark BG */}
            <div className="p-6 rounded-[18px] bg-[#121118] border border-gray-800 flex flex-col items-center gap-3 text-center text-white">
              <span className="text-xs font-bold text-white">Icon Dark (Nền tối)</span>
              <div className="w-20 h-20 flex items-center justify-center p-2">
                <img
                  src="/logo/flintflow-icon-dark-transparent.png"
                  alt="Icon Dark"
                  className="w-full h-full object-contain"
                />
              </div>
              <span className="text-[10.5px] text-gray-400 font-mono">flintflow-icon-dark-transparent.png</span>
            </div>

            {/* Icon Dark on Primary Purple BG */}
            <div className="p-6 rounded-[18px] bg-[#4F46E5] border border-indigo-500 flex flex-col items-center gap-3 text-center text-white">
              <span className="text-xs font-bold text-white">Icon Dark (Nền tím thương hiệu)</span>
              <div className="w-20 h-20 flex items-center justify-center p-2">
                <img
                  src="/logo/flintflow-icon-dark-transparent.png"
                  alt="Icon Dark Purple"
                  className="w-full h-full object-contain"
                />
              </div>
              <span className="text-[10.5px] text-indigo-200 font-mono">Button / Banner</span>
            </div>

          </div>
        </section>


        {/* Section 4: Responsive Scale & Usage in Navigation */}
        <section className="space-y-4">
          <h2 className="text-lg font-bold tracking-tight opacity-90 flex items-center gap-2">
            <span>4.</span> Thử nghiệm kích thước thực tế trong UI
          </h2>
          <div className="p-6 rounded-[20px] border border-gray-200/30 bg-white/40 backdrop-blur-sm space-y-6">
            
            {/* Header Bar simulation */}
            <div>
              <span className="text-xs font-bold opacity-60 block mb-2">Mẫu Top Header Bar (58px):</span>
              <div className="h-[58px] bg-white border border-[#E4E1DC] rounded-[14px] px-6 flex items-center justify-between text-[#191817]">
                <Logo sizeClassName="w-7 h-7" theme="light" />
                <div className="flex items-center gap-3">
                  <span className="text-xs font-medium text-gray-500">Dự án của tôi</span>
                  <div className="w-7 h-7 rounded-full bg-[#F0EEEA] flex items-center justify-center text-xs font-bold">U</div>
                </div>
              </div>
            </div>

            {/* Sidebar simulation */}
            <div>
              <span className="text-xs font-bold opacity-60 block mb-2">Mẫu Sidebar Row:</span>
              <div className="w-[216px] bg-white border border-[#E4E1DC] rounded-[14px] p-4 flex flex-col gap-4 text-[#191817]">
                <Logo sizeClassName="w-6 h-6" theme="light" />
                <div className="space-y-1 text-xs font-semibold text-gray-600">
                  <div className="p-2 rounded bg-[#F4F3FE] text-[#3B34B0]">📁 Tất cả dự án</div>
                  <div className="p-2 rounded hover:bg-gray-50">★ Yêu thích</div>
                </div>
              </div>
            </div>

          </div>
        </section>

        {/* Action Link */}
        <div className="flex items-center justify-between pt-6 border-t border-gray-200/40">
          <Link
            href="/home"
            className="px-5 py-2.5 rounded-full btn-gradient-primary text-white text-xs font-bold"
          >
            ← Quay lại Dashboard
          </Link>
          <span className="text-xs opacity-60">
            Tất cả tài nguyên logo nằm tại: <code>public/logo/</code>
          </span>
        </div>

      </div>
    </div>
  );
}
