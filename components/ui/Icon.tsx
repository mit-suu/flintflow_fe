import type { CSSProperties } from "react";
import type { Icon as PhosphorIcon } from "@phosphor-icons/react";
import { Archive } from "@phosphor-icons/react/dist/ssr/Archive";
import { ArrowRight } from "@phosphor-icons/react/dist/ssr/ArrowRight";
import { ArrowUp } from "@phosphor-icons/react/dist/ssr/ArrowUp";
import { Bell } from "@phosphor-icons/react/dist/ssr/Bell";
import { Buildings } from "@phosphor-icons/react/dist/ssr/Buildings";
import { CaretDown } from "@phosphor-icons/react/dist/ssr/CaretDown";
import { CaretLeft } from "@phosphor-icons/react/dist/ssr/CaretLeft";
import { CaretRight } from "@phosphor-icons/react/dist/ssr/CaretRight";
import { CaretUpDown } from "@phosphor-icons/react/dist/ssr/CaretUpDown";
import { ChatText } from "@phosphor-icons/react/dist/ssr/ChatText";
import { Check } from "@phosphor-icons/react/dist/ssr/Check";
import { CheckCircle } from "@phosphor-icons/react/dist/ssr/CheckCircle";
import { CircleNotch } from "@phosphor-icons/react/dist/ssr/CircleNotch";
import { Clock } from "@phosphor-icons/react/dist/ssr/Clock";
import { CloudSlash } from "@phosphor-icons/react/dist/ssr/CloudSlash";
import { CreditCard } from "@phosphor-icons/react/dist/ssr/CreditCard";
import { DotsThree } from "@phosphor-icons/react/dist/ssr/DotsThree";
import { DotsThreeVertical } from "@phosphor-icons/react/dist/ssr/DotsThreeVertical";
import { EnvelopeSimple } from "@phosphor-icons/react/dist/ssr/EnvelopeSimple";
import { Eye } from "@phosphor-icons/react/dist/ssr/Eye";
import { EyeSlash } from "@phosphor-icons/react/dist/ssr/EyeSlash";
import { FilePlus } from "@phosphor-icons/react/dist/ssr/FilePlus";
import { FileText } from "@phosphor-icons/react/dist/ssr/FileText";
import { Folder } from "@phosphor-icons/react/dist/ssr/Folder";
import { List } from "@phosphor-icons/react/dist/ssr/List";
import { MagnifyingGlass } from "@phosphor-icons/react/dist/ssr/MagnifyingGlass";
import { Paperclip } from "@phosphor-icons/react/dist/ssr/Paperclip";
import { PencilSimple } from "@phosphor-icons/react/dist/ssr/PencilSimple";
import { PiggyBank } from "@phosphor-icons/react/dist/ssr/PiggyBank";
import { Plus } from "@phosphor-icons/react/dist/ssr/Plus";
import { SidebarSimple } from "@phosphor-icons/react/dist/ssr/SidebarSimple";
import { SignOut } from "@phosphor-icons/react/dist/ssr/SignOut";
import { Sparkle } from "@phosphor-icons/react/dist/ssr/Sparkle";
import { Stack } from "@phosphor-icons/react/dist/ssr/Stack";
import { Trash } from "@phosphor-icons/react/dist/ssr/Trash";
import { UploadSimple } from "@phosphor-icons/react/dist/ssr/UploadSimple";
import { User } from "@phosphor-icons/react/dist/ssr/User";
import { Users } from "@phosphor-icons/react/dist/ssr/Users";
import { Wallet } from "@phosphor-icons/react/dist/ssr/Wallet";
import { WarningCircle } from "@phosphor-icons/react/dist/ssr/WarningCircle";
import { X } from "@phosphor-icons/react/dist/ssr/X";
import { XCircle } from "@phosphor-icons/react/dist/ssr/XCircle";

/**
 * Nơi duy nhất app chạm vào thư viện icon (Phosphor Icons, MIT). Đổi thư viện chỉ sửa file này.
 * Tên icon là tên MIỀN của app (ánh xạ sang tên Phosphor) ⇒ đổi bộ icon không phải sửa nơi gọi;
 * tên là union ⇒ gõ sai bị typecheck bắt.
 *
 * Import từ `dist/ssr`: bản không dùng React context, chạy được cả Server lẫn Client Component.
 * Import SÂU từng icon (`dist/ssr/<Tên>`) chứ không qua barrel `dist/ssr`: barrel kéo theo ~1300 module
 * icon ⇒ chunk đầu trang phình ra (reload chậm) và test nạp lại module bị treo.
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
  "check-circle": CheckCircle,
  "chevron-down": CaretDown,
  clock: Clock,
  "cloud-off": CloudSlash,
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
  "menu-open": SidebarSimple,
  more: DotsThreeVertical,
  "more-horizontal": DotsThree,
  pencil: PencilSimple,
  savings: PiggyBank,
  plus: Plus,
  search: MagnifyingGlass,
  spinner: CircleNotch,
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
  style?: CSSProperties;
  /** Có nhãn ⇒ icon mang nghĩa (role="img"); không có ⇒ trang trí, ẩn khỏi trình đọc màn hình. */
  label?: string;
  /** Độ nét của Phosphor. `fill` dùng cho mục đang chọn (vd. nav active); mặc định "regular". */
  weight?: "regular" | "bold" | "fill";
}

export default function Icon({ name, size = 18, className, style, label, weight = "regular" }: IconProps) {
  const Glyph = ICONS[name];
  return (
    <Glyph
      size={size}
      weight={weight}
      // Màu theo `currentColor` (mặc định của Phosphor) ⇒ tô bằng class `text-*`
      className={`shrink-0 ${className ?? ""}`}
      style={style}
      data-icon={name}
      {...(label ? { role: "img", "aria-label": label } : { "aria-hidden": true, focusable: false })}
    />
  );
}
