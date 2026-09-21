"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { applyChanges } from "@/lib/api/spine";
import { getProject } from "@/lib/api/projects";
import { ApiClientError } from "@/lib/api/client";
import { getStepDef, stepLabel } from "@/lib/constants/step-registry";
import type { ApplyResult, Op } from "@/types/pipeline";
import type { WorkingMode } from "@/types/spine";
import type { Project } from "@/types/project";

import Collapse from "@/components/ui/Collapse";
import Icon from "@/components/ui/Icon";
import IconButton from "@/components/ui/IconButton";
import WorkspaceHeader from "./_components/WorkspaceHeader";
import WorkspaceProgressRail from "./_components/WorkspaceProgressRail";
import WorkspaceToolRail, { type WorkspacePanel } from "./_components/WorkspaceToolRail";
import ChatSessionHistory from "./_components/ChatSessionHistory";
import ChatPane from "./_components/ChatPane";
import DocumentPane, { type EmptyHint } from "./_components/DocumentPane";
import VerificationPane from "./_components/VerificationPane";
import ChangePanel, { type ChangeSeed } from "./_components/ChangePanel";
import ExportPanel from "./_components/ExportPanel";
import GateCard from "./_components/GateCard";
import ElicitPanel from "./_components/ElicitPanel";
import StepEventLog from "./_components/StepEventLog";
import ScreenQueuePanel from "./_components/ScreenQueuePanel";
import NamesGlossaryPanel from "./_components/NamesGlossaryPanel";
import BriefSummaryCard from "./_components/BriefSummaryCard";
import AssumptionSweepPanel from "./_components/AssumptionSweepPanel";
import AddendumTriagePanel from "./_components/AddendumTriagePanel";
import CrPrefillCard from "./_components/mode1/CrPrefillCard";
import Mode1WorkspaceTools from "./_components/mode1/Mode1WorkspaceTools";
import { IMPORT_DONE_STATUSES } from "./_components/mode1/labels";
import { useStepPlan } from "./hooks/mode1/useStepPlan";
import { useWorkspace } from "./hooks/useWorkspace";
import { useSpine } from "./hooks/useSpine";
import { useProgress } from "./hooks/useProgress";
import { useStepRunner } from "./hooks/useStepRunner";
import { useFlags } from "./hooks/useFlags";

/** Viền nổi bật của section vừa đổi (DocumentPane) tắt sau một nhịp — khớp chú thích UI. */
const CHANGED_SECTION_HIGHLIGHT_MS = 3000;

const DEFAULT_CHAT_PANE_WIDTH = 480;
const CHAT_WIDTH_KEY = "flintflow_chat_pane_width";

/** Bề rộng panel phải theo loại — dùng giới hạn khi kéo đổi cỡ khung chat. */
const PANEL_WIDTH: Record<WorkspacePanel, number> = { change: 380, verification: 340, tools: 340 };
const TOOL_RAIL_WIDTH = 48;
const PROGRESS_OPEN_KEY = "flintflow_workspace_progress_open";

const readSavedProgressOpen = (): boolean => {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(PROGRESS_OPEN_KEY) === "1";
  } catch {
    return false;
  }
};

const readSavedChatPaneWidth = (): number => {
  if (typeof window === "undefined") return DEFAULT_CHAT_PANE_WIDTH;
  try {
    const parsed = parseInt(localStorage.getItem(CHAT_WIDTH_KEY) ?? "", 10);
    if (!isNaN(parsed) && parsed >= 340 && parsed <= 1000) return parsed;
  } catch {}
  return DEFAULT_CHAT_PANE_WIDTH;
};

const WorkspaceLoading = () => (
  <div className="min-h-screen bg-surface flex items-center justify-center">
    <div className="flex flex-col items-center gap-3">
      <span className="w-8 h-8 rounded-full border-3 border-outline border-t-primary ff-spinner shrink-0" />
      <span className="text-on-surface-muted font-medium text-sm">Đang tải không gian làm việc SRS…</span>
    </div>
  </div>
);

/**
 * Rẽ nhánh theo `project.mode`: mode 2 (`fpt`) ⇒ workspace pipeline. Mode 1 (`import`, upload SRS có sẵn) v2
 * (FLF-185): chưa import xong ⇒ wizard `/import`; import xong ⇒ **cùng workspace** (step theo template người dùng,
 * sửa qua chat tới baseline v1) + công cụ mode 1. Không đọc được project ⇒ workspace mode 2 tự xử lý lỗi/đăng nhập.
 */
