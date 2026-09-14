"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { applyChanges } from "@/lib/api/spine";
import { ApiClientError } from "@/lib/api/client";
import { getStepDef, stepLabel } from "@/lib/constants/step-registry";
import type { Op } from "@/types/pipeline";
import type { WorkingMode } from "@/types/spine";

import WorkspaceHeader from "./_components/WorkspaceHeader";
import PhaseNavBar from "./_components/PhaseNavBar";
import PhaseHeader from "./_components/PhaseHeader";
import StepProgressBar from "./_components/StepProgressBar";
import ChatSessionSidebar from "./_components/ChatSessionSidebar";
import ChatPane from "./_components/ChatPane";
import DocumentPane from "./_components/DocumentPane";
import VerificationPane from "./_components/VerificationPane";
import GateCard from "./_components/GateCard";
import ElicitPanel from "./_components/ElicitPanel";
import StepEventLog from "./_components/StepEventLog";
import ScreenQueuePanel from "./_components/ScreenQueuePanel";
import NamesGlossaryPanel from "./_components/NamesGlossaryPanel";
import { useWorkspace } from "./hooks/useWorkspace";
import { useSpine } from "./hooks/useSpine";
import { useProgress } from "./hooks/useProgress";
import { useStepRunner } from "./hooks/useStepRunner";

const DEFAULT_CHAT_PANE_WIDTH = 480;
const CHAT_WIDTH_KEY = "flintflow_chat_pane_width";

const readSavedChatPaneWidth = (): number => {
  if (typeof window === "undefined") return DEFAULT_CHAT_PANE_WIDTH;
  try {
    const parsed = parseInt(localStorage.getItem(CHAT_WIDTH_KEY) ?? "", 10);
    if (!isNaN(parsed) && parsed >= 340 && parsed <= 1000) return parsed;
  } catch {}
  return DEFAULT_CHAT_PANE_WIDTH;
};

