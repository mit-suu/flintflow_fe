import Link from "next/link";

export type LogoVariant = "icon" | "wordmark";
export type LogoTheme = "light" | "dark";

export interface LogoProps {
  className?: string;
  /** Tailwind size classes. Icon: fixed box (e.g. "w-5 h-5"); wordmark: height + auto width (e.g. "h-5 w-auto"). */
  sizeClassName?: string;
  href?: string;
  /** "icon" = the F mark only; "wordmark" = full "FlintFlow" logo (already contains the name, no extra text). */
  variant?: LogoVariant;
  /** Background the logo sits on: "light" → dark ink artwork, "dark" → white ink artwork. */
  theme?: LogoTheme;
  alt?: string;
}

export const LOGO_PATHS = {
  iconLight: "/logo/flintflow-icon-light-transparent.png",
  iconDark: "/logo/flintflow-icon-dark-transparent.png",
  wordmarkLight: "/logo/flintflow-wordmark-light-transparent.png",
  wordmarkDark: "/logo/flintflow-wordmark-dark-transparent.png",
} as const;

export default function Logo({
  className = "",
  sizeClassName,
  href,
  variant = "icon",
  theme = "light",
  alt = "FlintFlow",
}: LogoProps) {
  const isWordmark = variant === "wordmark";
  const src = isWordmark
    ? theme === "dark" ? LOGO_PATHS.wordmarkDark : LOGO_PATHS.wordmarkLight
    : theme === "dark" ? LOGO_PATHS.iconDark : LOGO_PATHS.iconLight;
  const size = sizeClassName ?? (isWordmark ? "h-5 w-auto" : "w-5 h-5");

  const img = (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      alt={alt}
      src={src}
      className={`${size} object-contain shrink-0 select-none ${className}`}
      draggable={false}
      suppressHydrationWarning
    />
  );

  if (href) {
    return (
      <Link href={href} className="inline-flex items-center hover:opacity-90 transition-opacity">
        {img}
      </Link>
    );
  }

  return img;
}
