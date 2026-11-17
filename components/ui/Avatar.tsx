import Logo from "@/components/Logo";

export type AvatarSize = "sm" | "md" | "lg";

interface AvatarProps {
  /** Tên hiển thị. Rỗng thì lấy phần trước `@` của email. */
  name?: string | null;
  email?: string | null;
  size?: AvatarSize;
  className?: string;
  /**
   * Chưa có tên thì hiện logo FlintFlow thay vì chữ đầu email. Dùng cho avatar của chính người đang đăng nhập lúc tên
   * hồ sơ chưa về: chữ đoán từ email (vd "Q" của quynhfe99) sẽ đổi sang chữ thật, logo thì không bị hiểu là tên ai.
   */
  brandFallback?: boolean;
}

const SIZE: Record<AvatarSize, string> = {
  sm: "w-8 h-8 text-body font-semibold",
  md: "w-10 h-10 text-heading font-bold",
  lg: "w-16 h-16 text-metric font-bold",
};

/** Cỡ logo trong vòng tròn, chừa viền như chữ cái. */
const BRAND_SIZE: Record<AvatarSize, string> = { sm: "w-4 h-4", md: "w-5 h-5", lg: "w-8 h-8" };

/** Chữ cái đầu của tên, không có tên thì của email, không có gì thì dấu hỏi. */
const initialOf = (name?: string | null, email?: string | null) =>
  (name?.trim() || email?.split("@")[0] || "?").charAt(0).toUpperCase();

/**
 * Ảnh đại diện của một người: vòng tròn chữ cái đầu, nền tím nhạt chữ tím (màu trơn, không gradient).
 * Tài khoản chưa có ảnh thật — khi nào BE có field ảnh thì thay ruột ở đây, nơi gọi không phải sửa.
 *
 * `aria-hidden`: tên người luôn nằm ngay cạnh nên chữ cái này chỉ là trang trí, đọc lên là lặp.
 */
export default function Avatar({ name, email, size = "sm", className, brandFallback = false }: AvatarProps) {
  const showBrand = brandFallback && !name?.trim();
  return (
    <span
      aria-hidden
      className={`shrink-0 rounded-full flex items-center justify-center bg-primary-fixed text-primary ${SIZE[size]} ${className ?? ""}`}
    >
      {showBrand ? <Logo variant="icon" sizeClassName={BRAND_SIZE[size]} theme="light" alt="" /> : initialOf(name, email)}
    </span>
  );
}
