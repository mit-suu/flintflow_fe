"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import PageSkeleton from "@/components/ui/PageSkeleton";

/**
 * Trang wizard `/import` cũ — màn đọc khung và tiến trình đọc file nay nằm trong layout workspace (`/projects/:id`). Giữ route để
 * link / bookmark cũ vẫn tới đúng chỗ.
 */
export default function ImportRedirectPage() {
  const projectId = useParams()?.id as string;
  const router = useRouter();
  useEffect(() => {
    if (projectId) router.replace(`/projects/${projectId}`);
  }, [projectId, router]);
  return <PageSkeleton variant="workspace" />;
}
