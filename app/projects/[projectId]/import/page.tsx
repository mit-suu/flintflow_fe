"use client";

import { useParams } from "next/navigation";
import Mode1Shell from "../_components/mode1/Mode1Shell";
import ImportWizard from "../_components/mode1/ImportWizard";
import { useMode1Project } from "../hooks/mode1/useMode1Project";

/** Wizard import SRS có sẵn (mode 1, nút 1.1–1.12). */
export default function ImportPage() {
  const projectId = useParams()?.projectId as string;
  const { project, credits, error, reload } = useMode1Project(projectId);

  return (
    <Mode1Shell projectId={projectId} project={project} credits={credits} active="import" error={error}>
      <div className="flex-1 overflow-y-auto p-6">
        <ImportWizard projectId={projectId} credits={credits} onChanged={() => void reload()} />
      </div>
    </Mode1Shell>
  );
}
