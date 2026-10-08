"use client";

import Link from "next/link";
import type { Flag } from "@/types/spine";
import { useDocVersions } from "../../hooks/mode1/useDocVersions";
import Mode1FlagsPanel from "./Mode1FlagsPanel";
import { crListHref, gapReportHref } from "./prefill";
import VersionsPanel from "./VersionsPanel";

interface Mode1WorkspaceToolsProps {
  projectId: string;
  projectName?: string;
  flags: Flag[];
  /** Spine đổi ngoài luồng chat (release) — tải lại Spine/cờ/tài liệu. */
  onSpineChanged: () => void;
  /** Viewer: ẩn tạo CR, nhập SRS và release — vẫn xem cờ, CR, version và tải file. */
  readOnly?: boolean;
}

/**
 * Cột công cụ của workspace mode 1 v3 (bám BPMN — plan `mode1-v3/phase-3-fe-mode1.md` 3.1): cờ đỏ + lối tạo CR, gap
 * report + change request, version & release (Flow 6). Không còn kế hoạch step / ký baseline v1 / waive.
 */
export default function Mode1WorkspaceTools({ projectId, projectName, flags, onSpineChanged, readOnly = false }: Mode1WorkspaceToolsProps) {
  const docs = useDocVersions(projectId);
  const link = "px-2.5 py-1 rounded-full text-[11.5px] font-bold bg-white border border-[#ECEAE5] text-[#4B4842] hover:bg-[#FAF9F7]";

  return (
    <div className="flex flex-col gap-5">
      <section className="flex flex-col gap-2">
        <h4 className="text-[12px] font-extrabold text-[#191817]">Cờ & change request</h4>
        <Mode1FlagsPanel projectId={projectId} flags={flags} readOnly={readOnly} />
      </section>

      <nav className="flex flex-wrap gap-1.5" aria-label="Import & change request">
        <Link href={gapReportHref(projectId)} scroll={false} className={link}>
          Gap report
        </Link>
        <Link href={crListHref(projectId)} scroll={false} className={link}>
          Change request
        </Link>
        {!readOnly && (
          <Link href={`/projects/${projectId}/import`} className={link}>
            Nhập SRS
          </Link>
        )}
      </nav>

      <section className="flex flex-col gap-2">
        {docs.error && <p role="alert" className="text-[12px] text-[#B03030]">{docs.error}</p>}
        <VersionsPanel
          projectId={projectId}
          projectName={projectName}
          versions={docs.versions}
          redOpen={docs.redOpen}
          readOnly={readOnly}
          onReleased={() => {
            void docs.reload();
            onSpineChanged();
          }}
        />
      </section>
    </div>
  );
}
