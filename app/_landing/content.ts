/*
 * Nội dung tĩnh của landing page (mock L1 — flintflow-ui-design `_src/screens/02-L1.html`).
 * Sửa copy ở đây, không phải trong JSX.
 * Số liệu gói cước khớp `flintflow_be/src/modules/billing/plan.config.ts` — đổi ở BE thì đổi ở đây.
 */

export const NAV_LINKS = [
  { href: "#top", label: "Trang chủ" },
  { href: "#cach-hoat-dong", label: "Cách hoạt động" },
  { href: "#bang-gia", label: "Bảng giá" },
] as const;

export const HERO = {
  eyebrow: "✦ AI BUSINESS ANALYST",
  headline: "Ideas that",
  headlineAccent: "deeper.",
  subline:
    "FlintFlow phản biện ý tưởng của bạn như một BA thực thụ — đặt câu hỏi đúng, bắt giả định và mâu thuẫn, bàn giao SRS chuẩn IEEE mà dev thật sự dùng được. Trước khi bạn tốn một dòng code.",
  primaryCta: "Bắt đầu miễn phí",
  secondaryCta: "Xem workspace",
  stats: [
    { value: "100", accent: "", label: "credit miễn phí\nmỗi tháng" },
    { value: "< 3s", accent: "", label: "AI bắt đầu\nphản hồi" },
    { value: "100", accent: "%", label: "nội dung do\nbạn duyệt" },
  ],
} as const;

export const STATEMENT = {
  lead: "FlintFlow là một ",
  highlight: "AI Business Analyst full-cycle",
  middle: " — đào sâu vào ý tưởng của bạn và ",
  gradient: "làm việc như một cộng sự",
  tail: ", không phải một cái máy sinh văn bản.",
} as const;

export const PROCESS = [
  {
    step: "01",
    title: "Làm rõ có cấu trúc",
    body: "Hỏi theo nhóm user · pain · scope · metrics — kèm lý do vì sao câu hỏi quan trọng.",
  },
  {
    step: "02",
    title: "Xác minh mọi thứ",
    body: "Fact tách khỏi giả định, mâu thuẫn bị bắt, ",
    emphasis: "“nhanh” phải thành con số",
    featured: true,
  },
  {
    step: "03",
    title: "Không template rác",
    body: "Chỉ những gì business của bạn thật sự cần — không filler, không đoán bừa.",
  },
  {
    step: "04",
    title: "Bàn giao linh hoạt",
    body: "SRS theo mẫu FPT hoặc mẫu của khách, gap report chỉ rõ chỗ thiếu — xuất file Word.",
  },
] as const;

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
    summary: "100 credit/tháng · Import, tạo mới, Change Request · Xuất Word",
    cta: "Bắt đầu miễn phí",
  },
  {
    name: "Pro",
    price: "199k",
    unit: "/tháng",
    summary: "1.000 credit/tháng (10× Free) · Mọi luồng như Free · Đổi / huỷ gói ngay trong app",
    cta: "Nâng cấp Pro",
    recommended: true,
  },
];

export const FINAL_CTA = {
  headline: "Ý tưởng tiếp theo của bạn\nxứng đáng một BA",
  headlineAccent: "không bao giờ ngủ.",
  cta: "Tạo project đầu tiên — miễn phí",
  note: "Không cần thẻ · 100 credit tặng sẵn",
} as const;
