import Link from "next/link";

export const FLINTFLOW_LOGO_URL =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuBPFPwVJNjtC5eccMJHmnoryqh2_s6fVPROdaGcJI_8VkKDM8-I75WRGFX9R2ZapL-fBpxTFa5-4FehxESdldKY1aQFH-Xdky6p2aDRhd_jGPzqjWqZBjYkdokU3PFPDZFVt0okdvqHwPWCKsTi6GKqPTJru0xChI1jCg7NCjWH9mWqjMaB7f7VRh9yQsAbrFQxsB9ze7ZdImmIWtdExBm7xdpt-M38-43FX2CN1eTjIp31ecpgN-rc7w";

interface LogoProps {
  className?: string;
  sizeClassName?: string;
  href?: string;
}

export default function Logo({
  className = "",
  sizeClassName = "w-36 h-36",
  href,
}: LogoProps) {
  const content = (
    <div className={`inline-block ${sizeClassName} ${className}`}>
      <img
        alt="Flintflow Logo"
        className="w-full h-full object-contain"
        src={FLINTFLOW_LOGO_URL}
        suppressHydrationWarning
      />
    </div>
  );

  if (href) {
    return <Link href={href}>{content}</Link>;
  }

  return content;
}
