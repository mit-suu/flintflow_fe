import type { Metadata } from "next";
import { cookies } from "next/headers";
import { getTranslations } from "next-intl/server";
import LocaleSwitcher from "@/components/LocaleSwitcher";
import StatusScreen from "@/components/StatusScreen";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("notFound");
  return { title: t("metaTitle"), robots: { index: false, follow: false } };
}

/**
 * Trang 404 của toàn app (route không tồn tại hoặc nơi gọi `notFound()`), cùng khung với trang lỗi và trang bảo trì.
 * Đã đăng nhập ⇒ link về `/home`; chưa ⇒ về landing. Dấu hiệu "có phiên" giống `proxy.ts` (cookie `userRole` FE tự ghi,
 * hoặc token nếu cùng site) - chỉ để chọn đích link, không phải kiểm quyền.
 */
export default async function NotFound() {
  const [t, jar] = await Promise.all([getTranslations("notFound"), cookies()]);
  const signedIn = Boolean(jar.get("userRole")?.value || jar.get("accessToken")?.value || jar.get("refreshToken")?.value);
  return (
    <StatusScreen
      icon="search"
      eyebrow={t("eyebrow")}
      title={t("title")}
      body={t("body")}
      homeLabel={t("home")}
      homeHref={signedIn ? "/home" : "/"}
      headerEnd={<LocaleSwitcher />}
    />
  );
}