export default function WorkspacePage() {
  const params = useParams();
  const projectId = params?.projectId as string;

  const ws = useWorkspace(projectId);
  const spineState = useSpine(projectId, ws.ready);
  const { progress, steps, reload: reloadProgress } = useProgress(projectId, spineState.version);

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [verificationOpen, setVerificationOpen] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);
  const [savingChange, setSavingChange] = useState(false);

  // ─── version hiện tại cho mọi lượt ghi ─────────────────────────
  const versionRef = useRef<number | null>(null);
  useEffect(() => {
    if (spineState.version !== null) versionRef.current = spineState.version;
  }, [spineState.version]);
  const getBaseVersion = useCallback(() => versionRef.current, []);

  const { reload: reloadSpine, replace: replaceSpine } = spineState;
  const { refreshUser } = ws;
  const onSpineChanged = useCallback(
    (spineVersion?: number) => {
      if (spineVersion !== undefined) versionRef.current = spineVersion;
      void reloadSpine();
      void reloadProgress();
      refreshUser();
    },
    [reloadSpine, reloadProgress, refreshUser]
  );

  const runner = useStepRunner({
    projectId,
    sessionId: ws.activeSession?._id ?? null,
    getBaseVersion,
    onSpineChanged,
    onGateDone: (res) => setSelectedStepId(res.next_step),
  });

  const spine = spineState.spine;
  const currentStep = progress?.progress.current_step ?? steps?.current_step ?? spine?.progress.current_step ?? null;
  const currentPhase = progress?.progress.current_phase ?? steps?.current_phase ?? spine?.progress.current_phase ?? null;
  const runnerStep = runner.state.stepId;
  const viewedStep = selectedStepId ?? currentStep;
  const viewedSummary = steps?.steps.find((s) => s.id === viewedStep);

  // ─── ghi op thuần (Panel Tên riêng, [C], placeholder) ──────────
  const submitOps = useCallback(
    async (ops: Op[]) => {
      const baseVersion = versionRef.current;
      if (baseVersion === null) return;
      setSavingChange(true);
      try {
        const res = await applyChanges(projectId, { base_version: baseVersion, ops });
        if (res.data) {
          versionRef.current = res.data.spine_version;
          replaceSpine(res.data.spine);
          void reloadProgress();
        }
      } catch (err) {
        if (err instanceof ApiClientError && err.code === "SPINE_VERSION_CONFLICT") {
          alert("Tài liệu vừa đổi ở phiên khác — đã tải lại, vui lòng thử lại.");
          void reloadSpine();
        } else {
          alert(err instanceof Error ? err.message : "Không lưu được thay đổi");
        }
      } finally {
        setSavingChange(false);
      }
    },
    [projectId, replaceSpine, reloadProgress, reloadSpine]
  );

  const changeWorkingMode = (mode: WorkingMode) =>
    submitOps([{ op: "set", path: "project.working_mode", value: mode, reason: "[C] đổi cách làm việc" }]);

  const markPlaceholder = (screenId: string) =>
    submitOps([{ op: "set", path: `screens[id=${screenId}].detail_status`, value: "placeholder", reason: "Để lại màn ở vòng một" }]);

  // ─── resize chat pane ─────────────────────────────────────────
  const [chatPaneWidth, setChatPaneWidth] = useState<number>(readSavedChatPaneWidth);
  const [isResizing, setIsResizing] = useState(false);
  const mainRef = useRef<HTMLElement>(null);
  const widthRef = useRef(chatPaneWidth);
  useEffect(() => {
    widthRef.current = chatPaneWidth;
  }, [chatPaneWidth]);

  useEffect(() => {
    if (!isResizing) return;
    const onMove = (e: MouseEvent) => {
      const pane = document.getElementById("flintflow-chat-pane");
      if (!pane || !mainRef.current) return;
      const asideWidth = (verificationOpen ? 380 : 0) + (toolsOpen ? 340 : 0) + (sidebarOpen ? 230 : 0);
      const maxAllowed = Math.max(350, mainRef.current.getBoundingClientRect().width - asideWidth - 320);
      setChatPaneWidth(Math.min(Math.max(350, e.clientX - pane.getBoundingClientRect().left), Math.min(1000, maxAllowed)));
    };
    const onUp = () => {
      setIsResizing(false);
      try {
        localStorage.setItem(CHAT_WIDTH_KEY, String(widthRef.current));
      } catch {}
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    return () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing, verificationOpen, toolsOpen, sidebarOpen]);

  if (!ws.ready) {
    return (
      <div className="min-h-screen bg-[#F5F3F0] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <span className="w-8 h-8 rounded-full border-3 border-[#E4E1DC] border-t-[#4F46E5] animate-spin shrink-0" />
          <span className="text-[#8A867E] font-medium text-sm">Đang tải không gian làm việc SRS…</span>
        </div>
      </div>
    );
  }

  const gate = runner.state.status === "gate_ready" ? runner.state.gate : null;
  const viewingAccepted = viewedSummary?.status === "accepted" && viewedStep !== runnerStep;

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-[#F5F3F0] font-sans">
      <WorkspaceHeader project={ws.project} user={ws.user} onExportClick={() => setExportOpen((v) => !v)} onLogout={ws.logout} />

      <PhaseNavBar
        currentPhase={currentPhase}
        steps={steps?.steps ?? []}
        sidebarOpen={sidebarOpen}
        onToggleSidebar={() => setSidebarOpen((v) => !v)}
        onExportClick={() => setExportOpen((v) => !v)}
        exportActive={exportOpen}
        onVerificationClick={() => setVerificationOpen((v) => !v)}
        verificationOpen={verificationOpen}
        verificationFlagsCount={progress?.readiness.red_open ?? 0}
        readinessPercent={progress?.readiness.accepted_pct}
      />

      <PhaseHeader
        currentPhase={currentPhase}
        currentStep={currentStep}
        workingMode={spine?.project.working_mode ?? null}
        onChangeWorkingMode={(mode) => void changeWorkingMode(mode)}
        onRunCurrentStep={currentStep && runner.state.status === "idle" ? () => void runner.run(currentStep) : undefined}
        busy={runner.state.busy || savingChange}
      />

      <StepProgressBar
        steps={steps?.steps ?? []}
        progress={progress?.progress ?? null}
        selectedStepId={viewedStep}
        onSelectStep={setSelectedStepId}
      />

      <main ref={mainRef} className="flex-1 flex overflow-hidden bg-[#F5F3F0]">
        {sidebarOpen && (
          <ChatSessionSidebar
            sessions={ws.sessions}
            activeSessionId={ws.activeSession?._id ?? null}
            onSelectSession={ws.selectSession}
            onCreateSession={ws.createSession}
            onDeleteSession={ws.deleteSession}
          />
        )}

        <ChatPane
          width={chatPaneWidth}
          session={ws.activeSession}
          stepLabel={viewedStep ? `${viewedStep} · ${stepLabel(viewedStep)}` : null}
          inputMessage={ws.inputMessage}
          setInputMessage={ws.setInputMessage}
          onSendMessage={(custom) => void ws.sendMessage(currentStep, custom)}
          sending={ws.sending}
          pendingAttachments={ws.pendingAttachments}
          onSelectAttachment={ws.selectAttachment}
          onRemoveAttachment={ws.removeAttachment}
          streamingMessage={ws.streamingMessage}
          isStreaming={ws.streamingMessage !== null}
          footer={
            runner.state.status === "needs_input" ? (
              <ElicitPanel questions={runner.state.questions} onSubmit={(answers) => void runner.answer(answers)} sending={runner.state.busy} />
            ) : undefined
          }
        >
          {viewingAccepted && viewedStep && (
            <div className="bg-[#E9F7EE] border border-[#BFE6CE] rounded-[14px] p-3 text-[12px] text-[#1F7A45]">
              Bước <strong>{viewedStep}</strong> ({getStepDef(viewedStep)?.label_vi}) đã chốt. Muốn đổi nội dung, gửi yêu cầu sửa qua chat.
            </div>
          )}
          {exportOpen && (
            <div className="bg-white border border-[#DDD9F6] rounded-[14px] p-3 text-[12px] text-[#4B4842]">
              Xuất Word (bản nháp có watermark hoặc bản baseline) sẽ nối ở bước ghép tài liệu S-8.2 — chưa có trong bản này.
            </div>
          )}
          {runnerStep && runner.state.events.length > 0 && <StepEventLog events={runner.state.events} />}
          {gate && runnerStep && (
            <GateCard
              stepId={runnerStep}
              actions={gate.actions}
              regenerateUsed={gate.regenerate_used}
              busy={runner.state.busy}
              onAction={(action, note) => void runner.gate(action, note)}
            />
          )}
          {runner.state.error && (
            <div className="bg-[#FDEDED] border border-[#F2CACA] rounded-[14px] p-3 text-[12px] text-[#B03030] flex items-center justify-between gap-2">
              <span>
                {runner.state.error.code}: {runner.state.error.message}
              </span>
              <button type="button" onClick={runner.reset} className="text-[11.5px] font-bold underline cursor-pointer">
                Đóng
              </button>
            </div>
          )}
        </ChatPane>

        <div
          role="separator"
          aria-orientation="vertical"
          onMouseDown={(e) => {
            e.preventDefault();
            setIsResizing(true);
          }}
          onDoubleClick={() => {
            setChatPaneWidth(DEFAULT_CHAT_PANE_WIDTH);
            try {
              localStorage.setItem(CHAT_WIDTH_KEY, String(DEFAULT_CHAT_PANE_WIDTH));
            } catch {}
          }}
          className="relative w-[10px] -mx-[5px] z-20 cursor-col-resize group shrink-0 select-none flex items-center justify-center"
          title="Kéo để thay đổi kích thước (nháy đúp để về mặc định)"
        >
          <div className={`h-full transition-all ${isResizing ? "w-[3px] bg-[#4F46E5]" : "w-[2px] bg-[#E2DFD9] group-hover:w-[3px] group-hover:bg-[#4F46E5]"}`} />
        </div>

        <DocumentPane projectName={ws.project?.name} spine={spine} sections={progress?.sections} />

        <button
          type="button"
          onClick={() => setToolsOpen((v) => !v)}
          className="self-start m-2 px-2 py-1 rounded-full text-[11px] font-bold bg-white border border-[#ECEAE5] text-[#6B6862] hover:bg-[#FAF9F7] cursor-pointer shrink-0"
          title="Tên riêng, thuật ngữ và hàng đợi màn"
        >
          {toolsOpen ? "›" : "‹ Công cụ"}
        </button>

        {toolsOpen && spine && (
          <aside className="w-[340px] shrink-0 bg-white border-l border-[#ECEAE5] overflow-y-auto p-4 flex flex-col gap-5" aria-label="Công cụ">
            <section className="flex flex-col gap-2">
              <h4 className="text-[12px] font-extrabold text-[#191817]">Tên riêng & thuật ngữ</h4>
              <NamesGlossaryPanel spine={spine} onSubmitOps={submitOps} busy={savingChange} />
            </section>
            <section className="flex flex-col gap-2">
              <h4 className="text-[12px] font-extrabold text-[#191817]">Hàng đợi màn (S-5)</h4>
              <ScreenQueuePanel spine={spine} onMarkPlaceholder={(id) => void markPlaceholder(id)} busy={savingChange} />
            </section>
          </aside>
        )}

        {verificationOpen && <VerificationPane projectId={projectId} onClose={() => setVerificationOpen(false)} />}
      </main>
    </div>
  );
}
