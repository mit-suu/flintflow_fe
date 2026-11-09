import { cookies } from "next/headers";
import { importPendingCookie } from "@/lib/import-pending";
import { ImportPendingHintProvider } from "./import-pending-hint";

/** Đọc cookie gợi ý skeleton (dự án đang ở màn đọc file SRS) ngay trên server — xem `lib/import-pending.ts`. */
export default async function ProjectLayout({ children, params }: { children: React.ReactNode; params: Promise<{ id: string }> }) {
  const { id } = await params;
  const pending = (await cookies()).get(importPendingCookie(id))?.value === "1";
  return <ImportPendingHintProvider value={pending}>{children}</ImportPendingHintProvider>;
}
