import type { Icon as PhosphorIcon } from "@phosphor-icons/react";
import {
  Archive,
  ArrowRight,
  ArrowUp,
  ArrowsIn,
  ArrowsOut,
  Bell,
  Buildings,
  CaretLeft,
  CaretRight,
  CaretUpDown,
  CaretDown,
  CaretUp,
  ChatText,
  Check,
  ClockCounterClockwise,
  CreditCard,
  DotsThreeVertical,
  EnvelopeSimple,
  Eye,
  EyeSlash,
  Export,
  FilePlus,
  FileText,
  Folder,
  List,
  MagnifyingGlass,
  Paperclip,
  PencilSimple,
  Play,
  Plus,
  ShieldCheck,
  SidebarSimple,
  SignOut,
  Sparkle,
  Stack,
  Toolbox,
  Trash,
  UploadSimple,
  User,
  Users,
  Wallet,
  WarningCircle,
  X,
  XCircle,
} from "@phosphor-icons/react/dist/ssr";

/**
 * Nơi duy nhất app chạm vào thư viện icon (Phosphor Icons, MIT). Đổi thư viện chỉ sửa file này.
 * Tên icon là tên MIỀN của app (ánh xạ sang tên Phosphor) ⇒ đổi bộ icon không phải sửa nơi gọi;
 * tên là union ⇒ gõ sai bị typecheck bắt.
 *
 * Import từ `dist/ssr`: bản không dùng React context, chạy được cả Server lẫn Client Component.
 */
const ICONS = {
  "arrow-right": ArrowRight,
  "arrow-up": ArrowUp,
  attach: Paperclip,
  "caret-left": CaretLeft,
  "caret-right": CaretRight,
  "caret-up-down": CaretUpDown,
  archive: Archive,
  bell: Bell,
  building: Buildings,
  check: Check,
  "chevron-down": CaretDown,
  "chevron-up": CaretUp,
  collapse: ArrowsIn,
  expand: ArrowsOut,
  export: Export,
  history: ClockCounterClockwise,
  play: Play,
  "shield-check": ShieldCheck,
  sidebar: SidebarSimple,
  toolbox: Toolbox,
  close: X,
  "credit-card": CreditCard,
  "error-circle": XCircle,
  eye: Eye,
  "eye-off": EyeSlash,
  feedback: ChatText,
  file: FileText,
  "file-template": FilePlus,
  folder: Folder,
  layers: Stack,
  mail: EnvelopeSimple,
  logout: SignOut,
  menu: List,
  more: DotsThreeVertical,
  pencil: PencilSimple,
  plus: Plus,
  search: MagnifyingGlass,
  sparkle: Sparkle,
  trash: Trash,
  upload: UploadSimple,
  user: User,
  users: Users,
  wallet: Wallet,
  warning: WarningCircle,
} as const satisfies Record<string, PhosphorIcon>;

export type IconName = keyof typeof ICONS;

interface IconProps {
  name: IconName;
  size?: number;
  className?: string;
  /** Có nhãn ⇒ icon mang nghĩa (role="img"); không có ⇒ trang trí, ẩn khỏi trình đọc màn hình. */
  label?: string;
  /** Độ nét của Phosphor. `fill` dùng cho mục đang chọn (vd. nav active); mặc định "regular". */
  weight?: "regular" | "bold" | "fill";
}

export default function Icon({ name, size = 18, className, label, weight = "regular" }: IconProps) {
  const Glyph = ICONS[name];
  return (
    <Glyph
      size={size}
      weight={weight}
      // Màu theo `currentColor` (mặc định của Phosphor) ⇒ tô bằng class `text-*`
      className={`shrink-0 ${className ?? ""}`}
      data-icon={name}
      {...(label ? { role: "img", "aria-label": label } : { "aria-hidden": true, focusable: false })}
    />
  );
}
