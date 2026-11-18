import { cookies } from "next/headers";
import AuthGuard from "@/components/AuthGuard";
import { SidebarInset, SidebarProvider } from "@/components/shadcn/sidebar";
import { AdminSearchProvider } from "./_components/AdminSearch";
import AdminSidebar from "./_components/AdminSidebar";
import AdminThemeScope from "./_components/AdminThemeScope";

/**
 * Admin song ngữ như mọi khu khác (FLF-328): dùng chung `NextIntlClientProvider` của root layout nên locale
 * theo cookie `NEXT_LOCALE` (`i18n/request.ts`), `<html lang>` cũng do root layout gắn — không tự ghim gì ở đây.
 * Chữ của trang admin nằm ở namespace `admin.*` trong `messages/*.json`.
 *
 * Trạng thái thu/mở sidebar được `SidebarProvider` ghi vào cookie `sidebar_state`; đọc lại ở server để
 * lần tải sau không thấy sidebar nhảy từ mở sang thu.
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const sidebarOpen = cookieStore.get("sidebar_state")?.value !== "false";

  return (
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
  );
}
