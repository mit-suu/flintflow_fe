"use client";

import { useRouter } from "next/navigation";
import { clearAuthToken } from "../../lib/auth";

export default function HomePage() {
  const router = useRouter();

  const handleLogout = () => {
    clearAuthToken();
    window.location.href = "/login";
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 text-on-surface bg-surface">
      <h1 className="text-2xl font-bold tracking-tight">homepage</h1>
      <button
        type="button"
        onClick={handleLogout}
        className="px-4 py-2 bg-primary text-on-primary rounded-lg text-sm font-medium hover:brightness-90 transition-all btn-press flex items-center gap-2 shadow-sm"
      >
        <span className="material-symbols-outlined text-lg">logout</span>
        Đăng xuất
      </button>
    </main>
  );
}
