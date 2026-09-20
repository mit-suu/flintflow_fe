import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import AuthGuard from "@/components/AuthGuard";
import AdminSidebar from "./_components/AdminSidebar";

/**
 * Admin **chỉ tiếng Việt** (T25): ghim provider về `vi` để component dùng chung đã dịch (`AuthGuard`…) vẫn
 * hiện tiếng Việt dù cookie `NEXT_LOCALE` là `en`. Trang admin viết chữ thẳng, không đi qua messages.
 *
 * `<html lang>` đi theo cookie (root layout), nên khối admin tự khai `lang="vi"` — trình đọc màn hình và
 * trình duyệt đọc đúng ngôn ngữ. `contents` để thẻ bọc không ảnh hưởng bố cục.
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const messages = await getMessages({ locale: "vi" });

  return (
    <NextIntlClientProvider locale="vi" messages={messages}>
      <div lang="vi" className="contents">
        <AuthGuard requireAdmin={true}>
          <div
            className="flex h-screen overflow-hidden bg-[#F5F3F0]"
            style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
          >
            <AdminSidebar />
            <main className="flex-1 min-w-0 flex flex-col overflow-hidden">{children}</main>
          </div>
        </AuthGuard>
      </div>
    </NextIntlClientProvider>
  );
}
