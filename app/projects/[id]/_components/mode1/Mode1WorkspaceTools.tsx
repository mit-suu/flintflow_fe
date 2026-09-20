"use client";

import Link from "next/link";
import type { StepPlanEntry } from "@/types/import";
import type { StepSummary } from "@/types/pipeline";
import type { Flag } from "@/types/spine";
import { useDocVersions } from "../../hooks/mode1/useDocVersions";
import Mode1PlanPanel from "./Mode1PlanPanel";
import VersionsPanel from "./VersionsPanel";

interface Mode1WorkspaceToolsProps {
  projectId: string;
  projectName?: string;
  plan: StepPlanEntry[] | null;
  planError: string | null;
  busyStep: string | null;
  onToggleStep: (stepId: string, enabled: boolean) => void;
  steps: StepSummary[];
  flags: Flag[];
  signedOff: boolean;
  onSelectStep: (stepId: string) => void;
  getBaseVersion: () => number | null;
  /** Spine đổi ngoài luồng step (ký v1, release) — tải lại Spine/tiến độ/tài liệu. */
  onSpineChanged: () => void;
}

/**
 * Cột công cụ của workspace mode 1 v2 (FLF-185, plan v2 §7): kế hoạch step theo template (thiếu / ẩn / ký v1),
 * gap report + change request, version & release. Tài liệu xem ở `DocumentPane` (render từ Spine theo layout file).
 */
export default function Mode1WorkspaceTools({
  projectId,
  projectName,
  plan,
  planError,
  busyStep,
  onToggleStep,
  steps,
  flags,
  signedOff,
  onSelectStep,
  getBaseVersion,
  onSpineChanged,
}: Mode1WorkspaceToolsProps) {
  const docs = useDocVersions(projectId);
  const link = "px-2.5 py-1 rounded-full text-[11.5px] font-bold bg-white border border-[#ECEAE5] text-[#4B4842] hover:bg-[#FAF9F7]";

  return (
    <div className="flex flex-col gap-5">
      <section className="flex flex-col gap-2">
        <h4 className="text-[12px] font-extrabold text-[#191817]">Kế hoạch step theo template</h4>
        <Mode1PlanPanel
          projectId={projectId}
          plan={plan}
          planError={planError}
          steps={steps}
          flags={flags}
          signedOff={signedOff}
          busyStep={busyStep}
          onToggleStep={onToggleStep}
          onSelectStep={onSelectStep}
          getBaseVersion={getBaseVersion}
          onSignedOff={() => {
            onSpineChanged();
            void docs.reload();
          }}
        />
      </section>

      <nav className="flex flex-wrap gap-1.5" aria-label="Import & change request">
        <Link href={`/projects/${projectId}/gap-report`} className={link}>
          Gap report
        </Link>
        <Link href={`/projects/${projectId}/change-requests`} className={link}>
          Change request
        </Link>
        <Link href={`/projects/${projectId}/import`} className={link}>
          Nhập SRS
        </Link>
      </nav>

      <section className="flex flex-col gap-2">
        {docs.error && <p role="alert" className="text-[12px] text-[#B03030]">{docs.error}</p>}
        <VersionsPanel
          projectId={projectId}
          projectName={projectName}
          versions={docs.versions}
          redOpen={docs.redOpen}
          onReleased={() => {
            void docs.reload();
            onSpineChanged();
          }}
        />
      </section>
    </div>
  );
}
