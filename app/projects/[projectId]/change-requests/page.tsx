"use client";

import { Suspense } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Mode1Shell from "../_components/mode1/Mode1Shell";
import ChangeRequestList from "../_components/mode1/ChangeRequestList";
import { readCrPrefill } from "../_components/mode1/prefill";
import { useMode1Project } from "../hooks/mode1/useMode1Project";

function ChangeRequestsContent({ projectId }: { projectId: string }) {
  const params = useSearchParams();
  const prefill = params ? readCrPrefill(new URLSearchParams(params.toString())) : null;
  return <ChangeRequestList key={params?.toString() ?? ""} projectId={projectId} prefill={prefill} />;
}

/** Danh sách + tạo change request (mode 1, UC-48, nút 3.1). */
export default function ChangeRequestsPage() {
  const projectId = useParams()?.projectId as string;
  const { project, credits, error } = useMode1Project(projectId);

  return (
    <Mode1Shell projectId={projectId} project={project} credits={credits} active="change-requests" error={error}>
      <div className="flex-1 overflow-y-auto p-6">
        <Suspense fallback={<p className="text-[13px] text-[#8A867E]">Đang tải…</p>}>
          <ChangeRequestsContent projectId={projectId} />
        </Suspense>
      </div>
    </Mode1Shell>
  );
}
