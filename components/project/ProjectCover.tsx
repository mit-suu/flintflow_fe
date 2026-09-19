import type { SourceModeTone } from "@/lib/project-source-mode";

/**
 * Ảnh bìa tự sinh cho card dự án: nền gradient theo tone của source mode + 3 đốm màu mờ. Biến thể (hướng nền,
 * vị trí đốm) chọn theo hash của id ⇒ mỗi dự án một bìa, cố định qua các lần tải. Chỉ class token, không ảnh.
 */
const PALETTE: Record<SourceModeTone, { base: string; blobs: [string, string, string] }> = {
  primary: {
    base: "from-brand-300 via-primary-fixed to-accent-gold-soft",
    blobs: ["bg-primary", "bg-brand-500", "bg-accent-gold-light"],
  },
  info: {
    base: "from-info-border via-info-soft to-success-soft",
    blobs: ["bg-info", "bg-brand-400", "bg-success-light"],
  },
  warning: {
    base: "from-accent-gold-light via-accent-gold-soft to-error-container",
    blobs: ["bg-accent-gold", "bg-error-border", "bg-brand-300"],
  },
};

// Hướng gradient nền theo biến thể — class viết đủ để Tailwind sinh ra
const DIRECTIONS = ["bg-gradient-to-br", "bg-gradient-to-tr", "bg-gradient-to-bl", "bg-gradient-to-r"] as const;

// Vị trí/kích thước 3 đốm cho từng biến thể (số đo, không phải màu)
const LAYOUTS: readonly [React.CSSProperties, React.CSSProperties, React.CSSProperties][] = [
  [{ left: "-12%", top: "-40%", width: "55%", height: "150%" }, { right: "-8%", bottom: "-60%", width: "45%", height: "130%" }, { left: "45%", top: "10%", width: "20%", height: "60%" }],
  [{ right: "-15%", top: "-55%", width: "55%", height: "160%" }, { left: "10%", bottom: "-70%", width: "40%", height: "120%" }, { left: "-5%", top: "-30%", width: "25%", height: "80%" }],
  [{ left: "30%", top: "-70%", width: "45%", height: "150%" }, { left: "-10%", bottom: "-50%", width: "36%", height: "110%" }, { right: "-6%", bottom: "-20%", width: "28%", height: "90%" }],
  [{ left: "-5%", bottom: "-65%", width: "60%", height: "140%" }, { right: "5%", top: "-50%", width: "34%", height: "120%" }, { left: "40%", top: "-40%", width: "22%", height: "70%" }],
];

/** Hash chuỗi ổn định (djb2) → chỉ số biến thể. */
export const coverVariant = (seed: string): number => {
  let hash = 5381;
  for (let i = 0; i < seed.length; i++) hash = ((hash << 5) + hash + seed.charCodeAt(i)) | 0;
  return Math.abs(hash) % LAYOUTS.length;
};

interface ProjectCoverProps {
  seed: string;
  tone: SourceModeTone;
  className?: string;
}

export default function ProjectCover({ seed, tone, className }: ProjectCoverProps) {
  const palette = PALETTE[tone];
  const variant = coverVariant(seed);
  const [first, second, third] = LAYOUTS[variant];
  return (
    <div aria-hidden data-cover-variant={variant} className={`relative overflow-hidden ${DIRECTIONS[variant]} ${palette.base} ${className ?? ""}`}>
      <span className={`absolute rounded-full opacity-80 blur-2xl ${palette.blobs[0]}`} style={first} />
      <span className={`absolute rounded-full opacity-60 blur-2xl ${palette.blobs[1]}`} style={second} />
      <span className={`absolute rounded-full opacity-70 blur-xl ${palette.blobs[2]}`} style={third} />
    </div>
  );
}
