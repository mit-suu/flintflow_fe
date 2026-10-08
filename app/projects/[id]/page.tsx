"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { applyChangesWithRebase, editAssumption, renderDiagram } from "@/lib/api/spine";
import { getProject } from "@/lib/api/projects";
import { ApiClientError } from "@/lib/api/client";
import { friendlyError, type ErrorAction } from "@/lib/errors";
import { workspaceStepLabel as stepLabel } from "./_components/phase-labels";
import { ACCEPT_USER_TEXT, REGENERATE_USER_TEXT } from "./_components/user-text";
import type { ApplyResult, GateAction, Op, RunIntent, StepAnswer } from "@/types/pipeline";
import { isGateApproval } from "@/lib/gate-approval";
import type { Diagram, ReviewMode } from "@/types/spine";
import type { Project } from "@/types/project";
import type { Flag } from "@/types/flags";
import PageSkeleton, { type WorkspacePane } from "@/components/ui/PageSkeleton";
import Skeleton from "@/components/ui/Skeleton";

import Collapse from "@/components/ui/Collapse";
import Icon from "@/components/ui/Icon";
import IconButton from "@/components/ui/IconButton";
import WorkspaceHeader from "./_components/WorkspaceHeader";
import WorkspaceProgressRail from "./_components/WorkspaceProgressRail";
import ChatSessionHistory from "./_components/ChatSessionHistory";
import ChatPane from "./_components/ChatPane";
import ResizeHandle from "./_components/ResizeHandle";
import DocumentPane, { sectionLabel } from "./_components/DocumentPane";
import type { RenderedSection } from "@/types/document";
import VerificationPane from "./_components/VerificationPane";
import BriefPanel, { briefHasData } from "./_components/BriefPanel";
import ChatEditCard, { type AppliedEdit } from "./_components/ChatEditCard";
import DiffPreviewModal from "./_components/DiffPreviewModal";
import CreateCrPreviewModal from "./_components/mode1/CreateCrPreviewModal";
import ProjectRecordPanel from "./_components/ProjectRecordPanel";
import { pendingRecordCount } from "./_components/project-record-pending";
import AiSettingsMenu from "./_components/AiSettingsMenu";
import ExportPanel from "./_components/ExportPanel";
import GateCard, { PICKABLE_FIELDS, unsettledAssumptions, type AssumptionDecision, type BlockingFlag, type GateNewFlag } from "./_components/GateCard";
import { formFactorList } from "./_components/brief-labels";
import ElicitPanel, { splitQuestions } from "./_components/ElicitPanel";
import { replyContainsQuestion } from "@/lib/question-options";
import ChatBubble from "./_components/ChatBubble";
import StepProgress from "./_components/StepProgress";
import ChatOpening from "./_components/ChatOpening";
import RunPill from "./_components/RunPill";
import { recordStepStat } from "@/lib/step-stats";
import CrPrefillCard from "./_components/mode1/CrPrefillCard";
import Mode1CrThread from "./_components/mode1/Mode1CrThread";
import { useCrChat } from "./hooks/mode1/useCrChat";
import Mode1WorkspaceTools from "./_components/mode1/Mode1WorkspaceTools";
import Mode1Popup from "./_components/mode1/Mode1Popup";
import { crListHref, gapReportHref } from "./_components/mode1/prefill";
import { IMPORT_DONE_STATUSES } from "./_components/mode1/labels";
import { useWorkspace } from "./hooks/useWorkspace";
import { useResizableWidth } from "./hooks/useResizableWidth";
import { useChanges } from "./hooks/useChanges";
import { issueCounts, readableMessage } from "./_components/flag-rules";
import { isFlagWaivable } from "@/types/flags";
import { useSpine } from "./hooks/useSpine";
import { useProgress } from "./hooks/useProgress";
import { useFollowRunningElsewhere } from "./hooks/useFollowRunningElsewhere";
import { unitOfStep, useStepRunner } from "./hooks/useStepRunner";
import { useFlags } from "./hooks/useFlags";
import { useTurnNotice } from "./hooks/useTurnNotice";

/** Bề rộng cửa sổ — để biết có đủ chỗ cho rail tiến độ + chat + tài liệu + panel phải cùng lúc không. */
const subscribeViewport = (onChange: () => void) => {
  window.addEventListener("resize", onChange);
  return () => window.removeEventListener("resize", onChange);
};
const viewportWidth = () => window.innerWidth;

/** Viền nổi bật của section vừa đổi (DocumentPane) tắt sau một nhịp — khớp chú thích UI. */
const CHANGED_SECTION_HIGHLIGHT_MS = 3000;
/** Nút "Vẽ lại sơ đồ" dưới hình của mỗi mục trong DocumentPane — tạm ẩn; đổi thành `true` để hiện lại. */
const REDRAW_SECTION_ENABLED = false;
/** Tin AI của lượt hỏi trong lịch sử là `{reply, questions}` (BE ghi kèm câu hỏi) hoặc chữ thường — lấy phần lời đáp. */
/** Cổng chốt nêu tối đa chừng này cờ mới — nhiều hơn thì user xem tiếp ở panel Kiểm tra. */
const MAX_GATE_FLAGS = 3;
/** Thao tác ở cổng duyệt như một lượt của user trong lịch sử — cùng câu chữ BE ghi transcript. */
const GATE_ACTION_TEXT: Record<GateAction, (note?: string) => string> = {
  accept: () => ACCEPT_USER_TEXT,
  regenerate: () => REGENERATE_USER_TEXT,
  revision: (note) => (note ?? "").trim() || "Tôi muốn sửa",
  accept_as_is: (note) => `Duyệt như hiện tại: ${note ?? ""}`.trim(),
};

const replyOfAsk = (content: string): string => {
  try {
    const data: unknown = JSON.parse(content);
    if (data && typeof data === "object" && typeof (data as { reply?: unknown }).reply === "string") return (data as { reply: string }).reply;
  } catch {
    // chữ thường
  }
  return content;
};
/** Cổng chốt trên màn hình đã cũ (BE đưa bước về chờ chạy sau reload/resume) — chữ user đã trả về ô chat. */

// Bề rộng kéo được (px): khung chat, rail tiến độ trái, panel phải — mỗi khung nhớ riêng trong localStorage
const CHAT_WIDTH_KEY = "flintflow_chat_pane_width";
const RAIL_WIDTH_KEY = "flintflow_progress_rail_width";
const PANEL_WIDTH_KEY = "flintflow_right_panel_width";
const BRIEF_WIDTH_KEY = "flintflow_brief_panel_width";
const CHAT_MIN = 320;
const DOC_MIN = 320;
/** Panel phải — mỗi lúc chỉ mở một; mở từ chip trạng thái của tài liệu hoặc nút "Công cụ" trên header. */
type WorkspacePanel = "verification" | "tools";
const PROGRESS_OPEN_KEY = "flintflow_workspace_progress_open";

/** Mặc định mở: lần đầu vào workspace phải thấy ngay mình đang ở bước nào, rail ẩn chỉ khi user tự đóng. */
const readSavedProgressOpen = (): boolean => {
  if (typeof window === "undefined") return true;
  try {
    return localStorage.getItem(PROGRESS_OPEN_KEY) !== "0";
  } catch {
    return true;
  }
};



/**
 * Khung phải lần trước của dự án — để skeleton lúc vào giữ đúng bố cục sắp hiện (chỉ khung chat ở dự án mới, chat +
 * Brief khi Brief đã có dữ liệu, chat + tài liệu khi đã sang SRS). Chưa từng mở ⇒ `none`: dự án mới bắt đầu ở B-0.1.
 */
const workspacePaneKey = (projectId: string) => `ff:workspace-pane:${projectId}`;
const readWorkspacePane = (projectId: string): WorkspacePane => {
  if (typeof window === "undefined" || !projectId) return "none";
  try {
    const value = localStorage.getItem(workspacePaneKey(projectId));
    return value === "brief" || value === "document" ? value : "none";
  } catch {
    return "none";
  }
};

// localStorage không phát sự kiện trong cùng tab — chỉ cần đọc lại sau hydrate, không cần đăng ký
const subscribeNothing = () => () => {};

