import type { PhaseId } from "@/lib/constants/step-registry";

/*
 * Dữ liệu tĩnh của landing page — chỉ phần **không dịch**: href, id section, tone màu, số liệu. Chữ hiển thị
 * nằm ở `messages/<locale>.json` → `landing.*`; ở đây chỉ giữ key trỏ tới đó.
 * Ngôn ngữ hình ảnh theo dashboard (phẳng, không viền, màu nền pastel, thẻ thư mục, card dự án + thanh 12
 * giai đoạn); nội dung theo business flow (`flintflow/docs/business-flow.md`). Chỉ nói điều sản phẩm đang làm được.
 * Số liệu gói cước khớp `flintflow_be/src/modules/billing/plan.config.ts` — đổi ở BE thì đổi ở đây.
 *
 * Mấy chỗ mỗi mục có bộ key riêng (tag của chế độ, dòng tính năng của gói) ghi **cả đường dẫn key** thay vì
 * ghép chuỗi trong JSX: ghép chuỗi tạo ra tổ hợp key không tồn tại (`items.fpt.tags.gaps`) mà `tsc` bắt được.
 */

export type GroupTone = "blue" | "purple" | "green" | "amber";

export const NAV_LINKS = [
  { href: "#top", key: "home" },
  { href: "#cach-hoat-dong", key: "how" },
  { href: "#che-do", key: "modes" },
  { href: "#bang-gia", key: "pricing" },
] as const;

export const HERO_FACTS = ["modes", "phases", "export"] as const;

/** Card dự án minh hoạ ở hero — cùng hình thức card trên dashboard (tên, trạng thái, việc tiếp theo, thanh giai đoạn). */
export const PREVIEW_PROJECTS = [
  { key: "permit", tone: "ok", phasesDone: 11 },
  { key: "spa", tone: "warn", phasesDone: 3 },
] as const;

export const PREVIEW_FOLDER = { count: 4 } as const;

/* Thẻ nổi ở hero: kết quả kiểm tra 3 tầng (hình thức · nội dung · chất lượng yêu cầu). */
export const CHECK_FLAGS = { red: 0, amber: 2 } as const;

export const CHECK_TIERS = [
  { key: "form", tone: "ok" },
  { key: "content", tone: "ok" },
  { key: "quality", tone: "warn" },
] as const;

/** Bốn bước BA gom 12 giai đoạn thật của step registry (`lib/constants/step-registry.ts`). */
export const PHASE_GROUPS = [
  { key: "clarify", phases: ["B-0", "B-1"], tone: "blue" },
  { key: "analyze", phases: ["B-2", "S-1"], tone: "purple" },
  { key: "specify", phases: ["S-2", "S-3", "S-4", "S-5", "S-6", "S-7", "S-8"], tone: "green" },
  { key: "verify", phases: ["S-9"], tone: "amber" },
] as const satisfies readonly { key: string; phases: readonly PhaseId[]; tone: GroupTone }[];

/** Ba cách bắt đầu dự án; `tone` cùng màu thẻ với bước chọn chế độ khi tạo dự án (`SourceModePicker`). */
export const MODES = [
  {
    key: "fpt",
    tone: "purple",
    tags: ["items.fpt.tags.brief", "items.fpt.tags.phases", "items.fpt.tags.template"],
  },
  {
    key: "client",
    tone: "amber",
    tags: ["items.client.tags.sections", "items.client.tags.inPlace"],
  },
  {
    key: "existing",
    tone: "blue",
    tags: ["items.existing.tags.gaps", "items.existing.tags.track"],
  },
] as const satisfies readonly { key: string; tone: GroupTone; tags: readonly string[] }[];

export const PLANS = [
  {
    id: "free",
    /** Giá theo nghìn đồng mỗi tháng. */
    priceK: 0,
    /** Số credit mỗi tháng — format theo locale trong chính chuỗi `…features.credits`. */
    credits: 100,
    features: ["plans.free.features.credits", "plans.free.features.modes", "plans.free.features.export"],
    recommended: false,
  },
  {
    id: "pro",
    priceK: 199,
    credits: 1000,
    features: ["plans.pro.features.credits", "plans.pro.features.everything", "plans.pro.features.upgrade"],
    recommended: true,
  },
] as const satisfies readonly {
  id: string;
  priceK: number;
  credits: number;
  features: readonly string[];
  recommended: boolean;
}[];

export type Plan = (typeof PLANS)[number];
