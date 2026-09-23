"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { applyChangesWithRebase, renderDiagram } from "@/lib/api/spine";
import { getProject } from "@/lib/api/projects";
import { ApiClientError } from "@/lib/api/client";
import { errorDetailLine, friendlyError, type ErrorAction } from "@/lib/errors";
import { getStepDef, stepLabel } from "@/lib/constants/step-registry";
import type { ApplyResult, Op } from "@/types/pipeline";
import type { ReviewMode, WorkingMode } from "@/types/spine";
import type { Project } from "@/types/project";
import type { Flag } from "@/types/flags";
import PageSkeleton from "@/components/ui/PageSkeleton";
import Skeleton from "@/components/ui/Skeleton";

import Collapse from "@/components/ui/Collapse";
import Icon from "@/components/ui/Icon";
import IconButton from "@/components/ui/IconButton";
import WorkspaceHeader from "./_components/WorkspaceHeader";
import WorkspaceProgressRail from "./_components/WorkspaceProgressRail";
import WorkspaceToolRail, { type WorkspacePanel } from "./_components/WorkspaceToolRail";
import ChatSessionHistory from "./_components/ChatSessionHistory";
import ChatPane from "./_components/ChatPane";
import DocumentPane from "./_components/DocumentPane";
import VerificationPane from "./_components/VerificationPane";
import ChangePanel, { type ChangeSeed } from "./_components/ChangePanel";
import ExportPanel from "./_components/ExportPanel";
import GateCard, { type AssumptionDecision, type BlockingFlag } from "./_components/GateCard";
import ElicitPanel from "./_components/ElicitPanel";
import StepProgress from "./_components/StepProgress";
import StepIntroCard from "./_components/StepIntroCard";
import JourneyBar from "./_components/JourneyBar";
import DecisionsPanel from "./_components/DecisionsPanel";
import RunPill from "./_components/RunPill";
import { getStepStat, recordStepStat } from "@/lib/step-stats";
import ScreenQueuePanel from "./_components/ScreenQueuePanel";
import NamesGlossaryPanel from "./_components/NamesGlossaryPanel";
import BriefSummaryCard from "./_components/BriefSummaryCard";
import AssumptionSweepPanel from "./_components/AssumptionSweepPanel";
import AddendumTriagePanel from "./_components/AddendumTriagePanel";
import CrPrefillCard from "./_components/mode1/CrPrefillCard";
import Mode1WorkspaceTools from "./_components/mode1/Mode1WorkspaceTools";
import { IMPORT_DONE_STATUSES } from "./_components/mode1/labels";
import { useWorkspace } from "./hooks/useWorkspace";
import { useSpine } from "./hooks/useSpine";
import { useProgress } from "./hooks/useProgress";
import { useStepRunner } from "./hooks/useStepRunner";
import { useFlags } from "./hooks/useFlags";
import { useTurnNotice } from "./hooks/useTurnNotice";

/** Viền nổi bật của section vừa đổi (DocumentPane) tắt sau một nhịp — khớp chú thích UI. */
const CHANGED_SECTION_HIGHLIGHT_MS = 3000;

