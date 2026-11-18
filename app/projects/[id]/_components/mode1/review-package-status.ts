import type { useTranslations } from "next-intl";
import type { BadgeTone } from "@/components/ui/Badge";
import type { ReviewPackage } from "@/types/doc-version";

type ReviewPackageTranslator = ReturnType<typeof useTranslations<"mode1.reviewPackage">>;

/**
 * Pill trạng thái gói thay đổi ở thanh đầu tài liệu (mode 1): đọc thẳng `status` + số CR BE trả, không tự suy. Đang soạn mà
 * chưa có CR nào ⇒ không có pill (không có gì để báo).
 */
export const packageStatusView = (pkg: ReviewPackage | null, t: ReviewPackageTranslator): { label: string; tone: BadgeTone } | null => {
  if (!pkg) return null;
  if (pkg.status === "pending") return { label: t("status.pending"), tone: "primary" };
  if (pkg.status === "changes_requested") return { label: t("status.changes_requested"), tone: "danger" };
  const count = pkg.change_requests.length;
  return count > 0 ? { label: t("unsentPill", { count }), tone: "primary" } : null;
};
