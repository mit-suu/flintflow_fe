import Link from "next/link";

export type LogoVariant = "icon" | "wordmark" | "full";
export type LogoTheme = "dark" | "light";
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

export const LOGO_PATHS: Record<LogoType, string> = {
  "icon-dark": "/logo/flintflow-icon-dark-transparent.png",
  "icon-light": "/logo/flintflow-icon-light-transparent.png",
  "wordmark-dark": "/logo/flintflow-wordmark-dark-transparent.png",
  "wordmark-light": "/logo/flintflow-wordmark-light-transparent.png",
};

export default function Logo({
  className = "",
  sizeClassName = "w-8 h-8",
  href,
  variant = "icon",
  theme = "dark",
  type,
  alt = "FlintFlow Logo",
  showText = false,
  textClassName = "text-white font-semibold text-lg",
  src,
}: LogoProps) {
  let logoSrc = src;

  if (!logoSrc) {
    if (type && LOGO_PATHS[type]) {
      logoSrc = LOGO_PATHS[type];
    } else if (variant === "wordmark") {
      logoSrc = theme === "light" ? LOGO_PATHS["wordmark-light"] : LOGO_PATHS["wordmark-dark"];
    } else {
      logoSrc = theme === "light" ? LOGO_PATHS["icon-light"] : LOGO_PATHS["icon-dark"];
    }
  }

  const content = (
    <div className={`inline-flex items-center gap-2 ${className}`}>
      <div className={`relative shrink-0 ${sizeClassName}`}>
        <img
          alt={alt}
          className="w-full h-full object-contain"
          src={logoSrc}
          suppressHydrationWarning
        />
      </div>
      {showText && <span className={textClassName}>FlintFlow</span>}
    </div>
  );

  if (href) {
    return <Link href={href}>{content}</Link>;
  }

  return content;
}
