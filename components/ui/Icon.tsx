import type { CSSProperties } from "react";
import {
  Archive,
  ArrowRight,
  ArrowUp,
  Bell,
  Building2,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronsUpDown,
  CircleAlert,
  CircleCheck,
  CircleX,
  Clock,
  CloudOff,
  CreditCard,
  Ellipsis,
  EllipsisVertical,
  Eye,
  EyeOff,
  FilePlus,
  FileText,
  Folder,
  History,
  Languages,
  Layers,
  LoaderCircle,
  LogOut,
  Mail,
  Maximize2,
  Menu,
  MessageSquareText,
  Minimize2,
  PanelLeft,
  Paperclip,
  Pencil,
  PiggyBank,
  Play,
  Plus,
  RefreshCw,
  Search,
  Share,
  ShieldCheck,
  Sparkles,
  Trash2,
  Upload,
  User,
  Users,
  Wallet,
  Wrench,
  X,
  type LucideIcon,
} from "lucide-react";

/**
 * Nơi duy nhất app chạm vào thư viện icon (Lucide, ISC). Đổi thư viện chỉ sửa file này.
 * Tên icon là tên MIỀN của app (ánh xạ sang tên Lucide) ⇒ đổi bộ icon không phải sửa nơi gọi;
 * tên là union ⇒ gõ sai bị typecheck bắt.
 *
 * Trước đây dùng Phosphor. Đổi sang Lucide vì Phosphor chỉ có 5 nấc nét cố định (thin…bold) và nấc đậm
 * nhất của nó vẫn mảnh hơn chữ bên cạnh ở cỡ 15–19px, trong khi Lucide nhận `strokeWidth` là số nên độ nét
 * chỉnh được đúng mức mình muốn. Đổi lại: Lucide không có bản tô đặc, nên "mục đang chọn" thể hiện bằng
 * nét dày hơn + màu, không bằng icon đặc ruột.
 *
 * Import từ barrel `lucide-react`: `next.config.ts` bật `optimizePackageImports` cho gói này nên Next tự
 * viết lại thành import sâu từng icon lúc build — không kéo cả bộ vào chunk đầu trang.
 */
const ICONS = {
  "arrow-right": ArrowRight,
  "arrow-up": ArrowUp,
  attach: Paperclip,
  "caret-left": ChevronLeft,
  "caret-right": ChevronRight,
  "caret-up-down": ChevronsUpDown,
  archive: Archive,
  bell: Bell,
  building: Building2,
  check: Check,
  "check-circle": CircleCheck,
  "chevron-down": ChevronDown,
  "chevron-up": ChevronUp,
  clock: Clock,
  collapse: Minimize2,
  expand: Maximize2,
  export: Share,
  history: History,
  play: Play,
  refresh: RefreshCw,
  "shield-check": ShieldCheck,
  sidebar: PanelLeft,
  toolbox: Wrench,
  "cloud-off": CloudOff,
  close: X,
  "credit-card": CreditCard,
  "error-circle": CircleX,
  eye: Eye,
  "eye-off": EyeOff,
  feedback: MessageSquareText,
  file: FileText,
  "file-template": FilePlus,
  folder: Folder,
  layers: Layers,
  mail: Mail,
  logout: LogOut,
  menu: Menu,
  "menu-open": PanelLeft,
  more: EllipsisVertical,
  "more-horizontal": Ellipsis,
  pencil: Pencil,
  savings: PiggyBank,
  plus: Plus,
  search: Search,
  spinner: LoaderCircle,
  sparkle: Sparkles,
  translate: Languages,
  trash: Trash2,
  upload: Upload,
  user: User,
  users: Users,
  wallet: Wallet,
  warning: CircleAlert,
} as const satisfies Record<string, LucideIcon>;

export type IconName = keyof typeof ICONS;

/**
 * Hai nấc nét, tính theo lưới 24 của Lucide (nét co theo `size`, nên icon nhỏ vẫn mảnh tương ứng).
 * Nấc thường để đúng 2 — mặc định của Lucide, cũng là độ nét của shadcn/ui; đẩy lên 2.5–3 thì icon
 * nặng hơn chữ bên cạnh và trông thô. Đổi độ nét toàn app chỉ sửa hai số ở đây.
 */
const STROKE = { regular: 2, bold: 2.5 } as const;

interface IconProps {
  name: IconName;
  size?: number;
  className?: string;
  style?: CSSProperties;
  /** Có nhãn ⇒ icon mang nghĩa (role="img"); không có ⇒ trang trí, ẩn khỏi trình đọc màn hình. */
  label?: string;
  /** Độ nét. `bold` cho mục đang chọn (vd. nav active) và nút cần nhấn mạnh; mặc định "regular". */
  weight?: keyof typeof STROKE;
}

export default function Icon({ name, size = 18, className, style, label, weight = "regular" }: IconProps) {
  const Glyph = ICONS[name];
  return (
    <Glyph
      size={size}
      strokeWidth={STROKE[weight]}
      // Màu theo `currentColor` (mặc định của Lucide) ⇒ tô bằng class `text-*`
      className={`shrink-0 ${className ?? ""}`}
      style={style}
      data-icon={name}
      {...(label ? { role: "img", "aria-label": label } : { "aria-hidden": true, focusable: false })}
    />
  );
}
