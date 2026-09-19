"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useWorkspace } from "../../hooks/useWorkspace";
import { useDocVersions } from "../../hooks/mode1/useDocVersions";
import { useMode1Project } from "../../hooks/mode1/useMode1Project";
import ChatPane from "../ChatPane";
import CrPrefillCard from "./CrPrefillCard";
import DocBlockView from "./DocBlockView";
import { IMPORT_DONE_STATUSES } from "./labels";
import Mode1Shell from "./Mode1Shell";
import ReuploadDiffView from "./ReuploadDiffView";
import VersionCompare from "./VersionCompare";
import VersionsPanel from "./VersionsPanel";

type CenterView = "document" | "compare" | "reupload";

/**
 * Workspace của project mode 1 (upload SRS có sẵn rồi sửa): chat hỏi đáp | tài liệu theo block của một version |
 * version & release. Chưa import xong ⇒ chuyển sang wizard import. Tài liệu chỉ đọc — sửa qua change request.
 */
export default function Mode1Workspace({ projectId }: { projectId: string }) {
  const router = useRouter();
  const { project, credits, error, reload: reloadProject } = useMode1Project(projectId);
  const ws = useWorkspace(projectId);
  const docs = useDocVersions(projectId);
  const [view, setView] = useState<CenterView>("document");

  const importDone = project?.import_state ? IMPORT_DONE_STATUSES.includes(project.import_state) : false;
  useEffect(() => {
    if (project && !importDone) router.replace(`/projects/${projectId}/import`);
  }, [project, importDone, projectId, router]);

  const lockedCount = (docs.blocks ?? []).filter((b) => b.locked_by_cr).length;

  const tab = (id: CenterView, label: string) => (
    <button
      type="button"
      onClick={() => setView(id)}
      aria-pressed={view === id}
      className={`px-3 py-1 rounded-full text-[12px] font-bold ${view === id ? "bg-[#191817] text-white" : "bg-white border border-[#ECEAE5] text-[#6B6862] hover:bg-[#FAF9F7]"}`}
    >
      {label}
    </button>
  );

  return (
    <Mode1Shell projectId={projectId} project={project} credits={credits} active="document" error={error}>
      {!project || !importDone ? (
        <div className="flex-1 flex items-center justify-center text-[13px] text-[#8A867E]">Đang tải…</div>
      ) : (
        <>
          <ChatPane
            width={400}
            title="Hỏi đáp về tài liệu"
            inputPlaceholder="Hỏi về nội dung tài liệu…"
            session={ws.activeSession}
            inputMessage={ws.inputMessage}
            setInputMessage={ws.setInputMessage}
            onSendMessage={(custom) => void ws.sendMessage(null, custom)}
            sending={ws.sending}
            pendingAttachments={ws.pendingAttachments}
            onSelectAttachment={ws.selectAttachment}
            onRemoveAttachment={ws.removeAttachment}
            streamingMessage={ws.streamingMessage}
            isStreaming={ws.streamingMessage !== null}
            emptyState={
              <div className="my-auto max-w-sm text-center py-8 flex flex-col items-center gap-3 bg-white border border-[#ECEAE5] rounded-[20px] p-6">
                <h3 className="font-extrabold text-[#191817] text-[14px]">Hỏi về tài liệu</h3>
                <p className="text-[#8A867E] text-[12px] leading-relaxed">
                  Hỏi AI về nội dung SRS. Muốn sửa thì tạo change request — chat không sửa trực tiếp tài liệu đã có baseline.
                </p>
              </div>
            }
          >
            {ws.crPrefill && <CrPrefillCard projectId={projectId} prefill={ws.crPrefill} onDismiss={ws.dismissCrPrefill} />}
          </ChatPane>

          <section className="flex-1 min-w-0 flex flex-col border-l border-[#ECEAE5] bg-[#FDFCFB]">
            <div className="flex flex-wrap items-center gap-2 px-5 py-2.5 border-b border-[#ECEAE5] bg-white">
              {tab("document", "Tài liệu")}
              {tab("compare", "So sánh version")}
              {tab("reupload", "Tải lại bản sửa ngoài")}
              {view === "document" && docs.selected && (
                <label className="ml-auto flex items-center gap-1.5 text-[12px] font-semibold text-[#4B4842]">
                  Version
                  <select
                    value={docs.selected}
                    onChange={(e) => docs.select(e.target.value)}
                    className="px-2 py-1 rounded-[8px] border border-[#E4E1DC] bg-white"
                    aria-label="Chọn version"
                  >
                    {docs.versions.map((v) => (
                      <option key={v.version} value={v.version}>
                        {v.version}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </div>
            <div className="flex-1 overflow-y-auto px-8 py-6">
              {docs.error && <p role="alert" className="mb-3 text-[12.5px] text-[#B03030]">{docs.error}</p>}
              {view === "document" &&
                (docs.blocks ? (
                  <>
                    {lockedCount > 0 && (
                      <p className="mb-3 text-[12px] text-[#8A6D1F] bg-[#FBF4E4] border border-[#EFD9A6] rounded-[10px] px-3 py-2">
                        {lockedCount} block đang bị change request khoá để sửa — bấm huy hiệu để mở CR.
                      </p>
                    )}
                    <DocBlockView projectId={projectId} blocks={docs.blocks} />
                  </>
                ) : (
                  <p className="text-[13px] text-[#8A867E]">Đang tải tài liệu…</p>
                ))}
              {view === "compare" && <VersionCompare key={docs.versions.length} projectId={projectId} versions={docs.versions} />}
              {view === "reupload" && <ReuploadDiffView projectId={projectId} />}
            </div>
          </section>

          <aside className="w-[320px] shrink-0 bg-white border-l border-[#ECEAE5] overflow-y-auto p-4" aria-label="Version và release">
            <VersionsPanel
              projectId={projectId}
              projectName={project.name}
              versions={docs.versions}
              redOpen={docs.redOpen}
              selected={docs.selected}
              onSelect={(v) => {
                docs.select(v);
                setView("document");
              }}
              onReleased={() => {
                void docs.showLatest();
                void reloadProject();
              }}
            />
          </aside>
        </>
      )}
    </Mode1Shell>
  );
}
