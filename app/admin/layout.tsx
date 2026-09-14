import AuthGuard from "@/components/AuthGuard";
import AdminSidebar from "./_components/AdminSidebar";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthGuard requireAdmin={true}>
      <div
        className="flex h-screen overflow-hidden bg-[#F5F3F0]"
        style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
      >
        <AdminSidebar />
        <main className="flex-1 min-w-0 flex flex-col overflow-hidden">{children}</main>
      </div>
    </AuthGuard>
  );
}
