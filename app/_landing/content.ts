/*
 * Nội dung tĩnh của landing page. Sửa copy ở đây, không phải trong JSX.
 * Số liệu gói cước khớp `flintflow_be/src/modules/billing/plan.config.ts` — đổi ở BE thì đổi ở đây.
 */

export const NAV_LINKS = [
  { href: "#cach-hoat-dong", label: "Cách hoạt động" },
  { href: "#workspace", label: "Workspace" },
  { href: "#bang-gia", label: "Bảng giá" },
] as const;

export const HERO = {
  eyebrow: "SRS · Verify · Change control",
  headline: "Biến ý tưởng thô thành SRS chuẩn nghiệm thu.",
  headlineMuted: "Không còn mâu thuẫn spec.",
  subline:
    "FlintFlow tự động phát hiện lỗ hổng logic, bắt mâu thuẫn giữa UC và NFR trước khi giao dev, tự cập nhật tài liệu khi khách hàng đổi yêu cầu.",
  primaryCta: "Bắt đầu dùng thử miễn phí",
  secondaryCta: "Xem Workspace mẫu",
  proof: ["Import .docx", "Mẫu FPT hoặc mẫu khách", "Xuất Word · PDF"],
} as const;

export type Plan = {
  name: string;
  tagline: string;
  price: string;
  unit: string;
  specs: { label: string; value: string }[];
  cta: string;
  recommended?: boolean;
};

export const PLANS: Plan[] = [
  {
    name: "Free",
    tagline: "Thử nghiệm cá nhân",
    price: "0đ",
    unit: "/tháng",
    specs: [
      { label: "credit / tháng", value: "100" },
      { label: "luồng", value: "import · tạo mới · CR" },
      { label: "xuất file", value: ".docx · .pdf" },
      { label: "thanh toán", value: "không cần thẻ" },
    ],
    cta: "Bắt đầu miễn phí",
  },
  {
    name: "Pro",
    tagline: "Cho BA / PM chạy dự án thật",
    price: "199k",
    unit: "/tháng",
    specs: [
      { label: "credit / tháng", value: "1.000" },
      { label: "so với Free", value: "10×" },
      { label: "luồng", value: "import · tạo mới · CR" },
      { label: "đổi / huỷ gói", value: "ngay trong app" },
    ],
    cta: "Dùng gói Pro",
    recommended: true,
  },
  {
    name: "Gói Credit",
    tagline: "Mua theo nhu cầu",
    price: "Theo gói",
    unit: "",
    specs: [
      { label: "gói", value: "100 · 500 · 1.500" },
      { label: "áp dụng", value: "mọi gói cước" },
      { label: "ví", value: "chung cả tổ chức" },
      { label: "kích hoạt", value: "ngay khi thanh toán" },
    ],
    cta: "Xem gói credit",
  },
];

export const STANDARDS = ["IEEE 830", "ISO/IEC/IEEE 29148", "Mẫu FPT"] as const;
