"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import PageSkeleton from "@/components/ui/PageSkeleton";
import { gapReportHref } from "../_components/mode1/prefill";

/** Gap report (mode 1, nút 1.13) giờ là popup trên màn "Tài liệu & version" — giữ đường dẫn cũ, chuyển sang popup. */
export default function GapReportPage() {
  const projectId = useParams()?.id as string;
  const router = useRouter();
  useEffect(() => router.replace(gapReportHref(projectId)), [projectId, router]);
  return <PageSkeleton rows={2} label="Đang mở gap report" />;
}
