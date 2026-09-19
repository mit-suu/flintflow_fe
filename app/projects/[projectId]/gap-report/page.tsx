"use client";

import { useParams } from "next/navigation";
import Mode1Shell from "../_components/mode1/Mode1Shell";
import GapReportView from "../_components/mode1/GapReportView";
import { useMode1Project } from "../hooks/mode1/useMode1Project";

/** Gap report sau import (mode 1, nút 1.13, UC-23). */
export default function GapReportPage() {
  const projectId = useParams()?.projectId as string;
  const { project, credits, error, reload } = useMode1Project(projectId);

  return (
    <Mode1Shell projectId={projectId} project={project} credits={credits} active="gap-report" error={error}>
      <div className="flex-1 overflow-y-auto p-6">
        <GapReportView projectId={projectId} projectName={project?.name} onChanged={() => void reload()} />
      </div>
    </Mode1Shell>
  );
}