/** Đơn vị giai đoạn để chạy liền (R2): phase thường; vòng S-5 tính theo từng màn. */
const unitOfStep = (stepId: string, phase: string): string => (stepId.includes("@") ? `${phase}@${stepId.split("@")[1]}` : phase);

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
  <div className="h-screen flex overflow-hidden bg-surface-container-lowest">
    {/* Giữ chỗ rail tiến độ trái — cùng bề rộng/chiều cao hàng với WorkspaceProgressRail */}
    <div aria-hidden className="w-[264px] shrink-0 flex flex-col">
      <div className="h-[58px] shrink-0 pl-5 pr-3 flex items-center">
        <Skeleton className="h-6 w-28" />
      </div>
      <div className="pl-5 pr-3 pb-2">
        <Skeleton className="h-2.5 w-14" />
      </div>
      <div className="flex-1 min-h-0 px-3 flex flex-col gap-1">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="flex items-center gap-2.5 px-2 py-2">
            <Skeleton className="size-5 rounded-full shrink-0" />
            <Skeleton className={`h-3 ${i % 3 === 2 ? "w-2/3" : "w-4/5"}`} />
          </div>
        ))}
      </div>
      <div className="shrink-0 px-4 py-3 flex flex-col gap-2.5">
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-1.5 w-full rounded-full" />
      </div>
    </div>

    <div className="flex-1 min-w-0 flex flex-col">
      {/* Giữ chỗ header breadcrumb */}
      <div aria-hidden className="h-[58px] shrink-0 px-4 flex items-center gap-3">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-3.5 w-40" />
        <div className="ml-auto flex items-center gap-1.5">
          <Skeleton className="h-8 w-24" />
          <Skeleton className="size-8 rounded-full" />
        </div>
      </div>
      <PageSkeleton variant="workspace" bare label="Đang tải không gian làm việc SRS" className="flex-1 min-h-0" />
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

