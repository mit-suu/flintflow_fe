"use client";

import { useParams } from "next/navigation";
import Mode1Shell from "../../_components/mode1/Mode1Shell";
import CrWorkspace from "../../_components/mode1/CrWorkspace";
import { useMode1Project } from "../../hooks/mode1/useMode1Project";

/** Workspace một change request (mode 1, nút 3.1–3.14). */
export default function ChangeRequestPage() {
  const params = useParams();
  const projectId = params?.projectId as string;
  const crId = decodeURIComponent(params?.crId as string);
  const { project, credits, error, reload } = useMode1Project(projectId);

  return (
    <Mode1Shell projectId={projectId} project={project} credits={credits} active="change-requests" error={error}>
      <div className="flex-1 overflow-y-auto p-6">
        <CrWorkspace projectId={projectId} crId={crId} onChanged={() => void reload()} />
      </div>
    </Mode1Shell>
  );
}
