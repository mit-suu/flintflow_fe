/*
 * Nội dung tĩnh của landing page. Bố cục theo mock L1 (flintflow-ui-design `_src/screens/02-L1.html`),
 * nội dung theo business flow (`flintflow/docs/business-flow.md`): ba chế độ, bốn bước BA, kiểm tra 3 tầng.
 * Sửa copy ở đây, không phải trong JSX. Chỉ nói điều sản phẩm đang làm được.
 * Số liệu gói cước khớp `flintflow_be/src/modules/billing/plan.config.ts` — đổi ở BE thì đổi ở đây.
 */

export const NAV_LINKS = [
  { href: "#top", label: "Trang chủ" },
  { href: "#cach-hoat-dong", label: "Cách hoạt động" },
  { href: "#bang-gia", label: "Bảng giá" },
] as const;

export const HERO = {
  eyebrow: "✦ AI BUSINESS ANALYST",
  headline: "Hiểu đúng sản phẩm",
  headlineAccent: "trước khi viết code.",
  subline:
    "FlintFlow cùng bạn làm rõ ý tưởng, viết yêu cầu và kiểm tra lại theo cách một BA có kinh nghiệm vẫn làm. Kết quả là bản SRS mà đội dev và công cụ AI lập trình đều dựa vào được.",
  primaryCta: "Bắt đầu miễn phí",
  secondaryCta: "Xem workspace",
  stats: [
    { value: "3", accent: "", label: "cách bắt đầu\nmột dự án" },
    { value: "100", accent: "%", label: "nội dung do\nngười duyệt" },
    { value: ".docx", accent: "", label: "theo đúng mẫu\nbạn đang dùng" },
  ],
} as const;

/* Thẻ nổi ở hero: kết quả kiểm tra 3 tầng (hình thức · nội dung · chất lượng yêu cầu). */
export const CHECK_CARD = {
  title: "KIỂM TRA 3 TẦNG",
  status: "● Sẵn sàng chốt",
  count: "0",
  countLabel: "cờ đỏ · 2 cờ vàng cần xem",
  tiers: [
    { label: "Hình thức ✓", tone: "ok" },
    { label: "Nội dung ✓", tone: "ok" },
    { label: "Chất lượng ⚠", tone: "warn" },
  ],
} as const;

export const STATEMENT = {
  lead: "FlintFlow làm việc như ",
  highlight: "một BA có quy trình",
  middle: ": ",
  gradient: "hỏi cho rõ, phân tích, viết ra, rồi kiểm lại",
  tail: ". AI soạn nháp, bạn là người quyết định.",
} as const;

export const PROCESS = [
  {
    step: "01",
    title: "Làm rõ",
    body: "Bạn kể ý tưởng hoặc tải tài liệu sẵn có lên. FlintFlow chỉ hỏi thêm những gì còn thiếu.",
  },
  {
    step: "02",
    title: "Phân tích",
    body: "Tách sự thật khỏi giả định, chỉ ra mâu thuẫn và chỗ còn trống. ",
    emphasis: "Brief phải được duyệt trước khi viết SRS",
    featured: true,
  },
  {
    step: "03",
    title: "Đặc tả",
    body: "Use case, yêu cầu phi chức năng, sơ đồ Use Case và ERD được soạn lần lượt. Bạn chấp nhận hoặc yêu cầu sửa từng phần.",
  },
  {
    step: "04",
    title: "Kiểm tra",
    body: "Đối chiếu với mẫu, với ISO/IEC/IEEE 29148 và chất lượng từng yêu cầu. Còn cờ đỏ thì chưa chốt được bản.",
  },
] as const;

export const MODES_HEADING = {
  lead: "Bắt đầu từ ",
  accent: "chỗ bạn đang có.",
} as const;

export type Mode = {
  title: string;
  body: string;
  /** Câu hỏi mẫu AI đặt ra (kèm nhóm câu hỏi). */
  quote?: { text: string; tag: string };
  chips?: string[];
  featured?: boolean;
};

export const MODES: Mode[] = [
  {
    title: "Tạo mới theo mẫu FPT",
    body: "Bạn chỉ có ý tưởng và vài ghi chú. FlintFlow dẫn bạn từ Brief đến bản SRS đầy đủ theo mẫu FPT.",
    quote: { text: "“Ai thẩm định hồ sơ: cán bộ quận hay Sở?”", tag: "· actor" },
  },
  {
    title: "Theo mẫu của khách",
    body: "Tải lên file mẫu khách yêu cầu. FlintFlow đọc cấu trúc mẫu, chỉ soạn những section mẫu cần và điền thẳng vào file đó.",
    chips: ["Chỉ section mẫu cần", "Điền vào file gốc"],
    featured: true,
  },
  {
    title: "Sửa SRS có sẵn",
    body: "Nhập file .docx đang dùng để biết nó còn thiếu gì. Khách đổi yêu cầu thì chỗ sửa hiện bằng Track Changes ngay trong file.",
    chips: [".docx", "danh sách gap", "Track Changes"],
  },
];

export const WORKSPACE_HEADING = {
  eyebrow: "BÊN TRONG WORKSPACE",
  headline: "AI đề xuất.",
  headlineAccent: "Bạn quyết định.",
} as const;

export type Plan = {
  name: string;
  price: string;
  unit: string;
  summary: string;
  cta: string;
  recommended?: boolean;
};

export const PLANS: Plan[] = [
  {
    name: "Free",
    price: "0đ",
    unit: "/tháng",
    summary: "100 credit mỗi tháng · Đủ cả ba cách bắt đầu dự án · Xuất file Word",
    cta: "Bắt đầu miễn phí",
  },
  {
    name: "Pro",
    price: "199k",
    unit: "/tháng",
    summary: "1.000 credit mỗi tháng, dùng chung cho cả tổ chức · Mọi thứ trong gói Free · Nâng gói ngay trong app",
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