/**
 * Workspace pipeline — mode 2 (template FPT) và mode 1 sau import (`mode1`). Mode 1 v3 (bám BPMN Flow 1 ⇒ 3.1): không
 * chạy step / gate / ký v1 / waive, không ghi Spine thẳng — chỉ xem tài liệu, chat, panel "Sửa tài liệu có xem trước"
 * (⇒ tạo CR), cờ + change request + version & release.
 */
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

  // Panel phải: mỗi lúc một (rail icon). Mode 1 mở sẵn cột cờ & version.
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
  /** Lỗi của lượt ghi op thuần (panel Tên riêng, hàng đợi màn, quyết định giả định) — nói bằng tiếng Việt. */
  const [saveError, setSaveError] = useState<string | null>(null);
  /** Thông báo ngắn sau một việc đã xong ("Đã áp dụng 3 thay đổi") — BUG-27. */
  const [toast, setToast] = useState<string | null>(null);
  /** Lớp 5: thu tiến trình thành một pill ở góc để đi làm việc khác trong lúc AI soạn. */
  const [background, setBackground] = useState(false);

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

  const { reload: reloadSpine, replace: replaceSpine } = spineState;

  const handleFlagRecompute = useCallback(async () => {
    await recomputeFlagsFn();
    // Recompute GHI cờ ⇒ `spine_version` đổi. Không đọc lại thì lần chạy step ngay sau đó gửi phiên bản
    // cũ và ăn 409 — đúng chuỗi thao tác "tính lại cờ rồi chạy lại bước đang bị cờ chỉ tới".
    await reloadSpine();
    void reloadProgress();
  }, [recomputeFlagsFn, reloadProgress, reloadSpine]);

  const { refreshUser } = ws;

  /**
   * BUG-17: cờ `diagram_stale` / `render_error` nay có nút "Vẽ lại" — vẽ đúng hình của cờ đó rồi quét lại
   * để cờ tự đóng. `target_id` của cờ là id sơ đồ; kind và owner lấy từ Spine đang hiển thị.
   */
  const handleRedrawDiagram = useCallback(
    async (flag: Flag) => {
      const diagram = spineState.spine?.diagrams.find((d) => d.id === flag.target_id);
      if (!diagram) {
        setSaveError("Không tìm thấy sơ đồ của cờ này — tải lại trang rồi thử lại.");
        return;
      }
      try {
        await renderDiagram(projectId, diagram.kind, diagram.owner_id);
        await recomputeFlagsFn();
        void reloadSpine();
        void reloadProgress();
        setToast(`Đã vẽ lại sơ đồ ${diagram.id}`);
      } catch (err) {
        const code = err instanceof ApiClientError ? err.code : "UNKNOWN_ERROR";
        setSaveError(friendlyError(code, err instanceof ApiClientError ? err.rawMessage : "").message);
      }
    },
    [projectId, spineState.spine, recomputeFlagsFn, reloadSpine, reloadProgress]
  );

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

  const rememberStat = useCallback((stepId: string | null, payload: { duration_ms?: number; credits_used?: number } | null | undefined) => {
    if (!stepId || payload?.duration_ms === undefined) return;
    recordStepStat(stepId, { duration_ms: payload.duration_ms, credits: payload.credits_used ?? 0 });
  }, []);

  const runner = useStepRunner({
    projectId,
    sessionId: ws.activeSession?._id ?? null,
    getBaseVersion,
    onSpineChanged,
    onGateDone: (res) => setSelectedStepId(res.next_step),
  });

  // Lớp 5: tới lượt user mà tab đang ẩn thì đổi tiêu đề tab (và báo, nếu user đã cho phép)
  useTurnNotice(
    runner.state.status === "needs_input" || runner.state.status === "gate_ready",
    runner.state.status === "needs_input" ? "AI đang chờ bạn trả lời" : "Có nội dung mới chờ bạn duyệt"
  );

  // Thời gian và credit THẬT của bước vừa xong — dùng lại làm ước lượng cho lần sau (03 §6)
  useEffect(() => {
    if (runner.state.status !== "gate_ready") return;
    rememberStat(runner.state.stepId, runner.state.gate?.payload);
  }, [runner.state.status, runner.state.stepId, runner.state.gate, rememberStat]);

  // Reload / mất mạng giữa chừng: dựng lại đúng chỗ đang dở (BUG-07) — không chạy lại, không tốn credit.
  const { restore: restoreRunner } = runner;
  const restoredRef = useRef(false);
  useEffect(() => {
    if (!ws.ready || restoredRef.current) return;
    restoredRef.current = true;
    void restoreRunner();
  }, [ws.ready, restoreRunner]);

  const spine = spineState.spine;
  const currentStep = progress?.progress.current_step ?? steps?.current_step ?? spine?.progress.current_step ?? null;
  const currentPhase = progress?.progress.current_phase ?? steps?.current_phase ?? spine?.progress.current_phase ?? null;
  // Giai đoạn hiển thị theo bước đang làm: `current_phase` còn là phase vừa xong khi `current_step` đã sang phase kế
  const shownPhase = steps?.steps.find((s) => s.id === currentStep)?.phase ?? currentPhase;
  const runnerStep = runner.state.stepId;
  const viewedStep = selectedStepId ?? currentStep;
  const viewedSummary = steps?.steps.find((s) => s.id === viewedStep);

  // ─── ghi op thuần (Panel Tên riêng, [C], placeholder) ──────────
  /**
   * Hàng đợi ghi: mỗi lượt ghi đổi `spine_version`, nên hai lần bấm liên tiếp (xác nhận từng giả định ở
   * bảng cờ, đánh dấu placeholder cho nhiều màn) mà chạy song song thì lượt sau cầm phiên bản cũ và ăn
   * 409. Nối đuôi nhau thì lượt sau luôn thấy phiên bản mới nhất.
   */
  const submitOpsNow = useCallback(
    async (ops: Op[]) => {
      const baseVersion = versionRef.current;
      if (baseVersion === null) return;
      setSavingChange(true);
      try {
        // BUG-06: Spine vừa đổi ở bước khác thì tự đọc lại phiên bản mới và gửi lại một lần
        const { result } = await applyChangesWithRebase(projectId, { base_version: baseVersion, ops });
        bumpVersion(result.spine_version);
        replaceSpine(result.spine);
        void reloadProgress();
      } catch (err) {
        const code = err instanceof ApiClientError ? err.code : "UNKNOWN_ERROR";
        const raw = err instanceof ApiClientError ? err.rawMessage : err instanceof Error ? err.message : "";
        setSaveError(friendlyError(code, raw).message);
        if (code === "SPINE_VERSION_CONFLICT") void reloadSpine();
      } finally {
        setSavingChange(false);
      }
    },
    [projectId, bumpVersion, replaceSpine, reloadProgress, reloadSpine]
  );

  const writeQueueRef = useRef<Promise<unknown>>(Promise.resolve());
  /** Xem chú thích ở `submitOpsNow`: nối đuôi để lượt ghi sau luôn cầm `spine_version` mới nhất. */
  const submitOps = useCallback(
    (ops: Op[]) => {
      const run = writeQueueRef.current.catch(() => undefined).then(() => submitOpsNow(ops));
      writeQueueRef.current = run;
      return run;
    },
    [submitOpsNow]
  );

  const changeWorkingMode = (mode: WorkingMode) =>
    submitOps([{ op: "set", path: "project.working_mode", value: mode, reason: "[C] đổi cách làm việc" }]);

  /** R5: đổi mức độ dừng lại hỏi ý — có hiệu lực ngay ở bước kế tiếp. */
  const changeReviewMode = (mode: ReviewMode) =>
    submitOps([{ op: "set", path: "project.review_mode", value: mode, reason: "[C] đổi cách duyệt" }]);

  /**
   * Giả định mới hiện ngay ở gate với ba nút Đúng / Sửa / Bỏ (BUG-13). `confirmed_at` do đây ghi — model
   * không được phép đặt nó (BE chặn), nên ngày xác nhận luôn là lúc user thật sự bấm.
   */
  const applyAssumptionDecision = useCallback(
    (decision: AssumptionDecision) => {
      const path = `assumptions[id=${decision.id}]`;
      if (decision.kind === "confirm") {
        return submitOps([
          { op: "set", path: `${path}.status`, value: "confirmed", reason: "User xác nhận giả định ở cổng chốt" },
          { op: "set", path: `${path}.confirmed_at`, value: new Date().toISOString() },
        ]);
      }
      if (decision.kind === "reject") {
        return submitOps([{ op: "set", path: `${path}.status`, value: "rejected", reason: "User bác bỏ giả định ở cổng chốt" }]);
      }
      return submitOps([{ op: "set", path: `${path}.statement`, value: decision.statement, reason: "User sửa giả định ở cổng chốt" }]);
    },
    [submitOps]
  );

  /**
   * "Đúng hết": một lô op cho mọi giả định còn treo, rồi tính lại cờ. Xác nhận từng cái là từng lượt ghi
   * và từng lần đổi `spine_version` — với vài chục giả định thì vừa lâu vừa dễ đụng nhau.
   */
  const confirmAllAssumptions = useCallback(
    async (ids: string[]) => {
      const now = new Date().toISOString();
      await submitOps(
        ids.flatMap((id) => [
          { op: "set" as const, path: `assumptions[id=${id}].status`, value: "confirmed", reason: "User xác nhận cả loạt giả định" },
          { op: "set" as const, path: `assumptions[id=${id}].confirmed_at`, value: now },
        ])
      );
      await handleFlagRecompute();
    },
    [submitOps, handleFlagRecompute]
  );

  /** Việc làm được với mỗi loại lỗi (bảng ở `lib/errors.ts`). */
  const handleErrorAction = useCallback(
    async (action: ErrorAction) => {
      const stepId = runner.state.stepId;
      switch (action.kind) {
        case "cancel_and_rerun":
          await runner.cancel();
          if (stepId) await runner.run(stepId);
          return;
        case "retry":
          runner.reset();
          if (stepId) await runner.run(stepId);
          return;
        case "goto_step":
          runner.reset();
          if (action.stepId) setSelectedStepId(action.stepId);
          return;
        case "reload_spine":
          onSpineChanged();
          runner.reset();
          return;
        case "edit_command":
          runner.reset();
          setRightPanel("change");
          return;
        default:
          runner.reset();
      }
    },
    [runner, onSpineChanged]
  );

  /** Pha Brief và S-1: ba panel Brief chỉ có nghĩa ở đây (Phases §5). */
  const inBriefPhase = (spine?.progress.current_phase ?? "").startsWith("B-") || spine?.progress.current_phase === "S-1";

  const markPlaceholder = (screenId: string) =>
    submitOps([{ op: "set", path: `screens[id=${screenId}].detail_status`, value: "placeholder", reason: "Để lại màn ở vòng một" }]);

  // ─── ChangePanel áp lô đã có preview (UC 6.8) — Spine mới đã có sẵn, khỏi reloadSpine ────
  const changedSectionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleChangeApplied = useCallback(
    (result: ApplyResult, impactedSectionIds?: string[]) => {
      // BUG-27: áp xong phải có phản hồi — trước đây panel đóng lặng lẽ, user không biết đã ghi hay chưa
      setToast(result.changes.length > 0 ? `Đã áp dụng ${result.changes.length} thay đổi (v${result.spine_version})` : "Đã xác nhận: nội dung không đổi");
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
  // Chạy được = bước đang xem chưa chốt và không bị bỏ qua. Bước chưa có bản ghi (chưa tới lượt) vẫn cho bấm —
  // BE là nơi quyết `STEP_NOT_RUNNABLE` và nói rõ lý do.
  const runnableStep = viewedStep && viewedSummary?.status !== "accepted" && viewedSummary?.status !== "skipped" ? viewedStep : null;
  const reviewMode: ReviewMode = spine?.project.review_mode ?? "balanced";
  /**
   * BUG-30: panel SRS và bản xuất phải mang TÊN HỆ THỐNG tiếng Anh đã chốt (`system_name`), không phải
   * tên dự án tiếng Việt user gõ lúc tạo. Chưa chốt tên thì mới rơi về tên dự án.
   */
  const documentName = spine?.project.system_name?.trim() || ws.project?.name;
  /**
   * BUG-03: vòng S-5 của màn đang để trống — panel Tiến độ mở lại được, thay vì khoá cứng 5 bước.
   * Chỉ S-5.1 là chỗ vào: chạy nó đưa màn về `in_progress` và các bước còn lại tự tới lượt.
   */
  const reopenableStepIds = new Set([
    ...(spine?.screens ?? []).filter((screen) => screen.detail_status === "placeholder").map((screen) => `S-5.1@${screen.id}`),
    // Section đã cũ: cờ chỉ về step sở hữu, và step đó chạy lại được dù đã chốt (BE cho phép). Không mở
    // đường này thì cờ đỏ chặn baseline chỉ còn nước Waive.
    ...flags
      .filter((f) => !f.resolved_at && !f.waived_by_user && (f.rule_id === "section_stale_at_baseline" || f.rule_id === "section_awaiting_reaccept"))
      .map((f) => f.remediation_step)
  ]);
  const viewedStepSummary = steps?.steps.find((s) => s.id === viewedStep);
  // Bước chưa chạy: hiện thẻ "Bước này sẽ…" thay vì một nút Chạy trơ trọi (Lớp 2)
  const reopenable = viewedStep !== null && reopenableStepIds.has(viewedStep);
  const showIntro =
    // Mode 1 v3: tài liệu vào bằng import, không có bước nào để chạy ⇒ không có thẻ "Bước này sẽ…"
    !mode1 &&
    runner.state.status === "idle" &&
    viewedStepSummary !== undefined &&
    (reopenable || (viewedStepSummary.status !== "accepted" && viewedStep === currentStep));
  // 422 BASELINE_BLOCKED khi Accept ở S-9.5: danh sách cờ đang chặn đi kèm trong `meta.flags` (BUG-01)
  const blockingFlags: BlockingFlag[] | undefined =
    runner.state.error?.code === "BASELINE_BLOCKED" && Array.isArray(runner.state.error.meta?.flags)
      ? (runner.state.error.meta.flags as BlockingFlag[])
      : undefined;
  const viewingAccepted = viewedSummary?.status === "accepted" && viewedStep !== runnerStep && !reopenable;

  return (
    <div className="h-screen flex overflow-hidden bg-surface-container-lowest font-sans">
      {/* Rail tiến độ trái — z-30: nút tròn ở mép và tooltip nổi trên pane chat */}
      {/* Mode 1 v3: không có step ⇒ không có rail tiến độ */}
      <Collapse axis="x" open={!mode1 && !focusMode && progressOpen} className="relative z-30">
        <WorkspaceProgressRail
          onHide={toggleProgress}
          currentPhase={shownPhase}
          steps={steps?.steps ?? []}
          progress={progress?.progress ?? null}
          selectedStepId={viewedStep}
          onSelectStep={setSelectedStepId}
          reopenableStepIds={reopenableStepIds}
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
          progressHidden={!mode1 && !progressOpen}
          onShowProgress={toggleProgress}
          // Nút chạy **bước đang xem** (L9): trước đây luôn chạy `current_step` nên quay về bước cũ rồi bấm lại ra bản
          // accept của bước sau (gặp thật 2026-09-20). Bước đã chốt / bị bỏ qua thì không chạy được — nút biến mất.
          runnableStep={mode1 ? null : runnableStep}
          currentStep={mode1 ? null : currentStep}
          onRunCurrentStep={!mode1 && runnableStep && runner.state.status === "idle" ? () => void runner.run(runnableStep) : undefined}
          onBackToCurrent={!mode1 && viewedStep !== currentStep ? () => setSelectedStepId(null) : undefined}
          stepRunningElsewhere={steps?.steps.some((s) => s.id === runnableStep && s.running) ?? false}
          busy={runner.state.busy || savingChange}
          onExportClick={() => setExportOpen((v) => !v)}
          onEnterFocus={() => setFocusMode(true)}
          onLogout={ws.logout}
        />
      </Collapse>

      <Collapse open={!focusMode}>
        <JourneyBar
          steps={steps?.steps ?? []}
          currentStepId={currentStep}
          readinessPercent={progress?.readiness.accepted_pct}
          credits={ws.user?.balance ?? null}
          reviewMode={reviewMode}
          onSelectPhase={(phase) => {
            const firstOfPhase = (steps?.steps ?? []).find((s) => s.phase === phase);
            if (firstOfPhase) setSelectedStepId(firstOfPhase.id);
          }}
        />
      </Collapse>

      <main
        ref={mainRef}
        className="flex-1 min-h-0 flex overflow-hidden bg-surface-container-lowest"
      >
        <ChatPane
          // Rail tiến độ ẩn (hoặc đang mở rộng trang) ⇒ khung chat sát mép trái màn hình, chỉ bo bên phải
          flushLeft={mode1 || focusMode || !progressOpen}
          title={mode1 ? "Hỏi đáp & lệnh sửa" : undefined}
          width={chatPaneWidth}
          session={ws.activeSession}
          stepLabel={!mode1 && viewedStep ? `${viewedStep} · ${stepLabel(viewedStep)}` : null}
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
            !mode1 && runner.state.status === "needs_input" ? (
              <ElicitPanel questions={runner.state.questions} onSubmit={(answers) => void runner.answer(answers)} sending={runner.state.busy} />
            ) : undefined
          }
        >
          {mode1 && ws.crPrefill && <CrPrefillCard projectId={projectId} prefill={ws.crPrefill} onDismiss={ws.dismissCrPrefill} />}
          {!mode1 && viewingAccepted && viewedStep && (
            <div className="bg-success-soft rounded-control p-3 text-[12px] text-success">
              Bước <strong>{viewedStep}</strong> ({getStepDef(viewedStep)?.label_vi}) đã chốt. Muốn đổi nội dung, gửi yêu cầu sửa qua chat.
            </div>
          )}
          {showIntro && viewedStepSummary && (
            <StepIntroCard
              step={viewedStepSummary}
              lastRun={getStepStat(viewedStepSummary.id)}
              busy={runner.state.busy || savingChange}
              onRun={() => void runner.run(viewedStepSummary.id)}
              {...(reviewMode === "strict" || reopenable
                ? {}
                : { onRunPhase: () => void runner.runWholePhase(unitOfStep(viewedStepSummary.id, viewedStepSummary.phase)) })}
            />
          )}
          {runnerStep && !background && (
            <StepProgress state={runner.state} onCancel={() => void runner.cancel()} onBackground={() => setBackground(true)} />
          )}
          {runner.state.autoAccepted.length > 0 && (
            <ul className="flex flex-col gap-0.5" aria-label="Bước đã tự hoàn tất">
              {runner.state.autoAccepted.map((item) => (
                <li key={item.step_id} className="text-[11.5px] text-on-surface-muted">
                  ✓ {item.step_id} tự hoàn tất: {item.reason_vi}
                </li>
              ))}
            </ul>
          )}
          {gate && runnerStep && (
            <GateCard
              {...(runner.state.phaseGate
                ? { phaseLabel: `Giai đoạn ${runner.state.phaseGate.phase} · ${runner.state.phaseGate.reason_vi}`, phaseSummary: runner.state.phaseGate.summary }
                : {})}
              stepId={runnerStep}
              actions={gate.actions}
              regenerateUsed={gate.regenerate_used}
              busy={runner.state.busy}
              payload={gate.payload}
              blockingFlags={blockingFlags}
              onAssumptionDecision={(decision) => void applyAssumptionDecision(decision)}
              onGoToStep={setSelectedStepId}
              wroteOps={gate.wroteOps}
              emptySections={gate.emptySections}
              onAction={(action, note) => void runner.gate(action, note)}
            />
          )}
          {saveError && (
            <div role="alert" className="bg-error-container rounded-control p-3 text-[12px] text-error flex items-center justify-between gap-2">
              <span>{saveError}</span>
              <button type="button" onClick={() => setSaveError(null)} className="text-[11.5px] font-bold underline cursor-pointer">
                Đóng
              </button>
            </div>
          )}
          {runner.state.error && (
            // BUG-25: lỗi nói bằng tiếng Việt kèm việc làm được; mã kỹ thuật nằm trong "Chi tiết"
            <div role="alert" className="bg-error-container rounded-control p-3 text-[12px] text-error flex flex-col gap-2">
              <span>{friendlyError(runner.state.error.code, runner.state.error.message).message}</span>
              <div className="flex flex-wrap items-center gap-2">
                {friendlyError(runner.state.error.code, runner.state.error.message).actions.map((action) => (
                  <button
                    key={action.kind}
                    type="button"
                    onClick={() => void handleErrorAction(action)}
                    className="px-2.5 py-1 rounded-full text-[11.5px] font-bold bg-error text-on-error cursor-pointer"
                  >
                    {action.label}
                  </button>
                ))}
                <button type="button" onClick={runner.reset} className="text-[11.5px] font-bold underline cursor-pointer">
                  Đóng
                </button>
              </div>
              <details className="text-[11px] opacity-80">
                <summary className="cursor-pointer">Chi tiết</summary>
                {errorDetailLine(runner.state.error.code, runner.state.error.message)}
              </details>
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
          projectName={documentName}
          flags={flags}
          changedSectionIds={changedSectionIds}
          // Mode 1 v3: không có step ⇒ không có nút "xem tại step", mục trống mời tạo CR
          onSelectStep={mode1 ? undefined : setSelectedStepId}
          refreshToken={documentRefreshToken}
          getBaseVersion={getBaseVersion}
          mode1={mode1}
        />

        <Collapse axis="x" open={rightPanel !== null}>
        {shownPanel === "tools" && spine && (
          <aside className="w-[340px] h-full shrink-0 bg-surface-container-low rounded-l-dialog flex flex-col overflow-hidden" aria-label="Công cụ">
            <div className="ff-fade-below [--ff-fade:var(--color-surface-container-low)] h-12 pl-4 pr-2 bg-surface-container-low flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <Icon name="toolbox" size={16} className="text-primary" />
                <h3 className="font-bold text-[13px] text-on-surface truncate">{mode1 ? "Cờ, change request & version" : "Công cụ"}</h3>
              </div>
              <IconButton icon="close" size="sm" label="Đóng công cụ" onClick={() => setRightPanel(null)} />
            </div>
            <div className="flex-1 overflow-y-auto ff-scroll p-4 flex flex-col gap-5">
            {mode1 && (
              <Mode1WorkspaceTools projectId={projectId} projectName={ws.project?.name} flags={flags} onSpineChanged={() => onSpineChanged()} />
            )}
            {/* Các panel dưới ghi Spine thẳng (`/changes`) — mode 1 v3 mọi sửa qua CR nên không hiện */}
            {!mode1 && inBriefPhase && (
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
            {!mode1 && (
              <>
                <section className="flex flex-col gap-2">
                  <h4 className="text-[12.5px] font-bold text-on-surface">Tên riêng & thuật ngữ</h4>
                  <NamesGlossaryPanel spine={spine} onSubmitOps={submitOps} busy={savingChange} />
                </section>
                <section className="flex flex-col gap-2">
                  <h4 className="text-[12.5px] font-bold text-on-surface">Đã chốt</h4>
                  <DecisionsPanel spine={spine} onSubmitOps={submitOps} busy={savingChange} />
                </section>
                <section className="flex flex-col gap-2">
                  <h4 className="text-[12.5px] font-bold text-on-surface">Cách duyệt</h4>
                  <div className="flex flex-wrap gap-1.5" role="group" aria-label="Cách duyệt">
                    {(
                      [
                        ["strict", "Chặt", "Dừng ở mọi bước"],
                        ["balanced", "Cân bằng", "Dừng cuối giai đoạn, cuối mỗi màn và ở bước quan trọng"],
                        ["fast", "Nhanh", "Chỉ dừng khi bắt buộc, có cờ đỏ mới hoặc lỗi"],
                      ] as const
                    ).map(([mode, label, hint]) => (
                      <button
                        key={mode}
                        type="button"
                        title={hint}
                        disabled={savingChange}
                        aria-pressed={reviewMode === mode}
                        onClick={() => void changeReviewMode(mode)}
                        className={`px-2.5 py-1 rounded-full text-[11.5px] font-bold cursor-pointer disabled:opacity-50 ${
                          reviewMode === mode ? "bg-primary text-on-primary" : "border border-outline text-on-surface hover:bg-surface-container"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </section>
                <section className="flex flex-col gap-2">
                  <h4 className="text-[12.5px] font-bold text-on-surface">Hàng đợi màn (S-5)</h4>
                  <ScreenQueuePanel spine={spine} onMarkPlaceholder={(id) => void markPlaceholder(id)} busy={savingChange} />
                </section>
              </>
            )}
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
            requiresCr={mode1}
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
            onWaive={mode1 ? undefined : handleFlagWaive}
            onRedraw={handleRedrawDiagram}
            onAssumptionDecision={(decision) => void applyAssumptionDecision(decision)}
            onConfirmAllAssumptions={(ids) => void confirmAllAssumptions(ids)}
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

      {background && runnerStep && (
        <RunPill state={runner.state} onOpen={() => setBackground(false)} onCancel={() => void runner.cancel()} />
      )}

      {toast && (
        <div
          role="status"
          className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 bg-[#191817] text-white text-[12px] font-semibold px-4 py-2 rounded-full shadow-[0_10px_30px_rgba(0,0,0,0.25)] flex items-center gap-3"
        >
          <span>{toast}</span>
          <button type="button" onClick={() => setToast(null)} className="text-[11px] underline cursor-pointer">
            Đóng
          </button>
        </div>
      )}

      {exportOpen && (
        <ExportPanel
          projectId={projectId}
          projectName={documentName}
          flags={flags}
          onClose={() => setExportOpen(false)}
          onGoToStep={setSelectedStepId}
          getBaseVersion={getBaseVersion}
        />
      )}
    </div>
  );
}
