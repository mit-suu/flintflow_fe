"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import PageSkeleton from "@/components/ui/PageSkeleton";
import { crHref } from "../../_components/mode1/prefill";

/** Chi tiết một change request (mode 1, nút 3.1–3.14) giờ mở trong popup trên màn "Tài liệu & version". */
export default function ChangeRequestPage() {
  const params = useParams();
  const projectId = params?.id as string;
  const crId = decodeURIComponent(params?.crId as string);
  const router = useRouter();
  useEffect(() => router.replace(crHref(projectId, crId)), [projectId, crId, router]);
  return <PageSkeleton rows={2} label="Đang mở change request" />;
}