export default function WorkspacePage() {
  const projectId = useParams()?.id as string;
  const router = useRouter();
  const [project, setProject] = useState<Pick<Project, "mode" | "import_state"> | null>(null);

  useEffect(() => {
    let cancelled = false;
    getProject(projectId)
      .then((res) => !cancelled && setProject(res.data ?? { mode: "fpt", import_state: null }))
      .catch(() => !cancelled && setProject({ mode: "fpt", import_state: null }));
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const mode1 = project?.mode === "import";
  const importDone = !!project?.import_state && IMPORT_DONE_STATUSES.includes(project.import_state);
  useEffect(() => {
    if (mode1 && !importDone) router.replace(`/projects/${projectId}/import`);
  }, [mode1, importDone, projectId, router]);

  if (project === null || (mode1 && !importDone)) return <WorkspaceLoading />;
  return <FptWorkspace mode1={mode1} />;
}

/** Workspace pipeline — mode 2 (template FPT) và mode 1 v2 sau import (`mode1`: step theo template người dùng). */
function FptWorkspace({ mode1 = false }: { mode1?: boolean }) {
  const params = useParams();
  const projectId = params?.id as string;

  const ws = useWorkspace(projectId);
  const spineState = useSpine(projectId, ws.ready);
  const { progress, steps, reload: reloadProgress } = useProgress(projectId, spineState.version);
  // Nguồn duy nhất cho cờ mở — trước đây `VerificationPane` tự gọi `useFlags` nội bộ và
  // `DocumentPane` không nhận `flags` nên nút "xem tại step" chết; nâng lên đây, truyền xuống cả hai.
  const {
    flags,
    loading: flagsLoading,
    error: flagsError,
    busy: flagsBusy,
    waive: waiveFlagFn,
    recompute: recomputeFlagsFn,
  } = useFlags(projectId, spineState.version);

  // Panel phải: mỗi lúc một (rail icon). Mode 1 mở sẵn kế hoạch step & version.
  const [rightPanel, setRightPanel] = useState<WorkspacePanel | null>(mode1 ? "tools" : null);
  const togglePanel = (panel: WorkspacePanel) => setRightPanel((current) => (current === panel ? null : panel));
  // Panel đang vẽ: giữ panel cuối trong lúc chạy hiệu ứng đóng (rightPanel đã về null)
  const [shownPanel, setShownPanel] = useState<WorkspacePanel | null>(rightPanel);
  if (rightPanel && rightPanel !== shownPanel) setShownPanel(rightPanel);
  const [progressOpen, setProgressOpen] = useState<boolean>(readSavedProgressOpen);
  const toggleProgress = () => {
    const next = !progressOpen;
    setProgressOpen(next);
    try {
      localStorage.setItem(PROGRESS_OPEN_KEY, next ? "1" : "0");
    } catch {}
  };
  // Mở rộng trang: ẩn header + rail tiến độ; thoát bằng nút đầu rail công cụ hoặc Esc
  const [focusMode, setFocusMode] = useState(false);
  useEffect(() => {
    if (!focusMode) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !e.defaultPrevented) setFocusMode(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [focusMode]);
  const [exportOpen, setExportOpen] = useState(false);
  const [changeSeed, setChangeSeed] = useState<ChangeSeed | undefined>(undefined);
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);
  const [savingChange, setSavingChange] = useState(false);

  // ─── version hiện tại cho mọi lượt ghi ─────────────────────────
  // Chỉ tăng: một response GET về trễ không được kéo base_version lùi lại (gây 409 giả)
  const versionRef = useRef<number | null>(null);
  const bumpVersion = useCallback((version: number | null | undefined) => {
    if (version === null || version === undefined) return;
    if (versionRef.current === null || version > versionRef.current) versionRef.current = version;
  }, []);
  useEffect(() => bumpVersion(spineState.version), [bumpVersion, spineState.version]);
  const getBaseVersion = useCallback(() => versionRef.current, []);
  // `latestSeq` cho lịch sử Change panel (20 dòng gần nhất) — lấy từ `max(steps[].last_seq)` của
  // Spine hiện tại, không phải `spine_version` (seq của change và version step là hai trục khác nhau).
  const getLatestSeq = useCallback(() => {
    const currentSpine = spineState.spine;
    if (!currentSpine) return null;
    const seqs = currentSpine.steps.map((s) => s.last_seq).filter((n): n is number => typeof n === "number");
    return seqs.length ? Math.max(...seqs) : null;
  }, [spineState.spine]);

  const handleFlagWaive = useCallback(
    async (flagId: string, reason: string) => {
      await waiveFlagFn(flagId, reason);
      void reloadProgress();
    },
    [waiveFlagFn, reloadProgress]
  );

  const handleFlagRecompute = useCallback(async () => {
    await recomputeFlagsFn();
    void reloadProgress();
  }, [recomputeFlagsFn, reloadProgress]);

  const { reload: reloadSpine, replace: replaceSpine } = spineState;
  const { refreshUser } = ws;
  const [documentRefreshToken, setDocumentRefreshToken] = useState(0);
  const [changedSectionIds, setChangedSectionIds] = useState<Set<string>>(new Set());
  const onSpineChanged = useCallback(
    (spineVersion?: number) => {
      bumpVersion(spineVersion);
      void reloadSpine();
      void reloadProgress();
      refreshUser();
      setDocumentRefreshToken((v) => v + 1);
    },
    [bumpVersion, reloadSpine, reloadProgress, refreshUser]
  );

  const runner = useStepRunner({
    projectId,
    sessionId: ws.activeSession?._id ?? null,
    getBaseVersion,
    onSpineChanged,
    onGateDone: (res) => setSelectedStepId(res.next_step),
  });

  // ─── mode 1 v2: kế hoạch step theo template (thiếu / ẩn / bật) ─────
  const onPlanChanged = useCallback(() => {
    void reloadSpine();
    void reloadProgress();
    setDocumentRefreshToken((v) => v + 1);
  }, [reloadSpine, reloadProgress]);
  const stepPlan = useStepPlan(projectId, mode1, spineState.version, onPlanChanged);
  const missingStepIds = new Set((stepPlan.steps ?? []).filter((p) => p.missing && p.state !== "hidden").map((p) => p.step_id));
  const emptyHintOf = (sectionId: string): EmptyHint | undefined => {
    const owner = (stepPlan.steps ?? []).find(
      (p) => p.state !== "hidden" && p.section_ids.some((id) => id === sectionId || (id === "feature:*" && sectionId.startsWith("feature:")))
    );
    if (!owner || steps?.steps.find((s) => s.id === owner.step_id)?.status === "accepted") return undefined;
    return { stepId: owner.step_id, missing: owner.missing };
  };

  const spine = spineState.spine;
  // Mode 1: baseline v1 = baseline ký (`generated`) hoặc release — baseline `imported` (0.0) không tính
  const signedOff = !!spine?.baselines.some((b) => b.type !== "imported");
  const currentStep = progress?.progress.current_step ?? steps?.current_step ?? spine?.progress.current_step ?? null;
  const currentPhase = progress?.progress.current_phase ?? steps?.current_phase ?? spine?.progress.current_phase ?? null;
  // Giai đoạn hiển thị theo bước đang làm: `current_phase` còn là phase vừa xong khi `current_step` đã sang phase kế
  const shownPhase = steps?.steps.find((s) => s.id === currentStep)?.phase ?? currentPhase;
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
          bumpVersion(res.data.spine_version);
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
    [projectId, bumpVersion, replaceSpine, reloadProgress, reloadSpine]
  );

  const changeWorkingMode = (mode: WorkingMode) =>
    submitOps([{ op: "set", path: "project.working_mode", value: mode, reason: "[C] đổi cách làm việc" }]);

  /** Pha Brief và S-1: ba panel Brief chỉ có nghĩa ở đây (Phases §5). */
  const inBriefPhase = (spine?.progress.current_phase ?? "").startsWith("B-") || spine?.progress.current_phase === "S-1";

  const markPlaceholder = (screenId: string) =>
    submitOps([{ op: "set", path: `screens[id=${screenId}].detail_status`, value: "placeholder", reason: "Để lại màn ở vòng một" }]);

  // ─── ChangePanel áp lô đã có preview (UC 6.8) — Spine mới đã có sẵn, khỏi reloadSpine ────
  const changedSectionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleChangeApplied = useCallback(
    (result: ApplyResult, impactedSectionIds?: string[]) => {
      bumpVersion(result.spine_version);
      replaceSpine(result.spine);
      void reloadProgress();
      setDocumentRefreshToken((v) => v + 1);
      setChangedSectionIds(new Set(impactedSectionIds ?? []));
      // Viền nổi bật "một nhịp" (chú thích DocumentPane) — tắt sau một khoảng, không giữ mãi.
      if (changedSectionTimerRef.current) clearTimeout(changedSectionTimerRef.current);
      changedSectionTimerRef.current = setTimeout(() => setChangedSectionIds(new Set()), CHANGED_SECTION_HIGHLIGHT_MS);
    },
    [bumpVersion, replaceSpine, reloadProgress]
  );
  useEffect(() => () => {
    if (changedSectionTimerRef.current) clearTimeout(changedSectionTimerRef.current);
  }, []);

  // ChatPane: session không pipeline ⇒ ô lệnh sửa mở Change panel và xem trước lệnh ngay
  const forwardInstructionToChangePanel = useCallback((instruction: string) => {
    if (!instruction.trim()) return;
    setChangeSeed({ text: instruction, nonce: Date.now() });
    setRightPanel("change");
  }, []);

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
      const asideWidth = (rightPanel ? PANEL_WIDTH[rightPanel] : 0) + TOOL_RAIL_WIDTH;
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
  }, [isResizing, rightPanel]);

  if (!ws.ready) return <WorkspaceLoading />;

  const gate = runner.state.status === "gate_ready" ? runner.state.gate : null;
  const viewingAccepted = viewedSummary?.status === "accepted" && viewedStep !== runnerStep;

  return (
    <div className="h-screen flex overflow-hidden bg-surface-container-lowest font-sans">
      {/* Rail tiến độ trái — z-30: nút tròn ở mép và tooltip nổi trên pane chat */}
      <Collapse axis="x" open={!focusMode && progressOpen} className="relative z-30">
        <WorkspaceProgressRail
          onHide={toggleProgress}
          currentPhase={shownPhase}
          steps={steps?.steps ?? []}
          progress={progress?.progress ?? null}
          selectedStepId={viewedStep}
          onSelectStep={setSelectedStepId}
          missingStepIds={mode1 ? missingStepIds : undefined}
          readinessPercent={progress?.readiness.accepted_pct}
          workingMode={spine?.project.working_mode ?? null}
          onChangeWorkingMode={(mode) => void changeWorkingMode(mode)}
          busy={runner.state.busy || savingChange}
        />
      </Collapse>

      <div className="flex-1 min-w-0 flex flex-col">
      {/* z-20: menu tài khoản trong header nổi trên dải mờ của các pane bên dưới */}
      <Collapse open={!focusMode} className="relative z-20">
        <WorkspaceHeader
          project={ws.project}
          user={ws.user}
          baselineVersion={spine?.baselines.at(-1)?.version ?? null}
          progressHidden={!progressOpen}
          onShowProgress={toggleProgress}
          onRunCurrentStep={currentStep && runner.state.status === "idle" ? () => void runner.run(currentStep) : undefined}
          busy={runner.state.busy || savingChange}
          onExportClick={() => setExportOpen((v) => !v)}
          onEnterFocus={() => setFocusMode(true)}
          onLogout={ws.logout}
        />
      </Collapse>

      <main
        ref={mainRef}
        className="flex-1 min-h-0 flex overflow-hidden bg-surface-container-lowest"
      >
        <ChatPane
          // Rail tiến độ ẩn (hoặc đang mở rộng trang) ⇒ khung chat sát mép trái màn hình, chỉ bo bên phải
          flushLeft={focusMode || !progressOpen}
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
          headerStart={
            <ChatSessionHistory
              sessions={ws.sessions}
              activeSessionId={ws.activeSession?._id ?? null}
              onSelectSession={ws.selectSession}
              onCreateSession={ws.createSession}
              onDeleteSession={ws.deleteSession}
            />
          }
          streamingMessage={ws.streamingMessage}
          isStreaming={ws.streamingMessage !== null}
          onEditInstruction={forwardInstructionToChangePanel}
          footer={
            runner.state.status === "needs_input" ? (
              <ElicitPanel questions={runner.state.questions} onSubmit={(answers) => void runner.answer(answers)} sending={runner.state.busy} />
            ) : undefined
          }
        >
          {mode1 && ws.crPrefill && <CrPrefillCard projectId={projectId} prefill={ws.crPrefill} onDismiss={ws.dismissCrPrefill} />}
          {viewingAccepted && viewedStep && (
            <div className="bg-success-soft rounded-control p-3 text-[12px] text-success">
              Bước <strong>{viewedStep}</strong> ({getStepDef(viewedStep)?.label_vi}) đã chốt. Muốn đổi nội dung, gửi yêu cầu sửa qua chat.
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
            <div role="alert" className="bg-error-container rounded-control p-3 text-[12px] text-error flex items-center justify-between gap-2">
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
          {/* Chỉ hiện một đoạn ngắn bo tròn ở giữa (không chạy suốt chiều cao, khỏi đâm qua góc bo của khung chat) */}
          <div className={`h-12 w-1 rounded-full transition-colors ${isResizing ? "bg-primary" : "bg-transparent group-hover:bg-primary/60"}`} />
        </div>

        <DocumentPane
          projectId={projectId}
          projectName={ws.project?.name}
          flags={flags}
          changedSectionIds={changedSectionIds}
          onSelectStep={setSelectedStepId}
          refreshToken={documentRefreshToken}
          getBaseVersion={getBaseVersion}
          emptyHintOf={mode1 ? emptyHintOf : undefined}
        />

        <Collapse axis="x" open={rightPanel !== null}>
        {shownPanel === "tools" && spine && (
          <aside className="w-[340px] h-full shrink-0 bg-surface-container-low rounded-l-dialog flex flex-col overflow-hidden" aria-label="Công cụ">
            <div className="ff-fade-below [--ff-fade:var(--color-surface-container-low)] h-12 pl-4 pr-2 bg-surface-container-low flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <Icon name="toolbox" size={16} className="text-primary" />
                <h3 className="font-bold text-[13px] text-on-surface truncate">{mode1 ? "Kế hoạch step & version" : "Công cụ"}</h3>
              </div>
              <IconButton icon="close" size="sm" label="Đóng công cụ" onClick={() => setRightPanel(null)} />
            </div>
            <div className="flex-1 overflow-y-auto ff-scroll p-4 flex flex-col gap-5">
            {mode1 && (
              <Mode1WorkspaceTools
                projectId={projectId}
                projectName={ws.project?.name}
                plan={stepPlan.steps}
                planError={stepPlan.error}
                busyStep={stepPlan.busyStep}
                onToggleStep={(stepId, on) => void stepPlan.toggle(stepId, on)}
                steps={steps?.steps ?? []}
                flags={flags}
                signedOff={signedOff}
                onSelectStep={setSelectedStepId}
                getBaseVersion={getBaseVersion}
                onSpineChanged={() => onSpineChanged()}
              />
            )}
            {inBriefPhase && (
              <>
                <section className="flex flex-col gap-2">
                  <h4 className="text-[12.5px] font-bold text-on-surface">Tóm tắt Brief</h4>
                  <BriefSummaryCard spine={spine} />
                </section>
                <section className="flex flex-col gap-2">
                  <h4 className="text-[12.5px] font-bold text-on-surface">Giả định chờ xác nhận (B-2.1)</h4>
                  <AssumptionSweepPanel spine={spine} onSubmitOps={submitOps} busy={savingChange} />
                </section>
                <section className="flex flex-col gap-2">
                  <h4 className="text-[12.5px] font-bold text-on-surface">Ghi chú Brief (B-2.2)</h4>
                  <AddendumTriagePanel spine={spine} onSubmitOps={submitOps} busy={savingChange} />
                </section>
              </>
            )}
            <section className="flex flex-col gap-2">
              <h4 className="text-[12.5px] font-bold text-on-surface">Tên riêng & thuật ngữ</h4>
              <NamesGlossaryPanel spine={spine} onSubmitOps={submitOps} busy={savingChange} />
            </section>
            <section className="flex flex-col gap-2">
              <h4 className="text-[12.5px] font-bold text-on-surface">Hàng đợi màn (S-5)</h4>
              <ScreenQueuePanel spine={spine} onMarkPlaceholder={(id) => void markPlaceholder(id)} busy={savingChange} />
            </section>
            </div>
          </aside>
        )}

        {shownPanel === "change" && (
          <ChangePanel
            projectId={projectId}
            getBaseVersion={getBaseVersion}
            getLatestSeq={getLatestSeq}
            onApplied={handleChangeApplied}
            onClose={() => {
              setRightPanel(null);
              // Xoá seed khi đóng — mở lại panel sau đó không được tự chạy lại lệnh cũ.
              setChangeSeed(undefined);
            }}
            seed={changeSeed}
          />
        )}

        {shownPanel === "verification" && (
          <VerificationPane
            readiness={progress?.readiness ?? null}
            flags={flags}
            flagsLoading={flagsLoading}
            flagsError={flagsError}
            flagsBusy={flagsBusy}
            onClose={() => setRightPanel(null)}
            onSelectStep={setSelectedStepId}
            onWaive={handleFlagWaive}
            onRecompute={handleFlagRecompute}
          />
        )}
        </Collapse>

        <WorkspaceToolRail
          active={rightPanel}
          onToggle={togglePanel}
          flagsCount={progress?.readiness.red_open ?? 0}
          mode1={mode1}
          onExitFocus={focusMode ? () => setFocusMode(false) : undefined}
        />
      </main>
      </div>

      {exportOpen && (
        <ExportPanel
          projectId={projectId}
          projectName={ws.project?.name}
          onClose={() => setExportOpen(false)}
          onGoToStep={setSelectedStepId}
          getBaseVersion={getBaseVersion}
        />
      )}
    </div>
  );
}