const WorkspaceLoading = ({ projectId }: { projectId: string }) => {
  // Server snapshot `none` ⇒ lần render hydrate khớp HTML server; ngay sau đó client đọc khung phải đã lưu
  const workspacePane = useSyncExternalStore(subscribeNothing, () => readWorkspacePane(projectId), () => "none" as const);
  return (
  <div className="h-screen flex overflow-hidden bg-surface-container-lowest">
    {/* Giữ chỗ rail tiến độ trái — cùng bề rộng/chiều cao hàng với WorkspaceProgressRail */}
    <div aria-hidden className="w-[264px] shrink-0 flex flex-col">
      <div className="h-[58px] shrink-0 pl-5 pr-3 flex items-center">
        <Skeleton className="h-6 w-28" />
      </div>
      <div className="pl-5 pr-3 pb-2">
        <Skeleton className="h-2.5 w-14" />
      </div>
      <div className="flex-1 min-h-0 px-2.5 flex flex-col gap-1">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="px-2.5 py-2">
            <Skeleton className={`h-3 ${i % 3 === 2 ? "w-2/3" : "w-4/5"}`} />
          </div>
        ))}
      </div>
      <div className="shrink-0 px-5 pt-3 pb-4 flex flex-col gap-2">
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
      <PageSkeleton
        variant="workspace"
        workspacePane={workspacePane}
        bare
        label="Đang tải không gian làm việc SRS"
        className="flex-1 min-h-0"
      />
    </div>
  </div>
  );
};

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

  if (project === null || (mode1 && !importDone)) return <WorkspaceLoading projectId={projectId} />;
  return <FptWorkspace mode1={mode1} />;
}

const MODE1_ACTION =
  "shrink-0 px-3 py-1.5 rounded-full border border-[#DCD8F0] bg-[#F2F1FB] text-body font-bold text-[#554DB0] hover:bg-[#E8E6F7] transition-colors";

/**
 * Workspace pipeline — mode 2 (template FPT) và mode 1 sau import (`mode1`). Mode 1 v3 (bám BPMN Flow 1 ⇒ 3.1): không
 * chạy step / gate / ký v1 / waive, không ghi Spine thẳng — chỉ xem tài liệu, chat, panel "Sửa tài liệu có xem trước"
 * (⇒ tạo CR), cờ + change request + version & release.
 */
