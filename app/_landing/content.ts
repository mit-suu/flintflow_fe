/*
 * Dữ liệu tĩnh của landing page — chỉ phần **không dịch**: href, id, số liệu. Chữ hiển thị nằm ở
 * `messages/<locale>.json` → `landing.*` (T25); ở đây chỉ giữ key trỏ tới đó.
 * Số liệu gói cước khớp `flintflow_be/src/modules/billing/plan.config.ts` — đổi ở BE thì đổi ở đây.
 */

export const NAV_LINKS = [
  { href: "#cach-hoat-dong", key: "how" },
  { href: "#workspace", key: "workspace" },
  { href: "#bang-gia", key: "pricing" },
] as const;

export const HERO_PROOF = ["import", "template", "export"] as const;

type SpecLabel =
  | "credits"
  | "flows"
  | "export"
  | "payment"
  | "vsFree"
  | "planChange"
  | "packs"
  | "appliesTo"
  | "wallet"
  | "activation";

type SpecValueKey = "flows" | "noCard" | "inApp" | "allPlans" | "sharedOrg" | "onPayment";

/**
 * Giá trị một dòng thông số: `key` → chữ dịch (`landing.pricing.values.*`), `numbers` → số format theo
 * locale (`1.000` / `1,000`) nối bằng ` · `, `text` → hiển thị nguyên (tên định dạng, ký hiệu).
 */
export type SpecValue = { key: SpecValueKey } | { numbers: readonly number[] } | { text: string };

export type Plan = {
  id: "free" | "pro" | "credit";
  /** Giá theo nghìn đồng mỗi tháng; `null` = mua theo gói. */
  priceK: number | null;
  specs: { label: SpecLabel; value: SpecValue }[];
  recommended?: boolean;
};

export const PLANS: Plan[] = [
  {
    id: "free",
    priceK: 0,
    specs: [
      { label: "credits", value: { numbers: [100] } },
      { label: "flows", value: { key: "flows" } },
      { label: "export", value: { text: ".docx · .pdf" } },
      { label: "payment", value: { key: "noCard" } },
    ],
  },
  {
    id: "pro",
    priceK: 199,
    specs: [
      { label: "credits", value: { numbers: [1000] } },
      { label: "vsFree", value: { text: "10×" } },
      { label: "flows", value: { key: "flows" } },
      { label: "planChange", value: { key: "inApp" } },
    ],
    recommended: true,
  },
  {
    id: "credit",
    priceK: null,
    specs: [
      { label: "packs", value: { numbers: [100, 500, 1500] } },
      { label: "appliesTo", value: { key: "allPlans" } },
      { label: "wallet", value: { key: "sharedOrg" } },
      { label: "activation", value: { key: "onPayment" } },
    ],
  },
];

/** Tên chuẩn là tên riêng, không dịch. "Mẫu FPT" dịch được nên nằm ở `landing.cta.fptTemplate`. */
export const STANDARDS = ["IEEE 830", "ISO/IEC/IEEE 29148"] as const;
