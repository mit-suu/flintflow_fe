"use client";

import AuthGuard from "@/components/AuthGuard";

/**
 * Access token chỉ nằm trong bộ nhớ ⇒ tải lại trang là phải refresh trước khi đọc claim (org, vai trò):
 * workspace và trang đọc tài liệu cần `orgId` ngay lúc mount để nhận ra Viewer.
 */
export default function ProjectsLayout({ children }: { children: React.ReactNode }) {
  return <AuthGuard>{children}</AuthGuard>;
}
