import {
  AngleDoubleLeftOutlined,
  AngleDoubleRightOutlined,
  ArrowRightOutlined,
  Bell1Outlined,
  BoxArchive1Outlined,
  Buildings1Outlined,
  CheckOutlined,
  ChevronDownOutlined,
  Comment1TextOutlined,
  CreditCardMultipleOutlined,
  ExitOutlined,
  FilePencilOutlined,
  Folder1Outlined,
  HourglassOutlined,
  Layers1Outlined,
  MagicOutlined,
  MenuHamburger1Outlined,
  MenuMeatballs1Outlined,
  Pencil1Outlined,
  PlusOutlined,
  Search1Outlined,
  Trash3Outlined,
  Upload1Outlined,
  UserMultiple4Outlined,
  Wallet1Outlined,
  XmarkCircleOutlined,
  XmarkOutlined,
} from "@lineiconshq/free-icons";

/**
 * Nơi duy nhất app chạm vào thư viện icon (Lineicons Free, MIT). Đổi thư viện chỉ sửa file này.
 * Tên icon là union ⇒ gõ sai tên bị typecheck bắt.
 *
 * Mỗi icon của `@lineiconshq/free-icons` là dữ liệu tĩnh `{ svg, viewBox }` (màu là placeholder `{color}`),
 * nên tự dựng `<svg>` thay vì dùng `@lineiconshq/react-lineicons` — bản 1.0.5 thiếu file CJS `main`,
 * Vite/vitest không resolve được.
 */
const ICONS = {
  "angle-double-left": AngleDoubleLeftOutlined,
  "angle-double-right": AngleDoubleRightOutlined,
  "arrow-right": ArrowRightOutlined,
  archive: BoxArchive1Outlined,
  bell: Bell1Outlined,
  building: Buildings1Outlined,
  check: CheckOutlined,
  "chevron-down": ChevronDownOutlined,
  close: XmarkOutlined,
  "credit-card": CreditCardMultipleOutlined,
  "error-circle": XmarkCircleOutlined,
  feedback: Comment1TextOutlined,
  "file-template": FilePencilOutlined,
  folder: Folder1Outlined,
  hourglass: HourglassOutlined,
  layers: Layers1Outlined,
  logout: ExitOutlined,
  menu: MenuHamburger1Outlined,
  more: MenuMeatballs1Outlined,
  pencil: Pencil1Outlined,
  plus: PlusOutlined,
  search: Search1Outlined,
  sparkle: MagicOutlined,
  trash: Trash3Outlined,
  upload: Upload1Outlined,
  users: UserMultiple4Outlined,
  wallet: Wallet1Outlined,
} as const;

export type IconName = keyof typeof ICONS;

interface IconProps {
  name: IconName;
  size?: number;
  className?: string;
  /** Có nhãn ⇒ icon mang nghĩa (role="img"); không có ⇒ trang trí, ẩn khỏi trình đọc màn hình. */
  label?: string;
}

// Markup chỉ đến từ gói icon tĩnh ở trên (không bao giờ từ dữ liệu người dùng); màu theo `currentColor`.
const MARKUP = Object.fromEntries(
  Object.entries(ICONS).map(([key, icon]) => [key, icon.svg.replaceAll("{color}", "currentColor")])
) as Record<IconName, string>;

export default function Icon({ name, size = 18, className, label }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={ICONS[name].viewBox}
      width={size}
      height={size}
      fill="none"
      className={`shrink-0 ${className ?? ""}`}
      data-icon={name}
      {...(label ? { role: "img", "aria-label": label } : { "aria-hidden": true, focusable: false })}
      dangerouslySetInnerHTML={{ __html: MARKUP[name] }}
    />
  );
}
