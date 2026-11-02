import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import StatusScreen from "@/components/StatusScreen";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("maintenance");
  // Trang tạm thời — không cho máy tìm kiếm lập chỉ mục
  return { title: t("metaTitle"), robots: { index: false, follow: false } };
}

/**
 * Trang bảo trì tĩnh — mở được không cần đăng nhập (`proxy.ts` chỉ gác `/home`, `/projects`, `/admin`). BE chưa có
 * tín hiệu bảo trì nên **không** tự chuyển hướng về đây; vận hành trỏ người dùng tới `/maintenance` khi cần.
 */
export default function MaintenancePage() {
  const t = useTranslations("maintenance");
  return <StatusScreen icon="cloud-off" eyebrow={t("eyebrow")} title={t("title")} body={t("body")} homeLabel={t("home")} />;
}