function FptWorkspace({ mode1 = false }: { mode1?: boolean }) {
  const params = useParams();
  const projectId = params?.id as string;
  // Workspace chưa i18n hoá — chỉ câu FE gửi thay user theo ngôn ngữ giao diện: BE lấy ngôn ngữ trả lời từ câu đó (FLF-260)
  const t = useTranslations("workspace");

  const ws = useWorkspace(projectId);
  /** Mode 1 v3 phase 8: change request chạy trong khung chat bên trái. */
  const crChat = useCrChat(projectId, mode1);
  const spineState = useSpine(projectId, ws.ready, ws.canEdit);
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
  /** Tên mục (`§2.2.2 Actors`) theo `section_id` — từ tài liệu đang hiển thị, để panel kiểm tra khỏi hiện mã nội bộ. */
  const [sectionLabels, setSectionLabels] = useState<ReadonlyMap<string, string>>(new Map());
  const handleSectionsLoaded = useCallback(
    (sections: readonly RenderedSection[]) => setSectionLabels(new Map(sections.map((section) => [section.id, sectionLabel(section)]))),
    []
  );
  /** Panel kiểm tra đang lọc theo một mục (bấm chấm số trên tài liệu). */
  const [issueSectionId, setIssueSectionId] = useState<string | null>(null);
  const openIssues = (sectionId: string | null = null) => {
    setIssueSectionId(sectionId);
    setRightPanel("verification");
  };
  const showSection = (sectionId: string) => {
    const target = document.querySelector(`[data-section-id="${CSS.escape(sectionId)}"]`);
    target?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  // Panel đang vẽ: giữ panel cuối trong lúc chạy hiệu ứng đóng (rightPanel đã về null)
  const [shownPanel, setShownPanel] = useState<WorkspacePanel | null>(rightPanel);
  if (rightPanel && rightPanel !== shownPanel) setShownPanel(rightPanel);
  const [progressOpen, setProgressOpen] = useState<boolean>(readSavedProgressOpen);
  // Màn hẹp + đang mở panel phải ⇒ tạm ẩn rail tiến độ để tài liệu và panel nằm cạnh nhau, không bị ép/cắt.
  // Chỉ là hiển thị: lựa chọn đã lưu (`progressOpen`) giữ nguyên, đóng panel là rail về lại.
  const mainRef = useRef<HTMLElement>(null);
  const mainWidth = () => mainRef.current?.getBoundingClientRect().width ?? 0;
  const rail = useResizableWidth({
    storageKey: RAIL_WIDTH_KEY,
    defaultWidth: 264,
    min: 200,
    max: () => 440,
    measure: (x) => {
      const el = document.getElementById("workspace-progress");
      return el ? x - el.getBoundingClientRect().left : null;
    },
  });
  const panel = useResizableWidth({
    storageKey: PANEL_WIDTH_KEY,
    defaultWidth: 360,
    min: 300,
    // Chừa chỗ tối thiểu cho chat + tài liệu
    max: () => Math.min(640, mainWidth() - CHAT_MIN - DOC_MIN),
    measure: (x) => {
      const el = document.getElementById("workspace-right-panel");
      return el ? el.getBoundingClientRect().right - x : null;
    },
  });
  // Pha Brief: chat co giãn, cột tóm tắt cố định ⇒ tay kéo đổi cỡ CỘT TÓM TẮT, đo từ mép phải của nó
  const brief = useResizableWidth({
    storageKey: BRIEF_WIDTH_KEY,
    defaultWidth: 400,
    min: 320,
    max: () => Math.min(620, mainWidth() - CHAT_MIN),
    measure: (x) => {
      const el = document.getElementById("workspace-brief-panel");
      return el ? el.getBoundingClientRect().right - x : null;
    },
  });
  const viewport = useSyncExternalStore(subscribeViewport, viewportWidth, () => Number.POSITIVE_INFINITY);
  const narrow = viewport < rail.width + CHAT_MIN + DOC_MIN + panel.width;
  const railShown = progressOpen && !(narrow && rightPanel !== null);
  const toggleProgress = () => {
    // Rail đang bị tạm ẩn vì panel ⇒ "Hiện tiến độ" = đóng panel, không lật lựa chọn đã lưu
    if (progressOpen && !railShown) {
      setRightPanel(null);
      return;
    }
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
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);
  /** Chip "Sửa tài liệu" trên ô chat: bật ⇒ nội dung gửi đi là lệnh sửa (`/changes/preview`), không phải tin chat. */
  // Mode 1 (phase 8): chat bên trái mặc định là sửa tài liệu qua change request; tắt chip ⇒ hỏi đáp
  const [editMode, setEditMode] = useState(mode1);
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
  // `latestSeq` cho "Lịch sử sửa" (20 dòng gần nhất) — lấy từ `max(steps[].last_seq)` của
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
    // Nâng `versionRef` ngay từ kết quả đọc: chỉ trông vào effect theo `spineState.version` thì nó chạy SAU lệnh kế tiếp
    // (Duyệt cổng gọi `/gate` ngay khi hàm này trả về) ⇒ `base_version` cũ hơn một bậc ⇒ 409 SPINE_VERSION_CONFLICT.
    bumpVersion(await reloadSpine());
    void reloadProgress();
  }, [recomputeFlagsFn, reloadProgress, reloadSpine, bumpVersion]);

  const { refreshUser } = ws;

  const [documentRefreshToken, setDocumentRefreshToken] = useState(0);

  /**
   * Vẽ lại các sơ đồ (một lời gọi cho mỗi cặp kind + owner: `screen_flow` nhiều phần vẽ chung một lượt) rồi quét lại cờ và
   * tải lại tài liệu — ảnh trong tài liệu là PNG BE nhúng lúc trả, phải đọc lại mới thấy hình mới. Ném lỗi bằng câu tiếng Việt.
   */
  const redrawDiagrams = useCallback(
    async (diagrams: readonly Diagram[]) => {
      if (diagrams.length === 0) throw new Error("Không tìm thấy sơ đồ này — tải lại trang rồi thử lại.");
      const targets = [...new Map(diagrams.map((d) => [`${d.kind}:${d.owner_id ?? ""}`, d])).values()];
      try {
        for (const d of targets) await renderDiagram(projectId, d.kind, d.owner_id);
      } catch (err) {
        const code = err instanceof ApiClientError ? err.code : "UNKNOWN_ERROR";
        throw new Error(friendlyError(code, err instanceof ApiClientError ? err.rawMessage : "").message);
      }
      await recomputeFlagsFn();
      void reloadSpine();
      void reloadProgress();
      setDocumentRefreshToken((v) => v + 1);
      setToast("Đã vẽ lại sơ đồ");
    },
    [projectId, recomputeFlagsFn, reloadSpine, reloadProgress]
  );

  const diagramsOfSection = useCallback(
    (sectionId: string) => spineState.spine?.diagrams.filter((d) => d.section === sectionId) ?? [],
    [spineState.spine]
  );

  /** BUG-17: cờ `diagram_stale` / `render_error` có nút "Vẽ lại" — `target_id` của cờ là id sơ đồ, vẽ xong cờ tự đóng. */
  const handleRedrawDiagram = useCallback(
    async (flag: Flag) => {
      try {
        await redrawDiagrams(spineState.spine?.diagrams.filter((d) => d.id === flag.target_id) ?? []);
      } catch (err) {
        setSaveError(err instanceof Error ? err.message : "Không vẽ lại được sơ đồ");
      }
    },
    [redrawDiagrams, spineState.spine]
  );
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
    // FLF-244: quy trình chạy ở phiên chính dù user đang xem phiên phụ (dữ liệu cũ thiếu cờ ⇒ phiên đang mở)
    sessionId: ws.pipelineSession?._id ?? (ws.isPipelineActive ? (ws.activeSession?._id ?? null) : null),
    getBaseVersion,
    onSpineChanged,
    onGateDone: (res) => setSelectedStepId(res.next_step),
    // Lời AI xác nhận việc vừa sửa hiện ngay như một tin của AI, trước khi bước chạy lại
    onRevisionMessage: (message, stepId) => {
      if (ws.isPipelineActive) ws.appendLocalMessage(message, stepId, "ai");
    },
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
    async (ops: Op[]): Promise<boolean> => {
      const baseVersion = versionRef.current;
      if (baseVersion === null) return false;
      setSavingChange(true);
      try {
        // Sau baseline v1 mọi lô ghi phải kèm lý do ở cấp transaction (change.service `post_baseline`),
        // nếu không BE trả 400 và cả workspace thành read-only. Op ở đây đều do gate/panel sinh ra kèm sẵn
        // một câu mô tả — dùng luôn câu đó làm lý do vào Record of Changes, không bắt user gõ thêm.
        const reason = ops.find((op) => op.reason)?.reason ?? "Chỉnh sửa trong workspace";
        // BUG-06: Spine vừa đổi ở bước khác thì tự đọc lại phiên bản mới và gửi lại một lần
        const { result } = await applyChangesWithRebase(projectId, { base_version: baseVersion, ops, reason });
        bumpVersion(result.spine_version);
        replaceSpine(result.spine);
        void reloadProgress();
        return true;
      } catch (err) {
        const code = err instanceof ApiClientError ? err.code : "UNKNOWN_ERROR";
        const raw = err instanceof ApiClientError ? err.rawMessage : err instanceof Error ? err.message : "";
        setSaveError(friendlyError(code, raw).message);
        if (code === "SPINE_VERSION_CONFLICT") void reloadSpine();
        return false;
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
      // Giả định về nền tảng / mức độ quan trọng: đổi luôn trường thật và xác nhận giả định trong một lượt ghi — câu
      // giả định dựng từ nhãn user chọn, không gọi AI dịch (không tốn credit).
      if (decision.kind === "pick") {
        const { title, titleEn } = PICKABLE_FIELDS[decision.path];
        // Nền tảng là mảng (FLF-237): nền tảng vừa chọn thành nền tảng chính, các nền tảng khác đã có giữ nguyên phía sau
        const pickedValue =
          decision.path === "project.form_factor"
            ? [decision.value, ...formFactorList(spineState.spine?.project.form_factor).filter((v) => v !== decision.value)]
            : decision.value;
        return submitOps([
          { op: "set", path: decision.path, value: pickedValue, reason: "User sửa giả định ở cổng chốt" },
          { op: "set", path: `${path}.statement`, value: `${titleEn}: ${decision.value.replace(/_/g, " ")}` },
          { op: "set", path: `${path}.statement_vi`, value: `${title}: ${decision.label}` },
          { op: "set", path: `${path}.status`, value: "confirmed" },
          { op: "set", path: `${path}.confirmed_at`, value: new Date().toISOString() },
        ]);
      }
      // FLF-221: user sửa bằng ngôn ngữ của mình ⇒ BE gọi AI dịch sang EN và ghi cả hai bản (tốn một lượt credit).
      // Nối vào hàng đợi ghi để cầm `spine_version` mới nhất; lỗi ⇒ `false` để thẻ giữ chữ user đã gõ.
      const run = writeQueueRef.current.catch(() => undefined).then(async (): Promise<boolean> => {
        const baseVersion = versionRef.current;
        if (baseVersion === null) return false;
        setSavingChange(true);
        try {
          const res = await editAssumption(projectId, decision.id, { statement_vi: decision.statement, base_version: baseVersion });
          if (res.data) {
            bumpVersion(res.data.spine_version);
            replaceSpine(res.data.spine);
          }
          void reloadProgress();
          refreshUser();
          setToast("Đã sửa giả định — AI đã cập nhật bản tiếng Anh trong tài liệu");
          return true;
        } catch (err) {
          const code = err instanceof ApiClientError ? err.code : "UNKNOWN_ERROR";
          setToast(`Chưa sửa được giả định: ${friendlyError(code, err instanceof ApiClientError ? err.rawMessage : "").message}`);
          if (code === "SPINE_VERSION_CONFLICT") void reloadSpine();
          return false;
        } finally {
          setSavingChange(false);
        }
      });
      writeQueueRef.current = run;
      return run;
    },
    [submitOps, projectId, bumpVersion, replaceSpine, reloadProgress, reloadSpine, refreshUser]
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
          // Lỗi gợi ý "sửa bằng lệnh": bật chip Sửa tài liệu trên ô chat (runner.reset gỡ luôn lý do khoá chip)
          runner.reset();
          setEditMode(true);
          return;
        default:
          runner.reset();
      }
    },
    [runner, onSpineChanged]
  );

  /** Pha Brief và S-1: ba panel Brief chỉ có nghĩa ở đây (Phases §5). */
  const inBriefPhase = (spine?.progress.current_phase ?? "").startsWith("B-") || spine?.progress.current_phase === "S-1";
  // Badge trên nút "Hồ sơ" — cùng con số với tab "Chờ bạn quyết" của panel
  const pendingCount = useMemo(() => (!mode1 && spine ? pendingRecordCount(spine, inBriefPhase) : 0), [mode1, spine, inBriefPhase]);
  /**
   * Khung phải ở B-0…B-2 là Brief panel, không phải SRS pane (FLF-221): SRS chưa có nội dung trước S-1, và một trang
   * tài liệu trống làm user tưởng phải viết SRS ngay. Theo giai đoạn của bước đang làm; S-1 trở đi là SRS pane như cũ.
   */
  const briefPane = !mode1 && (shownPhase ?? "").startsWith("B-");
  // Không dựng khung phải (khung chat chiếm hết chỗ) khi: chưa biết giai đoạn — nếu không thì lúc mới vào,
  // `shownPhase` còn null nên khung SRS hiện ra một nhịp rồi mới đổi sang Brief; hoặc đang pha Brief mà Brief chưa có gì.
  const phaseUnknown = !mode1 && shownPhase === null;
  const briefHidden = phaseUnknown || (briefPane && spine !== null && !briefHasData(spine));
  // Nhớ khung phải đang hiện cho lần vào sau (skeleton giữ đúng bố cục). Chưa biết giai đoạn thì chưa ghi.
  const shownPane: WorkspacePane = briefHidden ? "none" : briefPane ? "brief" : "document";
  useEffect(() => {
    if (phaseUnknown) return;
    try {
      localStorage.setItem(workspacePaneKey(projectId), shownPane);
    } catch {
      // Không ghi được (chế độ riêng tư) ⇒ lần sau skeleton mặc định, không sao
    }
  }, [phaseUnknown, shownPane, projectId]);

  const markPlaceholder = (screenId: string) =>
    submitOps([{ op: "set", path: `screens[id=${screenId}].detail_status`, value: "placeholder", reason: "Để lại màn ở vòng một" }]);

  // ─── Lệnh sửa trong chat áp lô đã có preview (UC 6.8) — Spine mới đã có sẵn, khỏi reloadSpine ────
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

  // ─── sửa tài liệu ngay trong chat (chip "Sửa tài liệu") ──────────
  /** Thẻ sửa đang hiện trong chat (đang xem trước / chờ quyết / vừa áp). */
  const [editCardOpen, setEditCardOpen] = useState(false);
  const [editDetailOpen, setEditDetailOpen] = useState(false);
  const [appliedEdit, setAppliedEdit] = useState<AppliedEdit | null>(null);
  /** Câu đang chọn trên thẻ hỏi, theo lượt hỏi — để Enter ở ô chat gửi kèm. */
  const [cardAnswers, setCardAnswers] = useState<{ key: string; answers: StepAnswer[] }>({ key: "", answers: [] });
  /** Việc vừa gửi lên `/changes` — để biết kết quả trả về là của lệnh sửa, lượt cập nhật mục cũ hay hoàn tác. */
  const editActionRef = useRef<"instruction" | "outdated" | "undo" | null>(null);
  const pendingInstructionRef = useRef("");
  /**
   * Lệnh sửa là một lượt hội thoại của phiên đang mở: BE đọc các tin trước (trả lời câu hỏi làm rõ không mất yêu cầu
   * gốc) và ghi lệnh + kết quả vào phiên. FE hiện tạm tin user, xong lượt thì tải lại phiên để thấy đúng transcript.
   */
  const activeSessionId = ws.activeSession?._id ?? null;
  const lastMessageStep = ws.activeSession?.messages.at(-1)?.step ?? null;
  const { appendLocalMessage, dropLocalMessage, reloadActiveSession } = ws;
  const getSessionId = useCallback(() => activeSessionId, [activeSessionId]);
  const onChangesApplied = useCallback(
    (result: ApplyResult, impactedSectionIds?: string[]) => {
      handleChangeApplied(result, impactedSectionIds);
      const action = editActionRef.current;
      editActionRef.current = null;
      if (action === "undo") {
        setToast("Đã hoàn tác lần sửa gần nhất");
        setAppliedEdit(null);
        setEditCardOpen(false);
      } else if (action === "instruction") {
        setEditDetailOpen(false);
        setAppliedEdit({ instruction: pendingInstructionRef.current, count: result.changes.length, version: result.spine_version });
        // BE đã ghi tin "Đã áp dụng …" vào phiên
        if (activeSessionId) void reloadActiveSession(activeSessionId);
      } else {
        // Lần áp khác (cập nhật mục cũ) đè lên ⇒ thẻ cũ không còn là lần mới nhất, thôi hoàn tác
        setAppliedEdit(null);
      }
    },
    [handleChangeApplied, activeSessionId, reloadActiveSession]
  );
  const changes = useChanges(projectId, getBaseVersion, getLatestSeq, onChangesApplied, getSessionId);
  const outdatedSections = mode1 ? 0 : (progress?.readiness.stale ?? 0);
  // FLF-248: cờ "rỗng" của bước đã chốt là vấn đề thật (chặn ký baseline), không phải "sẽ điền ở bước sau"
  const acceptedSteps = new Set((steps?.steps ?? []).filter((s) => s.status === "accepted").map((s) => s.id));
  const documentIssues = issueCounts(flags, outdatedSections, acceptedSteps);
  /** Chip sửa khoá khi step đang chạy / chờ trả lời: hai luồng cùng ghi Spine sẽ vấp 409 SPINE_VERSION_CONFLICT. */
  const editDisabledReason =
    !mode1 && runner.state.busy
      ? "Bước đang chạy — đợi chạy xong rồi hãy sửa tài liệu"
      : !mode1 && runner.state.status === "needs_input"
        ? "Trả lời câu hỏi của bước đang chạy trước đã"
        : null;
  const { requestPreview, cancelPreview } = changes;
  const submitEditInstruction = useCallback(
    (instruction: string) => {
      if (!instruction.trim()) return;
      pendingInstructionRef.current = instruction.trim();
      setAppliedEdit(null);
      setEditDetailOpen(false);
      setEditCardOpen(true);
      const sessionId = activeSessionId;
      if (sessionId) appendLocalMessage(instruction.trim(), lastMessageStep);
      void requestPreview(instruction).then((outcome) => {
        if (!sessionId) return;
        // Chưa gửi đi đâu ⇒ không để tin "ma" trong khung chat
        if (outcome === "skipped") return dropLocalMessage(instruction.trim());
        void reloadActiveSession(sessionId);
        // Câu hỏi làm rõ đã thành một tin trong chat — đóng thẻ, chip sửa vẫn bật để user trả lời ngay ở ô chat
        if (outcome === "clarification") {
          cancelPreview();
          setEditCardOpen(false);
        }
      });
    },
    [requestPreview, cancelPreview, activeSessionId, lastMessageStep, appendLocalMessage, dropLocalMessage, reloadActiveSession]
  );
  const closeEditCard = () => {
    cancelPreview();
    setEditCardOpen(false);
    setEditDetailOpen(false);
    setAppliedEdit(null);
  };
  /** Bật chip sửa và đưa con trỏ vào ô chat — `prefill` điền sẵn chỗ cần sửa (nút "Sửa mục này" trên tài liệu). */
  const startEditing = (prefill?: string) => {
    if (editDisabledReason) {
      setToast(editDisabledReason);
      return;
    }
    setEditMode(true);
    if (prefill !== undefined) ws.setInputMessage(prefill);
    // Đợi ô nhập render lại với chip bật rồi mới focus, con trỏ về cuối dòng
    setTimeout(() => {
      const input = document.getElementById("flintflow-chat-input") as HTMLTextAreaElement | null;
      input?.focus();
      input?.setSelectionRange(input.value.length, input.value.length);
    }, 0);
  };

  /** "Tôi muốn sửa" ở cổng chốt: chỉ đưa con trỏ vào ô chat — gõ xong gửi đi là yêu cầu sửa của cổng, không bật chip sửa tài liệu. */
  const focusChatInput = () => {
    document.getElementById("flintflow-chat-input")?.focus();
  };

  // ─── resize chat pane ─────────────────────────────────────────
  const chat = useResizableWidth({
    storageKey: CHAT_WIDTH_KEY,
    defaultWidth: 480,
    min: CHAT_MIN,
    // Chừa chỗ tối thiểu cho tài liệu + panel phải đang mở
    max: () => Math.min(1000, mainWidth() - (rightPanel ? panel.width : 0) - DOC_MIN),
    measure: (x) => {
      const el = document.getElementById("flintflow-chat-pane");
      return el ? x - el.getBoundingClientRect().left : null;
    },
  });

  // Chỉ tính "đang chạy ở nơi khác" khi tab này không giữ lượt nào: lượt của chính tab (đang ở cổng, đang chờ trả lời)
  // cũng làm `running` bật nhưng ô chat vẫn phải dùng được để yêu cầu sửa / trả lời.
  const stepRunningElsewhere = runner.state.status === "idle" && (steps?.steps.some((s) => s.id === viewedStep && s.running) ?? false);
  // Tab mở giữa lượt chạy ở nơi khác: theo dõi run-state tới khi BE xong rồi dựng lại / tải lại — không chờ user tải trang (FLF-235)
  useFollowRunningElsewhere({ active: stepRunningElsewhere, projectId, restore: restoreRunner, onSettled: onSpineChanged });

  if (!ws.ready) return <WorkspaceLoading projectId={projectId} />;

  /** FLF-244: phiên phụ chỉ hỏi đáp + lệnh sửa — thẻ hỏi, thẻ cổng, tiến trình bước chỉ hiện ở phiên chính. */
  const onPipelineSession = ws.isPipelineActive;
  /** FLF-244: Viewer chỉ đọc — ẩn ô nhập, thẻ hỏi, thẻ cổng và mọi nút chạy bước (BE cũng chặn 403). */
  const canEdit = ws.canEdit;
  const gate = onPipelineSession && runner.state.status === "gate_ready" ? runner.state.gate : null;
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
  const reopenable = viewedStep !== null && reopenableStepIds.has(viewedStep);
  /**
   * Mục đã cũ mà bước đang xem phải làm mới. Bấm › ở panel "Cần bạn duyệt lại" chỉ đổi bước đang xem — không có
   * thẻ này thì khung chat vẫn là lịch sử cũ, không nói phải làm gì, và chip "Sửa tài liệu" đang bật còn biến câu
   * gõ vào thành lệnh sửa thay vì chạy lại bước.
   */
  const staleSectionsOfViewed = [
    ...new Set(
      flags
        .filter(
          (f) =>
            !f.resolved_at &&
            !f.waived_by_user &&
            f.remediation_step === viewedStep &&
            (f.rule_id === "section_stale_at_baseline" || f.rule_id === "section_awaiting_reaccept")
        )
        .map((f) => f.section_id)
    ),
  ];
  // "Đúng rồi, đi tiếp" chỉ xác nhận giả định mà tin của cổng này đã nói; phần còn lại dành cho danh sách rà (B-2.1 / S-9.1)
  const spokenAssumptions = runner.state.phaseGate ? runner.state.phaseGate.new_assumptions : gate?.payload?.new_assumptions;
  const settledAssumptionIds = new Set((spine?.assumptions ?? []).filter((a) => a.status !== "unconfirmed").map((a) => a.id));

  /**
   * Gửi một lệnh của cổng chốt. Dùng chung cho chip trên thẻ cổng và cho một tiếng "ừ" gõ ở ô chat — hai lối
   * phải ghi cùng một dấu vết vào khung chat, nếu không đọc lại lịch sử sẽ thấy hai kiểu khác nhau cho cùng
   * một hành động.
   *
   * Hiện ngay như một lượt của user (gate có thể chờ cả chuỗi bước sau chạy xong mới trả về); không thành thì gỡ.
   * Thẻ cổng dựng từ lượt chạy đang sống nên chốt xong là biến mất: tin cổng phải ở lại khung chat ngay trước
   * thao tác vừa bấm, đúng thứ tự BE ghi transcript — thiếu nó thì đọc lại chỉ thấy "Đúng rồi, đi tiếp" một mình.
   */
  const submitGateAction = (action: GateAction, note?: string): void => {
    const spoken = runner.state.phaseGate ? runner.state.phaseGate.message_vi : gate?.payload?.message_vi;
    const said = GATE_ACTION_TEXT[action](note);
    if (spoken) ws.appendLocalMessage(spoken, runnerStep, "ai");
    ws.appendLocalMessage(said, runnerStep);
    void runner.gate(action, note).then((outcome) => {
      if (outcome === "ok") return;
      ws.dropLocalMessage(said);
      if (spoken) ws.dropLocalMessage(spoken, "ai");
    });
  };

  // 422 BASELINE_BLOCKED khi Accept ở S-9.5: danh sách cờ đang chặn đi kèm trong `meta.flags` (BUG-01)
  const blockingFlags: BlockingFlag[] | undefined =
    runner.state.error?.code === "BASELINE_BLOCKED" && Array.isArray(runner.state.error.meta?.flags)
      ? (runner.state.error.meta.flags as BlockingFlag[])
      : undefined;
  // Cờ MỚI của lượt này: BE chỉ báo số cờ đỏ/vàng tăng thêm (`red_delta`/`yellow_delta`), nên lấy chừng ấy cờ mở mới nhất.
  // Giả định chưa xác nhận đã có chip "Đúng rồi, đi tiếp" lo, không nêu lần hai ở đây.
  const gateFlagDelta = runner.state.phaseGate?.flags ?? gate?.payload?.flags;
  const newestOpenFlags = (level: "red" | "yellow", count: number) =>
    flags
      .filter((f) => f.level === level && !f.resolved_at && !f.waived_by_user && f.rule_id !== "unconfirmed_assumption")
      .sort((a, b) => b.opened_at_version - a.opened_at_version)
      .slice(0, Math.max(0, count));
  const newGateFlags: GateNewFlag[] =
    mode1 || !gate || !gateFlagDelta
      ? []
      : [...newestOpenFlags("red", gateFlagDelta.red_delta), ...newestOpenFlags("yellow", gateFlagDelta.yellow_delta)]
          .slice(0, MAX_GATE_FLAGS)
          .map((f) => ({
            id: f.id,
            level: f.level === "red" ? "red" : "yellow",
            message: readableMessage(f.message, f.section_id, sectionLabels.get(f.section_id)),
            waivable: isFlagWaivable(f.rule_id),
          }));
  const viewingAccepted = viewedSummary?.status === "accepted" && viewedStep !== runnerStep && !reopenable;
  // Lượt hỏi: câu mở trả lời bằng ô chat, câu có lựa chọn ở thẻ. Id Q1… lặp lại giữa các step nên khoá gồm cả step.
  const questionSetKey = `${runner.state.stepId ?? ""}|${runner.state.questions.map((q) => `${q.id}:${q.text}`).join("|")}`;
  const aiWorking = runner.state.busy || stepRunningElsewhere;
  /**
   * Bước đang xem là bước tới lượt và chưa có lượt chạy nào — gõ chat là chạy (FLF-221). Gồm cả bước tới lượt đang
   * `revision_requested` (bị mở lại, hoà giải): thiếu nó thì tin nhắn rơi vào hỏi đáp thường, AI chỉ trả lời "xem như
   * đã duyệt" mà bước không bao giờ chạy lại được.
   */
  const stepNotStarted =
    runner.state.status === "idle" &&
    viewedStep !== null &&
    viewedStep === currentStep &&
    !viewingAccepted &&
    (viewedSummary === undefined || viewedSummary.status === "pending" || viewedSummary.status === "revision_requested");
  /** Mở đầu project mới: B-0.1 chưa chạy, phiên pipeline chưa có tin nhắn, Spine chưa có ghi chú Brief. */
  const showOpening =
    !mode1 &&
    canEdit &&
    onPipelineSession &&
    stepNotStarted &&
    currentStep === "B-0.1" &&
    (ws.activeSession?.messages.length ?? 0) === 0 &&
    (spine?.addendum.length ?? 0) === 0;

  /**
   * Ô chat là nút chạy (FLF-221). Bật "Sửa tài liệu" thì ChatPane đã đưa sang lệnh sửa trước khi tới đây. Còn lại xét
   * theo thứ tự: AI đang làm ⇒ khoá; đang chờ trả lời ⇒ `/answer` kèm tin (và câu đã chọn trên thẻ); ở cổng ⇒ yêu cầu
   * sửa (không bao giờ tự duyệt); bước tới lượt chưa chạy ⇒ chạy cả giai đoạn với tin làm lời mở; còn lại ⇒ hỏi đáp.
   * Đính kèm được tải lên trước; chữ chỉ rời ô chat khi lượt chạy đã mở (lỗi 409 không làm mất chữ).
   */
  /**
   * Lời AI của lượt hỏi đang chờ: sống thì từ SSE (`elicitText`), sau reload thì là tin AI cuối của lịch sử (BE ghi lời đáp
   * vào transcript của bước). Gộp nó với câu hỏi thành MỘT bong bóng, và ẩn bản trong lịch sử cho khỏi hiện hai lần.
   */
  const lastChatMessage = ws.activeSession?.messages.at(-1);
  const trailingAskReply =
    !mode1 && onPipelineSession && runner.state.status === "needs_input" && lastChatMessage?.role === "ai"
      ? replyOfAsk(lastChatMessage.content)
      : null;
  const askReply = runner.state.elicitText || trailingAskReply || "";
  const openQuestions = splitQuestions(runner.state.questions, askReply).listed;

  /**
   * Lượt hỏi tới qua SSE nên chưa có trong lịch sử trên màn hình — trả lời xong là thẻ hỏi đóng và câu hỏi biến mất theo.
   * Chèn nó (lời đáp + câu hỏi, đúng dạng BE ghi transcript) vào lịch sử ngay trước câu trả lời. Đã có ⇒ bỏ qua.
   */
  const keepAskInHistory = () => {
    if (trailingAskReply !== null || runner.state.questions.length === 0) return;
    // Câu `inline` mà lời AI đã chứa thì không lưu lại thành dòng câu hỏi riêng
    const content = JSON.stringify({
      reply: askReply,
      questions: runner.state.questions.filter((q) => !(q.inline && replyContainsQuestion(askReply, q.text))).map((q) => ({ question: q.text })),
    });
    ws.appendLocalMessage(content, runner.state.stepId, "ai");
  };

  /**
   * Câu trả lời trên thẻ vào lịch sử ngay: MỘT bong bóng, mỗi đáp án một dòng, chữ gõ ở ô chat (`typed`) nối ngay sau —
   * câu hỏi đã nằm ở tin AI ngay trên. Đúng dạng BE ghi transcript.
   */
  const showCardAnswers = (answers: readonly StepAnswer[], typed = "") => {
    const lines = [...answers.map((a) => (Array.isArray(a.answer) ? a.answer.join(", ") : a.answer).trim()), typed.trim()].filter((line) => line !== "");
    if (lines.length === 0) return;
    ws.appendLocalMessage(lines.join("\n"), runner.state.stepId);
  };

  /** Chip "Sửa theo đề xuất" của một cờ mới: gửi yêu cầu sửa nêu đúng vấn đề đó, như user tự gõ ở ô chat. */
  const fixFlagByChat = (flag: GateNewFlag) => {
    if (!runnerStep) return;
    const said = `Sửa giúp tôi theo đề xuất cho vấn đề này: ${flag.message}`;
    ws.appendLocalMessage(said, runnerStep);
    void runner.gate("revision", said).then((outcome) => {
      if (outcome !== "ok") ws.dropLocalMessage(said);
    });
  };

  const sendFromChat = async (custom?: string, intent?: RunIntent) => {
    if (mode1) return ws.sendMessage(currentStep, custom);
    // FLF-244: phiên phụ là phiên hỏi đáp — không đụng step runner (BE chặn run/answer/gate ngoài phiên chính)
    if (!onPipelineSession) return ws.sendMessage(currentStep, custom);
    if (aiWorking) {
      setToast("AI đang làm — đợi xong lượt này rồi nhắn tiếp nhé");
      return;
    }
    const raw = (custom ?? ws.inputMessage).trim();
    const status = runner.state.status;
    const toRun = stepNotStarted || (reopenable && status === "idle");
    if (status !== "needs_input" && status !== "gate_ready" && !toRun) return ws.sendMessage(currentStep, custom);
    if (!(await ws.uploadPendingAttachments())) return;
    const text = raw || "[Đính kèm tài liệu]";

    if (status === "needs_input") {
      const onCard = cardAnswers.key === questionSetKey ? cardAnswers.answers : [];
      setCardAnswers({ key: "", answers: [] });
      ws.setInputMessage("");
      keepAskInHistory();
      showCardAnswers(onCard, text);
      await runner.answer(onCard, text);
      return;
    }
    if (status === "gate_ready") {
      ws.setInputMessage("");
      // Tin cổng mời duyệt bằng lời ("ổn thì mình đi tiếp nhé") nên trả lời bằng chữ là chuyện tự nhiên. Một
      // tiếng "ừ" phải chốt bước, không phải bắt AI soạn lại: gửi nó đi là `revision` thì mỗi lần user xác
      // nhận lại tốn một lượt gọi model và mở ra đúng cái cổng vừa rồi — vòng lặp không lối ra.
      if (isGateApproval(text)) {
        if (!gate?.actions.includes("accept")) {
          setToast("Chưa chốt được bước này — xử lý nốt phần đang chặn ở thẻ duyệt rồi quay lại nhé");
          return;
        }
        // Đúng đường của chip Duyệt: xác nhận giả định tin cổng đã nói trước, rồi mới chốt
        const pending = unsettledAssumptions(spokenAssumptions, gate.payload?.new_assumptions, settledAssumptionIds);
        if (pending.length > 0) await confirmAllAssumptions(pending.map((a) => a.id));
        submitGateAction("accept");
        return;
      }
      ws.appendLocalMessage(text, runner.state.stepId);
      // Thẻ cổng đã cũ (bước đã về chờ chạy) thì runner tự chạy lại bước với đúng lời nhắn này
      await runner.gate("revision", text);
      return;
    }
    const stepId = viewedStep as string;
    const start = {
      message: text,
      ...(intent ? { intent } : {}),
      onStarted: () => {
        if (!custom) ws.setInputMessage("");
        ws.appendLocalMessage(text, stepId);
      },
    };
    // Bước mở lại (màn để trống / mục đã cũ) chạy lẻ; bước tới lượt chạy cả giai đoạn cho cả hai chế độ duyệt
    if (reopenable && !stepNotStarted) await runner.run(stepId, { ...start, standalone: true });
    else await runner.runWholePhase(unitOfStep(stepId) ?? stepId, start);
  };

  /**
   * Nút trên thẻ "mục đã cũ": chạy lẻ lại bước sở hữu, không đi qua ô chat (chip "Sửa tài liệu" có thể đang bật).
   * `reopen`: cờ có thể trễ hơn Spine (mục đã được chốt lại ở nơi khác) — khi đó BE không coi bước là cũ nữa và
   * từ chối chạy bước đã accepted; user đã bấm chủ động nên mở lại bước (B7) thay vì báo "Bước này đã chốt".
   */
  const rerunStaleStep = async (stepId: string) => {
    const text = t("rerunStep.message");
    await runner.run(stepId, { message: text, standalone: true, reopen: true, onStarted: () => ws.appendLocalMessage(text, stepId) });
  };

  return (
    <div className="h-screen flex overflow-hidden bg-surface-container-lowest font-sans">
      {/* Rail tiến độ trái — z-30: nút tròn ở mép và tooltip nổi trên pane chat */}
      {/* Mode 1 v3: không có step ⇒ không có rail tiến độ */}
      <Collapse axis="x" open={!mode1 && !focusMode && railShown} className="relative z-30">
        <div style={{ width: rail.width }} className="h-full shrink-0">
        <WorkspaceProgressRail
          onHide={toggleProgress}
          currentPhase={shownPhase}
          steps={steps?.steps ?? []}
          progress={progress?.progress ?? null}
          selectedStepId={viewedStep}
          onSelectStep={setSelectedStepId}
          reopenableStepIds={reopenableStepIds}
          readinessPercent={progress?.readiness.accepted_pct}
        />
        </div>
        <ResizeHandle active={rail.resizing} onStart={rail.startResize} onReset={rail.reset} label="Đổi cỡ rail tiến độ" />
      </Collapse>

      <div className="flex-1 min-w-0 flex flex-col">
      {/* z-20: menu tài khoản trong header nổi trên dải mờ của các pane bên dưới */}
      <Collapse open={!focusMode} className="relative z-20">
        <WorkspaceHeader
          project={ws.project}
          user={ws.user}
          baselineVersion={spine?.baselines.at(-1)?.version ?? null}
          progressHidden={!mode1 && !railShown}
          onShowProgress={toggleProgress}
          // FLF-221: không còn nút chạy — gõ chat là chạy
          currentStep={mode1 ? null : currentStep}
          onBackToCurrent={!mode1 && viewedStep !== currentStep ? () => setSelectedStepId(null) : undefined}
          onExportClick={() => setExportOpen((v) => !v)}
          // Mode 1: gap report + change request mở dạng popup ngay trên màn tài liệu (`?panel=gap|cr`)
          actions={
            mode1 ? (
              <>
                <Link href={gapReportHref(projectId)} scroll={false} className={MODE1_ACTION}>
                  Gap report
                </Link>
                <Link href={crListHref(projectId)} scroll={false} className={MODE1_ACTION}>
                  Change request
                </Link>
              </>
            ) : undefined
          }
          onEnterFocus={() => setFocusMode(true)}
          onToolsClick={() => togglePanel("tools")}
          toolsActive={rightPanel === "tools"}
          toolsLabel={mode1 ? "Cờ, change request & version" : "Hồ sơ dự án"}
          toolsCount={pendingCount}
          onLogout={ws.logout}
        />
      </Collapse>

      <main
        ref={mainRef}
        className="flex-1 min-h-0 flex overflow-hidden bg-surface-container-lowest"
      >
        <ChatPane
          // Rail tiến độ ẩn (hoặc đang mở rộng trang) ⇒ khung chat sát mép trái màn hình, chỉ bo bên phải
          flushLeft={mode1 || focusMode || !railShown}
          hideTrailingAiMessage={trailingAskReply !== null}
          title={mode1 ? "Hỏi đáp & lệnh sửa" : undefined}
          width={chat.width}
          fill={briefHidden || briefPane}
          session={ws.activeSession}
          stepLabel={!mode1 && viewedStep ? stepLabel(viewedStep) : null}
          stepCode={!mode1 ? viewedStep : null}
          inputMessage={ws.inputMessage}
          setInputMessage={ws.setInputMessage}
          onSendMessage={(custom) => void sendFromChat(custom)}
          sending={ws.sending || (!mode1 && aiWorking)}
          inputPlaceholder={
            !mode1 && !onPipelineSession
              ? "Hỏi AI về dự án, hoặc bật Sửa tài liệu để sửa…"
              : !mode1 && aiWorking
              ? "AI đang làm…"
              : !mode1 && gate
                ? "Muốn sửa gì thì bạn nhắn tôi nhé…"
                : !mode1 && stepNotStarted
                  ? "Kể ý tưởng hoặc điều bạn muốn AI làm…"
                  : undefined
          }
          pendingAttachments={ws.pendingAttachments}
          onSelectAttachment={ws.selectAttachment}
          onRemoveAttachment={ws.removeAttachment}
          headerStart={
            <ChatSessionHistory
              sessions={ws.sessions}
              activeSessionId={ws.activeSession?._id ?? null}
              pipelineSessionId={ws.pipelineSession?._id ?? null}
              createDisabled={ws.sending || runner.state.busy}
              readOnly={!canEdit}
              onSelectSession={ws.selectSession}
              onCreateSession={ws.createSession}
              onDeleteSession={ws.deleteSession}
            />
          }
          streamingMessage={ws.streamingMessage}
          isStreaming={ws.streamingMessage !== null}
          onEditInstruction={mode1 ? (text) => void crChat.send(text) : submitEditInstruction}
          onGoToPipeline={ws.pipelineSession ? () => void ws.selectSession(ws.pipelineSession!) : undefined}
          readOnlyNotice={canEdit ? undefined : "Bạn đang xem với vai trò Viewer — chỉ đọc được tài liệu, không gửi tin hay chạy bước AI."}
          editPlaceholder={mode1 ? crChat.inputHint : undefined}
          editMode={editMode}
          onToggleEditMode={() => (editMode ? setEditMode(false) : startEditing())}
          editDisabledReason={editDisabledReason}
          inputTools={
            mode1 ? undefined : (
              <AiSettingsMenu
                reviewMode={reviewMode}
                onChangeReviewMode={(mode) => void changeReviewMode(mode)}
                disabled={runner.state.busy || savingChange}
              />
            )
          }
          questionCard={
            !mode1 && canEdit && onPipelineSession && runner.state.status === "needs_input" ? (
              <ElicitPanel
                questions={runner.state.questions}
                onSubmit={(answers) => {
                  setCardAnswers({ key: "", answers: [] });
                  keepAskInHistory();
                  showCardAnswers(answers);
                  void runner.answer(answers);
                }}
                chatDraft={ws.inputMessage}
                onChatDraftUsed={() => ws.setInputMessage("")}
                onCardChange={(answers) => setCardAnswers({ key: questionSetKey, answers })}
                sending={runner.state.busy}
              />
            ) : undefined
          }
        >
          {showOpening && <ChatOpening disabled={aiWorking} onPick={(chip) => void sendFromChat(chip.message, chip.intent)} />}
          {mode1 && ws.crPrefill && <CrPrefillCard projectId={projectId} prefill={ws.crPrefill} onDismiss={ws.dismissCrPrefill} />}
          {mode1 && editMode && <Mode1CrThread projectId={projectId} chat={crChat} me={ws.user?.name ?? ""} />}
          {/* Bước đã chốt không hiện thông báo trong khung chat — dấu ✓ trên rail tiến độ đã nói điều đó, còn
              một dải chữ đứng mãi mỗi lần xem lại bước cũ thì chỉ chiếm chỗ của cuộc trò chuyện */}
          {!mode1 && canEdit && onPipelineSession && viewedStep && staleSectionsOfViewed.length > 0 && runner.state.status === "idle" && !aiWorking && (
            <div className="bg-accent-gold-soft rounded-control p-3 flex flex-col gap-2 text-body text-accent-gold-text">
              <p className="leading-relaxed">
                Bước <strong>{stepLabel(viewedStep)}</strong> đã chốt, nhưng{" "}
                <strong>{staleSectionsOfViewed.map((id) => sectionLabels.get(id) ?? id).join(", ")}</strong> đã cũ so với dữ liệu
                bị sửa sau đó. Chạy lại bước để AI cập nhật, xem lại rồi bấm Duyệt ở cổng chốt.
              </p>
              <button
                type="button"
                onClick={() => void rerunStaleStep(viewedStep)}
                className="self-start h-8 px-3.5 rounded-control text-body font-bold bg-primary text-on-primary hover:bg-primary-hover cursor-pointer"
              >
                Cập nhật lại bước này
              </button>
            </div>
          )}
          {runnerStep && !background && onPipelineSession && (
            <StepProgress state={runner.state} onCancel={() => void runner.cancel()} onBackground={() => setBackground(true)} />
          )}
          {!mode1 && onPipelineSession && runner.state.status === "needs_input" && (askReply || openQuestions.length > 0) && (
            // Lời AI + câu mở của lượt hỏi (câu có lựa chọn nằm ở thẻ hỏi trên ô chat)
            <ChatBubble
              message={{
                role: "ai",
                content: JSON.stringify({ reply: askReply, questions: openQuestions.map((q) => ({ question: q.text })) }),
                createdAt: new Date().toISOString(),
              }}
              hideBadge
            />
          )}
          {gate && runnerStep && canEdit && (
            <GateCard
              {...(runner.state.phaseGate ? { phaseSummary: runner.state.phaseGate.summary } : {})}
              stepId={runnerStep}
              actions={gate.actions}
              regenerateUsed={gate.regenerate_used}
              busy={runner.state.busy}
              payload={gate.payload}
              message={runner.state.phaseGate ? runner.state.phaseGate.message_vi : gate.payload?.message_vi}
              spokenAssumptions={spokenAssumptions ?? []}
              settledAssumptionIds={settledAssumptionIds}
              onConfirmAssumptions={(ids) => confirmAllAssumptions(ids)}
              blockingFlags={blockingFlags}
              newFlags={newGateFlags}
              onFixFlag={fixFlagByChat}
              onKeepFlag={(flag, reason) => handleFlagWaive(flag.id, reason)}
              onWantEdit={focusChatInput}
              onGoToStep={setSelectedStepId}
              wroteOps={gate.wroteOps}
              emptySections={gate.emptySections}
              onAction={(action, note) => submitGateAction(action, note)}
            />
          )}
          {saveError && (
            <div role="alert" className="bg-error-container rounded-control p-3 text-body text-error flex items-center justify-between gap-2">
              <span>{saveError}</span>
              <button type="button" onClick={() => setSaveError(null)} className="text-body font-bold underline cursor-pointer">
                Đóng
              </button>
            </div>
          )}
          {!mode1 && canEdit && onPipelineSession && runner.state.status === "interrupted" && !runner.state.error && runner.state.stepId && (
            // Lượt chết giữa chừng (reload, mất mạng): nút "Chạy lại" là lối duy nhất còn lại để chạy bước này (FLF-221)
            <div role="alert" className="bg-error-container rounded-control p-3 text-body text-error flex flex-wrap items-center gap-2">
              <span className="flex-1 min-w-0">Lượt chạy bị gián đoạn. Nội dung đã ghi trước đó được giữ.</span>
              <button
                type="button"
                onClick={() => void handleErrorAction({ kind: "retry", label: "Chạy lại" })}
                className="px-2.5 py-1 rounded-full text-body font-bold bg-error text-on-error cursor-pointer"
              >
                Chạy lại
              </button>
            </div>
          )}
          {runner.state.error && (
            // BUG-25: lỗi nói bằng tiếng Việt kèm việc làm được. Đây là NƠI DUY NHẤT nói câu lỗi — nhật ký
            // lượt chạy phía trên cố ý im, vì BE trả câu đã viết cho người nên nhắc lại chỉ thành tiếng vọng.
            <div role="alert" className="bg-error-container rounded-control p-3 text-body text-error flex flex-col gap-2">
              <span>{friendlyError(runner.state.error.code, runner.state.error.message).message}</span>
              <div className="flex flex-wrap items-center gap-2">
                {friendlyError(runner.state.error.code, runner.state.error.message).actions.map((action) => (
                  <button
                    key={action.kind}
                    type="button"
                    onClick={() => void handleErrorAction(action)}
                    className="px-2.5 py-1 rounded-full text-body font-bold bg-error text-on-error cursor-pointer"
                  >
                    {action.label}
                  </button>
                ))}
                <button type="button" onClick={runner.reset} className="text-body font-bold underline cursor-pointer">
                  Đóng
                </button>
              </div>
            </div>
          )}
          {editCardOpen && (
            <ChatEditCard
              instruction={changes.pendingInstruction}
              previewing={changes.previewing}
              applying={changes.applying}
              clarification={changes.clarification}
              error={changes.error}
              preview={changes.previewSource === "instruction" ? changes.preview : null}
              applied={appliedEdit}
              requiresCr={mode1}
              onShowDetail={() => setEditDetailOpen(true)}
              onApply={() => {
                // Mode 1: không áp thẳng — mở form tạo change request điền sẵn
                if (mode1) {
                  setEditDetailOpen(true);
                  return;
                }
                // Sau baseline BE bắt buộc lý do (400 nếu thiếu) — mở bản xem trước đầy đủ để hỏi
                // ngay thay vì áp thẳng từ thẻ tóm tắt rồi ăn lỗi khó hiểu.
                if (changes.preview?.branch === "post_baseline") {
                  setEditDetailOpen(true);
                  return;
                }
                editActionRef.current = "instruction";
                void changes.confirmPreview();
              }}
              onCancel={closeEditCard}
              onUndo={() => {
                editActionRef.current = "undo";
                void changes.undo();
              }}
              onDismiss={closeEditCard}
            />
          )}
        </ChatPane>

        {briefHidden ? null : briefPane ? (
          <ResizeHandle active={brief.resizing} onStart={brief.startResize} onReset={brief.reset} label="Đổi cỡ cột tóm tắt" />
        ) : (
          <ResizeHandle active={chat.resizing} onStart={chat.startResize} onReset={chat.reset} label="Đổi cỡ khung chat" />
        )}

        {briefHidden ? null : briefPane ? (
          <BriefPanel spine={spine} updating={runner.state.busy} width={brief.width} />
        ) : (
        <DocumentPane
          projectId={projectId}
          projectName={documentName}
          flags={flags}
          changedSectionIds={changedSectionIds}
          // Mode 1 v3: không có step ⇒ không có nút "xem tại step", mục trống mời tạo CR
          onSelectStep={mode1 ? undefined : setSelectedStepId}
          refreshToken={documentRefreshToken}
          mode1={mode1}
          onEditSection={canEdit ? (label) => startEditing(`Trong ${label}: `) : undefined}
          issues={documentIssues}
          onOpenIssues={() => (rightPanel === "verification" && !issueSectionId ? setRightPanel(null) : openIssues())}
          onOpenSectionIssues={(sectionId) => openIssues(sectionId)}
          rewriteError={!editCardOpen ? changes.error : null}
          onSectionsLoaded={handleSectionsLoaded}
          // Mode 1 v3: tài liệu chỉ đổi qua change request — không vẽ lại thẳng.
          // Tạm ẩn nút "Vẽ lại sơ đồ" dưới hình: bật lại bằng REDRAW_SECTION_ENABLED.
          onRedrawSection={mode1 || !REDRAW_SECTION_ENABLED ? undefined : (sectionId) => redrawDiagrams(diagramsOfSection(sectionId))}
          hasDiagrams={(sectionId) => diagramsOfSection(sectionId).length > 0}
          // Nút thoát mở rộng (trước nằm đầu rail công cụ) — giữ nguyên icon, đặt cuối header tài liệu
          headerEnd={focusMode ? <IconButton icon="collapse" label="Thoát mở rộng (Esc)" onClick={() => setFocusMode(false)} /> : undefined}
        />
        )}

        <Collapse axis="x" open={rightPanel !== null}>
        <ResizeHandle active={panel.resizing} onStart={panel.startResize} onReset={panel.reset} label="Đổi cỡ panel bên phải" />
        <div id="workspace-right-panel" style={{ width: panel.width }} className="h-full shrink-0">
        {shownPanel === "tools" && spine && (
          <aside className="w-full h-full bg-surface-container rounded-l-dialog flex flex-col overflow-hidden" aria-label={mode1 ? "Cờ, change request & version" : "Hồ sơ dự án"}>
            <div className="ff-fade-below [--ff-fade:var(--color-surface-container)] h-12 pl-4 pr-2 bg-surface-container flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <Icon name="folder" size={16} className="text-primary" />
                <h3 className="font-bold text-body text-on-surface truncate">{mode1 ? "Cờ, change request & version" : "Hồ sơ dự án"}</h3>
              </div>
              <IconButton icon="close" size="sm" label="Đóng hồ sơ dự án" onClick={() => setRightPanel(null)} />
            </div>
            <div className="flex-1 overflow-y-auto ff-scroll p-4 flex flex-col gap-3">
            {mode1 && (
              <Mode1WorkspaceTools
                projectId={projectId}
                projectName={ws.project?.name}
                flags={flags}
                onSpineChanged={() => onSpineChanged()}
                readOnly={!canEdit}
              />
            )}
            {/* Ghi Spine thẳng (`/changes`) — mode 1 v3 mọi sửa qua CR nên không hiện */}
            {!mode1 && (
              <ProjectRecordPanel
                spine={spine}
                onSubmitOps={async (ops) => void (await submitOps(ops))}
                onMarkPlaceholder={(id) => void markPlaceholder(id)}
                busy={savingChange}
                readOnly={!canEdit}
                inBriefPhase={inBriefPhase}
                history={changes.history}
                historyLoading={changes.historyLoading}
                onLoadHistory={changes.loadHistory}
              />
            )}
            </div>
          </aside>
        )}

        {shownPanel === "verification" && (
          <VerificationPane
            projectId={projectId}
            issues={{
              sectionLabelOf: (id) => sectionLabels.get(id),
              onShowSection: showSection,
              focusSectionId: issueSectionId,
              onClearFocus: () => setIssueSectionId(null),
              // "Hoà giải" cũ: gom các mục đã cũ, AI viết lại cho khớp, xem trước rồi áp (mode 1 sửa qua CR nên không có)
              outdatedCount: outdatedSections,
              onRewriteOutdated: canEdit
                ? () => {
                    editActionRef.current = "outdated";
                    void changes.reconcileOnce();
                  }
                : undefined,
              rewriting: changes.applying && changes.previewSource !== "instruction",
              onEditSection: canEdit ? (label) => startEditing(`Trong ${label}: `) : undefined,
              acceptedSteps,
            }}
            readiness={progress?.readiness ?? null}
            flags={flags}
            flagsLoading={flagsLoading}
            flagsError={flagsError}
            flagsBusy={flagsBusy}
            onClose={() => setRightPanel(null)}
            // Mode 1 v3: không có step, không sửa thẳng giả định — cờ chỉ đóng bằng change request
            onSelectStep={mode1 ? undefined : setSelectedStepId}
            onWaive={mode1 || !canEdit ? undefined : handleFlagWaive}
            onRedraw={canEdit ? handleRedrawDiagram : undefined}
            onAssumptionDecision={mode1 || !canEdit ? undefined : (decision) => void applyAssumptionDecision(decision)}
            onConfirmAllAssumptions={mode1 || !canEdit ? undefined : (ids) => void confirmAllAssumptions(ids)}
            onRecompute={canEdit ? handleFlagRecompute : undefined}
          />
        )}
        </div>
        </Collapse>

      </main>
      </div>

      {/* Ở phiên phụ, bước đang chạy của phiên chính hiện thành pill thay cho khối tiến trình trong khung chat */}
      {(background || !onPipelineSession) && runnerStep && (
        <RunPill
          state={runner.state}
          onOpen={() => {
            setBackground(false);
            if (!onPipelineSession && ws.pipelineSession) void ws.selectSession(ws.pipelineSession);
          }}
          onCancel={() => void runner.cancel()}
        />
      )}

      {(toast ?? ws.notice) && (
        <div
          role="status"
          className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 bg-[#191817] text-white text-body font-semibold px-4 py-2 rounded-full shadow-[0_10px_30px_rgba(0,0,0,0.25)] flex items-center gap-3"
        >
          <span>{toast ?? ws.notice}</span>
          <button
            type="button"
            onClick={() => {
              setToast(null);
              ws.clearNotice();
            }}
            className="text-caption underline cursor-pointer"
          >
            Đóng
          </button>
        </div>
      )}

      {/* Diff đầy đủ: lệnh sửa (bấm "Xem chi tiết") hoặc lượt cập nhật mục đã cũ (nút trên header tài liệu) */}
      {changes.preview && changes.previewSource === "instruction" && editDetailOpen && mode1 && (
        <CreateCrPreviewModal
          projectId={projectId}
          preview={changes.preview}
          instruction={changes.pendingInstruction}
          onCancel={() => setEditDetailOpen(false)}
        />
      )}
      {changes.preview && ((changes.previewSource === "instruction" && editDetailOpen && !mode1) || changes.previewSource === "reconcile") && (
        <DiffPreviewModal
          preview={changes.preview}
          busy={changes.applying}
          confirmLabel={changes.previewSource === "reconcile" ? "Cập nhật" : "Áp dụng"}
          onCancel={() => (changes.previewSource === "reconcile" ? changes.cancelPreview() : setEditDetailOpen(false))}
          onConfirm={(reason) => {
            editActionRef.current = changes.previewSource === "reconcile" ? "outdated" : "instruction";
            void changes.confirmPreview(reason);
          }}
        />
      )}

      {exportOpen && (
        <ExportPanel
          projectId={projectId}
          projectName={documentName}
          flags={flags}
          onClose={() => setExportOpen(false)}
        />
      )}

      {mode1 && (
        <Suspense fallback={null}>
          <Mode1Popup projectId={projectId} projectName={documentName} onChanged={() => onSpineChanged()} readOnly={!canEdit} />
        </Suspense>
      )}
    </div>
  );
}
