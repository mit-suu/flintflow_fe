"use client";

import { Suspense, useEffect } from "react";
import { useTranslations } from "next-intl";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import PageSkeleton from "@/components/ui/PageSkeleton";
import { crListHref } from "../_components/mode1/prefill";

function Redirect({ projectId }: { projectId: string }) {
  const params = useSearchParams();
  const router = useRouter();
  useEffect(() => {
    // Giữ query điền sẵn form (`new=1&title=…`) của link cũ
    const rest = params?.toString();
    router.replace(rest ? `${crListHref(projectId)}&${rest}` : crListHref(projectId));
  }, [params, projectId, router]);
  return null;
}

/** Change request (mode 1, UC-48) giờ là popup trên màn "Tài liệu & version" — giữ đường dẫn cũ, chuyển sang popup. */
export default function ChangeRequestsPage() {
  const t = useTranslations("mode1.crPages");
  const projectId = useParams()?.id as string;
  return (
    <>
      <PageSkeleton variant="list" rows={3} label={t("opening")} />
      <Suspense fallback={null}>
        <Redirect projectId={projectId} />
      </Suspense>
    </>
  );
}
