import Link from "next/link";
import Image from "next/image";

export type LogoVariant = "icon" | "wordmark" | "full";
export type LogoTheme = "light" | "dark";
export type LogoType =
  | "icon-dark"
  | "icon-light"
  | "wordmark-dark"
  | "wordmark-light";

export interface LogoProps {
  className?: string;
  sizeClassName?: string;
  href?: string;
  variant?: LogoVariant;
  theme?: LogoTheme;
  type?: LogoType;
  alt?: string;
  showText?: boolean;
  textClassName?: string;
  src?: string;
}

export const LOGO_PATHS = {
  // Light theme (used on light / white / warm backgrounds like #F5F3F0)
  iconLight: "/logo/flintflow-icon-light-transparent.png",
  wordmarkLight: "/logo/flintflow-wordmark-light-transparent.png",

  // Dark theme (used on dark / black / indigo backgrounds)
  iconDark: "/logo/flintflow-icon-dark-transparent.png",
  wordmarkDark: "/logo/flintflow-wordmark-dark-transparent.png",

  // Legacy mappings
  "icon-light": "/logo/flintflow-icon-light-transparent.png",
  "icon-dark": "/logo/flintflow-icon-dark-transparent.png",
  "wordmark-light": "/logo/flintflow-wordmark-light-transparent.png",
  "wordmark-dark": "/logo/flintflow-wordmark-dark-transparent.png",
} as const;

export default function Logo({
  className = "",
  sizeClassName = "w-7 h-7",
  href,
  variant = "icon",
  theme = "light",
  type,
  alt = "FlintFlow Logo",
  showText = true,
  textClassName = "text-[#191817] font-extrabold text-[15px] tracking-tight",
  src,
}: LogoProps) {
  // Determine the correct logo source
  let logoSrc = src;

  if (!logoSrc) {
    if (type && LOGO_PATHS[type]) {
      logoSrc = LOGO_PATHS[type];
    } else if (variant === "wordmark") {
      logoSrc = theme === "dark" ? LOGO_PATHS.wordmarkDark : LOGO_PATHS.wordmarkLight;
    } else {
      logoSrc = theme === "dark" ? LOGO_PATHS.iconDark : LOGO_PATHS.iconLight;
    }
  }

  const isWordmark = variant === "wordmark";

  const content = (
    <div className={`inline-flex items-center gap-2.5 select-none ${className}`}>
      {logoSrc ? (
        <div className={`relative shrink-0 flex items-center justify-center ${sizeClassName}`}>
          <img
            alt={alt}
            className="w-full h-full object-contain"
            src={logoSrc}
            suppressHydrationWarning
          />
        </div>
      ) : (
        <div
          className="w-7 h-7 rounded-[9px] text-white font-extrabold text-[14px] flex items-center justify-center shrink-0 shadow-[0_4px_12px_rgba(79,70,229,0.35)]"
          style={{ background: "linear-gradient(135deg,#7C74F0,#4F46E5)" }}
        >
          F
        </div>
      )}

      {/* Show text only if variant is not already wordmark and showText is true */}
      {!isWordmark && showText && (
        <span className={textClassName}>
          Flint<span className="bg-gradient-to-r from-[#4F46E5] to-[#7C74F0] bg-clip-text text-transparent">Flow</span>
        </span>
      )}
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="inline-flex hover:opacity-90 transition-opacity">
        {content}
      </Link>
    );
  }

  return content;
}

