import type { PhaseId } from "@/lib/constants/step-registry";

/*
 * Nội dung tĩnh của landing page. Ngôn ngữ hình ảnh theo dashboard (phẳng, không viền, màu nền pastel, thẻ thư mục,
 * card dự án + thanh 12 giai đoạn); nội dung theo business flow (`flintflow/docs/business-flow.md`).
 * Sửa copy ở đây, không phải trong JSX. Chỉ nói điều sản phẩm đang làm được.
 * Số liệu gói cước khớp `flintflow_be/src/modules/billing/plan.config.ts` — đổi ở BE thì đổi ở đây.
 */

export const NAV_LINKS = [
  { href: "#top", label: "Trang chủ" },
  { href: "#cach-hoat-dong", label: "Cách hoạt động" },
  { href: "#che-do", label: "Cách bắt đầu" },
  { href: "#bang-gia", label: "Bảng giá" },
] as const;

export const HERO = {
  eyebrow: "AI Business Analyst",
  headline: "Hiểu đúng sản phẩm",
  headlineAccent: "trước khi viết code",
  subline:
    "FlintFlow cùng bạn làm rõ ý tưởng, viết yêu cầu và kiểm tra lại theo cách một BA có kinh nghiệm vẫn làm. Kết quả là bản SRS mà đội dev và công cụ AI lập trình đều dựa vào được.",
  primaryCta: "Bắt đầu miễn phí",
  secondaryCta: "Xem workspace",
  facts: ["3 cách bắt đầu một dự án", "12 giai đoạn, bước nào cũng do bạn duyệt", "Xuất .docx theo đúng mẫu"],
} as const;

/** Card dự án minh hoạ ở hero — cùng hình thức card trên dashboard (tên, trạng thái, việc tiếp theo, thanh giai đoạn). */
export const PREVIEW_PROJECTS = [
  {
    name: "Cổng cấp phép xây dựng",
    status: { label: "Sẵn sàng", tone: "ok" },
    next: "Kiểm tra & chốt baseline",
    phasesDone: 11,
  },
  {
    name: "App đặt lịch spa tại nhà",
    status: { label: "Cần làm rõ", tone: "warn" },
    next: "Phân tích Brief",
    phasesDone: 3,
  },
] as const;

export const PREVIEW_FOLDER = { name: "Sở Xây dựng", count: "4 dự án" } as const;

/* Thẻ nổi ở hero: kết quả kiểm tra 3 tầng (hình thức · nội dung · chất lượng yêu cầu). */
export const CHECK_CARD = {
  title: "Kiểm tra 3 tầng",
  status: "Sẵn sàng chốt",
  count: "0",
  countLabel: "cờ đỏ · 2 cờ vàng cần xem",
  tiers: [
    { label: "Hình thức", tone: "ok" },
    { label: "Nội dung", tone: "ok" },
    { label: "Chất lượng", tone: "warn" },
  ],
} as const;

export const HOW_HEADING = {
  eyebrow: "Cách hoạt động",
  title: "Quy trình của một BA, chia thành 12 giai đoạn.",
  subline: "AI soạn nháp từng phần. Bạn chấp nhận hoặc yêu cầu sửa rồi mới đi tiếp.",
} as const;

export type GroupTone = "blue" | "purple" | "green" | "amber";

/** Bốn bước BA gom 12 giai đoạn thật của step registry (`lib/constants/step-registry.ts`). */
export const PHASE_GROUPS: { title: string; body: string; phases: PhaseId[]; tone: GroupTone }[] = [
  {
    title: "Làm rõ",
    body: "Bạn kể ý tưởng hoặc tải tài liệu sẵn có lên. FlintFlow chỉ hỏi thêm những gì còn thiếu.",
    phases: ["B-0", "B-1"],
    tone: "blue",
  },
  {
    title: "Phân tích",
    body: "Tách sự thật khỏi giả định, chỉ ra mâu thuẫn và chỗ còn trống. Brief phải được duyệt trước khi viết SRS.",
    phases: ["B-2", "S-1"],
    tone: "purple",
  },
  {
    title: "Đặc tả",
    body: "Use case, yêu cầu phi chức năng, sơ đồ Use Case và ERD được soạn lần lượt, từng phần một.",
    phases: ["S-2", "S-3", "S-4", "S-5", "S-6", "S-7", "S-8"],
    tone: "green",
  },
  {
    title: "Kiểm tra",
    body: "Đối chiếu với mẫu, với ISO/IEC/IEEE 29148 và chất lượng từng yêu cầu. Còn cờ đỏ thì chưa chốt được bản.",
    phases: ["S-9"],
    tone: "amber",
  },
];

export const MODES_HEADING = {
  eyebrow: "Cách bắt đầu",
  title: "Bắt đầu từ chỗ bạn đang có.",
} as const;

export type Mode = {
  title: string;
  body: string;
  /** Màu thẻ thư mục — cùng tone với thẻ chọn chế độ khi tạo dự án (`SourceModePicker`). */
  tone: GroupTone;
  tags: string[];
};

export const MODES: Mode[] = [
  {
    title: "Tạo mới theo mẫu FPT",
    body: "Bạn chỉ có ý tưởng và vài ghi chú. FlintFlow dẫn bạn từ Brief đến bản SRS đầy đủ theo mẫu FPT.",
    tone: "purple",
    tags: ["Brief", "12 giai đoạn", "Mẫu FPT"],
  },
  {
    title: "Theo mẫu của khách",
    body: "Tải lên file mẫu khách yêu cầu. FlintFlow đọc cấu trúc mẫu, chỉ soạn những section mẫu cần và điền thẳng vào file đó.",
    tone: "amber",
    tags: ["Chỉ section mẫu cần", "Điền vào file gốc"],
  },
  {
    title: "Sửa SRS có sẵn",
    body: "Nhập file .docx đang dùng để biết nó còn thiếu gì. Khách đổi yêu cầu thì chỗ sửa hiện bằng Track Changes ngay trong file.",
    tone: "blue",
    tags: ["Danh sách gap", "Track Changes"],
  },
];

export const WORKSPACE_HEADING = {
  eyebrow: "Bên trong workspace",
  headline: "AI đề xuất.",
  headlineAccent: "Bạn quyết định.",
  subline: "Mọi nội dung vào tài liệu đều qua tay bạn: chấp nhận, yêu cầu sửa, hoặc hỏi lại khách.",
} as const;

export type Plan = {
  name: string;
  price: string;
  unit: string;
  features: string[];
  cta: string;
  recommended?: boolean;
};

export const PRICING_HEADING = {
  eyebrow: "Bảng giá",
  title: "Dùng thử không tốn gì.",
  subline: "Credit nằm trong một ví chung của tổ chức, không tính theo số người dùng.",
} as const;

export const PLANS: Plan[] = [
  {
    name: "Free",
    price: "0đ",
    unit: "/tháng",
    features: ["100 credit mỗi tháng", "Đủ cả ba cách bắt đầu dự án", "Xuất file Word"],
    cta: "Bắt đầu miễn phí",
  },
  {
    name: "Pro",
    price: "199k",
    unit: "/tháng",
    features: ["1.000 credit mỗi tháng", "Mọi thứ trong gói Free", "Nâng gói ngay trong app"],
    cta: "Nâng cấp Pro",
    recommended: true,
  },
];

export const FINAL_CTA = {
  headline: "Dự án tiếp theo của bạn",
  headlineAccent: "bắt đầu từ yêu cầu rõ ràng.",
  cta: "Tạo dự án đầu tiên",
  note: "Miễn phí · Không cần thẻ · Tặng 100 credit",
} as const;
