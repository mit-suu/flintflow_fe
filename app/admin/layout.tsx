import { cookies } from "next/headers";
import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import AuthGuard from "@/components/AuthGuard";
import { SidebarInset, SidebarProvider } from "@/components/shadcn/sidebar";
import { AdminSearchProvider } from "./_components/AdminSearch";
import AdminSidebar from "./_components/AdminSidebar";
import AdminThemeScope from "./_components/AdminThemeScope";

/**
 * Admin **chỉ tiếng Việt** (T25): ghim provider về `vi` để component dùng chung đã dịch (`AuthGuard`…) vẫn
 * hiện tiếng Việt dù cookie `NEXT_LOCALE` là `en`. Trang admin viết chữ thẳng, không đi qua messages.
 *
 * `<html lang>` đi theo cookie (root layout), nên khối admin tự khai `lang="vi"` — trình đọc màn hình và
 * trình duyệt đọc đúng ngôn ngữ. `contents` để thẻ bọc không ảnh hưởng bố cục.
 *
 * Trạng thái thu/mở sidebar được `SidebarProvider` ghi vào cookie `sidebar_state`; đọc lại ở server để
 * lần tải sau không thấy sidebar nhảy từ mở sang thu.
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [messages, cookieStore] = await Promise.all([getMessages({ locale: "vi" }), cookies()]);
  const sidebarOpen = cookieStore.get("sidebar_state")?.value !== "false";

  return (
    <NextIntlClientProvider locale="vi" messages={messages}>
      <div lang="vi" className="contents">
        <AuthGuard requireAdmin={true}>
          {/* Bộ màu riêng của khu quản trị — xem `admin-theme` trong `app/globals.css`. */}
          <AdminThemeScope />
          <AdminSearchProvider>
            <SidebarProvider defaultOpen={sidebarOpen}>
              <AdminSidebar />
              {/* Khoá chiều cao bằng màn hình (trừ lề 0,5rem × 2 của kiểu `inset`) để thanh đầu, tiêu đề
                  trang và thanh lọc đứng yên — chỉ vùng nội dung bên trong mới cuộn. */}
              <SidebarInset className="@container/content h-svh min-w-0 overflow-hidden md:h-[calc(100svh-1rem)]">
                {children}
              </SidebarInset>
            </SidebarProvider>
          </AdminSearchProvider>
        </AuthGuard>
      </div>
    </NextIntlClientProvider>
  );
}
