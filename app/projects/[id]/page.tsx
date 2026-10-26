"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { applyChangesWithRebase, editAssumption, renderDiagram } from "@/lib/api/spine";
import { getProject, setDocumentLanguage } from "@/lib/api/projects";
import { onProjectModeMaybeChanged, signalProjectModeMaybeChanged } from "@/lib/project-mode-signal";
import { describeConversation, editUseCaseIntent } from "@/lib/use-case-intent";
import { ApiClientError } from "@/lib/api/client";
import type { BadgeTone } from "@/components/ui/Badge";
import { createBaseline, rejectBaseline, submitBaseline } from "@/lib/api/export";
import { userErrorMessage } from "@/lib/api/error-messages";
import { friendlyError, type ErrorAction } from "@/lib/errors";
import { hookErrorText } from "@/lib/hook-errors";
import { workspaceStepLabel as stepLabel } from "./_components/phase-labels";
import { ACCEPT_USER_TEXT, REGENERATE_USER_TEXT } from "./_components/user-text";
import type { ApplyResult, GateAction, Op, RunIntent, StepAnswer } from "@/types/pipeline";
import type { SrsComment } from "@/types/comment";
import { isGateApproval } from "@/lib/gate-approval";
import type { Diagram, ReviewMode } from "@/types/spine";
import { chatChangePreview } from "@/lib/chat-change-preview";
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
import { editLockReason } from "./_components/edit-lock";
import CreateCrPreviewModal from "./_components/mode1/CreateCrPreviewModal";
import ProjectRecordPanel from "./_components/ProjectRecordPanel";
import { pendingRecordCount } from "./_components/project-record-pending";
import AiSettingsMenu from "./_components/AiSettingsMenu";
import ExportPanel from "./_components/ExportPanel";
import TranslateDialog from "@/components/project/TranslateDialog";
import { knownDocumentLanguage, MODE2_SOURCE_LANGUAGE } from "@/lib/document-language";
import { languageCommandOutcome, parseLanguageCommand, type LanguageCommandOutcome } from "@/lib/document-language-command";
import { getTranslationStatus } from "@/lib/api/translations";
import { submitGate } from "@/lib/api/pipeline";
import type { TranslationStatus } from "@/types/document";
import type { DocumentLanguage } from "@/types/project";
import LanguageCommandCard from "./_components/LanguageCommandCard";
import GateCard, { PICKABLE_FIELDS, unsettledAssumptions, type AssumptionDecision, type BlockingFlag, type GateNewFlag } from "./_components/GateCard";
import { formFactorList } from "./_components/brief-labels";
import ElicitPanel, { splitQuestions } from "./_components/ElicitPanel";
import { replyContainsQuestion } from "@/lib/question-options";
import ChatBubble, { knowledgeShapeOf } from "./_components/ChatBubble";
import StepProgress from "./_components/StepProgress";
import ChatOpening from "./_components/ChatOpening";
import RunPill from "./_components/RunPill";
import { recordStepStat } from "@/lib/step-stats";
import CrPrefillCard from "./_components/mode1/CrPrefillCard";
import Mode1CrThread from "./_components/mode1/Mode1CrThread";
import { useCrChat } from "./hooks/mode1/useCrChat";
import Mode1WorkspaceTools from "./_components/mode1/Mode1WorkspaceTools";
import Mode1Popup from "./_components/mode1/Mode1Popup";
import { compareHref, crListHref, gapReportHref } from "./_components/mode1/prefill";
import { IMPORT_DONE_STATUSES } from "./_components/mode1/labels";
import { fetchOrganization } from "@/lib/api/orgs";
import { getActiveOrgId } from "@/lib/api/token-store";
import { useWorkspace, type WorkspaceNotice } from "./hooks/useWorkspace";
import { useResizableWidth } from "./hooks/useResizableWidth";
import { useChanges } from "./hooks/useChanges";
import { issueCounts, readableMessage } from "./_components/flag-rules";
import { isFlagWaivable } from "@/types/flags";
import { useSpine } from "./hooks/useSpine";
import { useProgress } from "./hooks/useProgress";
import { useFollowRunningElsewhere } from "./hooks/useFollowRunningElsewhere";
import { isPhaseUnit, unitOfStep, useStepRunner } from "./hooks/useStepRunner";
import { useFlags } from "./hooks/useFlags";
import { useComments } from "./hooks/useComments";
import CommentsPanel from "./_components/CommentsPanel";
import type { CommentResolutionInput, PendingCommentAnchor } from "@/types/comment";
import { useTurnNotice } from "./hooks/useTurnNotice";

/** Bề rộng cửa sổ — để biết có đủ chỗ cho rail tiến độ + chat + tài liệu + panel phải cùng lúc không. */
const subscribeViewport = (onChange: () => void) => {
  window.addEventListener("resize", onChange);
  return () => window.removeEventListener("resize", onChange);
};
const viewportWidth = () => window.innerWidth;

/** Viền nổi bật của section vừa đổi (DocumentPane) tắt sau một nhịp — khớp chú thích UI. */
const CHANGED_SECTION_HIGHLIGHT_MS = 3000;
/** Toast tự tắt sau khoảng này — trước đây nó ở mãi và che nút Gửi của ô chat. */
const TOAST_MS = 5000;
/** Nút "Vẽ lại sơ đồ" dưới hình của mỗi mục trong DocumentPane — tạm ẩn; đổi thành `true` để hiện lại. */
const REDRAW_SECTION_ENABLED = false;
/** Tin AI của lượt hỏi trong lịch sử là `{reply, questions}` (BE ghi kèm câu hỏi) hoặc chữ thường — lấy phần lời đáp. */
/**
 * Lệnh đổi ngôn ngữ tài liệu vừa bị chặn trước khi gửi (FLF-265 §3.7) — thẻ trong chat giữ câu gốc và đường gửi ban đầu
 * (ô chat thường hay chip "Sửa tài liệu") để "Gửi như tin nhắn" đi đúng đường cũ, không đổi gì.
 */
interface LanguageCommandState {
  id: number;
  kind: Exclude<LanguageCommandOutcome, "send">;
  text: string;
  target: DocumentLanguage;
  via: "chat" | "edit";
  intent?: RunIntent;
  /** `same`: ước tính dịch của ngôn ngữ hiện tại (đọc sau khi thẻ hiện) — còn mục thiếu thì mời dịch nốt. */
  status: TranslationStatus | null;
  busy: boolean;
  error: string | null;
}

/** Cổng chốt nêu tối đa chừng này cờ mới — nhiều hơn thì user xem tiếp ở panel Kiểm tra. */
const MAX_GATE_FLAGS = 3;

/**
 * Lời đáp của lượt hỏi, lấy từ tin AI trong transcript. `null` ⇒ tin này KHÔNG phải lời đáp của lượt hỏi.
 *
 * Tin tri thức (FLF-279) cũng mang `reply: string`, nên phải loại nó ra: nhận lầm thì tin tri thức bị
 * gộp vào bong bóng câu hỏi của bước và bị `hideTrailingAiMessage` cắt khỏi khung chat — user trả 2
 * credit rồi không thấy gì.
 */
export const replyOfAsk = (content: string): string | null => {
  try {
    const data: unknown = JSON.parse(content);
    if (data && typeof data === "object") {
      if (knowledgeShapeOf(data)) return null;
      if (typeof (data as { reply?: unknown }).reply === "string") return (data as { reply: string }).reply;
    }
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
/**
 * Bề rộng pane tài liệu còn **đọc được**, khác `DOC_MIN` là mức tối thiểu kỹ thuật. Dưới mức này header
 * của nó (tên · version · DRAFT · chip vấn đề · Làm mới) hết chỗ và các nhãn chồng lên nhau, nên khi cần
 * nhường chỗ cho panel phải thì ẩn rail tiến độ trước chứ không ép pane xuống `DOC_MIN`.
 *
 * Trần khi **kéo tay** cũng tính theo mức này: user không kéo được tới vùng mà chính bố cục tự động đã
 * tránh. `DOC_MIN` chỉ còn là van an toàn lúc mở panel mà màn hình thật sự không đủ chỗ.
 */
const DOC_COMFORT = 460;
/** Panel phải — mỗi lúc chỉ mở một; mở từ chip trạng thái của tài liệu hoặc nút "Công cụ" trên header. */
type WorkspacePanel = "verification" | "tools" | "comments";
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
  const t = useTranslations("workspace.page");
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
        label={t("loading")}
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
  const t = useTranslations("workspace.page");
  const [project, setProject] = useState<Pick<Project, "mode" | "import_state" | "converted_from"> | null>(null);
  // FLF-318: duyệt baseline / lỗi chỉ mode 1 có ⇒ đọc lại project (dự án tạo SRS vừa chuyển sang mode 1)
  const [reloadKey, setReloadKey] = useState(0);
  const [convertedNotice, setConvertedNotice] = useState<string | null>(null);
  useEffect(() => onProjectModeMaybeChanged(() => setReloadKey((k) => k + 1)), []);

  useEffect(() => {
    let cancelled = false;
    getProject(projectId)
      .then((res) => {
        if (cancelled) return;
        const next = res.data ?? { mode: "fpt" as const, import_state: null };
        setProject((prev) => {
          if (prev && prev.mode !== "import" && next.mode === "import" && next.converted_from === "fpt") setConvertedNotice(t("convertedNotice"));
          return next;
        });
      })
      // Lần đọc lại lỗi giữ nguyên project đang có; lần đầu lỗi ⇒ workspace mode 2 tự xử lý lỗi/đăng nhập
      .catch(() => !cancelled && setProject((prev) => prev ?? { mode: "fpt", import_state: null }));
    return () => {
      cancelled = true;
    };
  }, [projectId, reloadKey]);

  // UC-47: Viewer không vào workspace (Spine, cờ, CR là dữ liệu làm việc — BE trả 403) ⇒ sang trang đọc tài liệu.
  // Lỗi đọc vai trò ⇒ coi như không phải Viewer (BE vẫn chặn).
  const [isViewer, setIsViewer] = useState<boolean | null>(null);
  useEffect(() => {
    let cancelled = false;
    const orgId = getActiveOrgId();
    (orgId ? fetchOrganization(orgId).then((org) => org.role === "viewer") : Promise.resolve(false))
      .catch(() => false)
      .then((viewer) => !cancelled && setIsViewer(viewer));
    return () => {
      cancelled = true;
    };
  }, []);

  const mode1 = project?.mode === "import";
  const importDone = !!project?.import_state && IMPORT_DONE_STATUSES.includes(project.import_state);
  useEffect(() => {
    if (isViewer) router.replace(`/projects/${projectId}/view`);
    else if (isViewer === false && mode1 && !importDone) router.replace(`/projects/${projectId}/import`);
  }, [isViewer, mode1, importDone, projectId, router]);

  if (project === null || isViewer !== false || (mode1 && !importDone)) return <WorkspaceLoading projectId={projectId} />;
  // Đổi mode ⇒ dựng lại workspace từ đầu (hook của mode 2 — step, gate — không mang sang mode 1)
  return <FptWorkspace key={mode1 ? "mode1" : "fpt"} mode1={mode1} initialNotice={mode1 ? convertedNotice : null} />;
}


const MODE1_ACTION =
  "shrink-0 px-3 py-1.5 rounded-full border border-[#DCD8F0] bg-[#F2F1FB] text-body font-bold text-[#554DB0] hover:bg-[#E8E6F7] transition-colors";

/**
 * Workspace pipeline — mode 2 (template FPT) và mode 1 sau import (`mode1`). Mode 1 v3 (bám BPMN Flow 1 ⇒ 3.1): không
 * chạy step / gate / ký v1 / waive, không ghi Spine thẳng — chỉ xem tài liệu, chat, panel "Sửa tài liệu có xem trước"
 * (⇒ tạo CR), cờ + change request + version & release.
 */
function FptWorkspace({ mode1 = false, initialNotice = null }: { mode1?: boolean; initialNotice?: string | null }) {
  const params = useParams();
  const projectId = params?.id as string;
  // Câu FE gửi thay user cũng theo ngôn ngữ giao diện: BE lấy ngôn ngữ trả lời từ câu đó (FLF-260)
  const t = useTranslations("workspace");
  const tHook = useTranslations("workspace.hookErrors");
  const tLanguage = useTranslations("common.documentLanguage");
  const locale = useLocale();
  /** Lỗi hook lưu mã `@key` khi BE không kèm câu (`lib/hook-errors.ts`) — dịch lúc render. */
  const hookError = (error: string | null) => (error ? hookErrorText(error, tHook) : null);

  const ws = useWorkspace(projectId, { attachmentOnlyText: t("session.attachmentOnly") });
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
    keep: keepFlagFn,
    recompute: recomputeFlagsFn,
  } = useFlags(projectId, spineState.version);
  // Góp ý ghim vào nội dung (UC-49) — nguồn duy nhất cho cả `DocumentPane` (chấm số) lẫn panel, như `useFlags`
  const comments = useComments(projectId, spineState.version);

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
    // Chừa chỗ cho chat + pane tài liệu ở bề rộng còn ĐỌC ĐƯỢC, không phải mức tối thiểu kỹ thuật:
    // kéo tay cũng phải tôn trọng đúng ngưỡng mà bố cục tự động đã dùng để quyết định ẩn rail.
    max: () => Math.min(640, mainWidth() - CHAT_MIN - DOC_COMFORT),
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
  /**
   * Mở panel phải mà thiếu chỗ ⇒ **ẩn rail tiến độ trước**, chưa co pane nội dung vội.
   *
   * Thứ tự hi sinh này có lý do: rail bật lại bằng một nút và không mất thông tin nào, còn pane tài liệu
   * co quá thì header của nó (tên · version · DRAFT · chip vấn đề · Làm mới) không đủ chỗ và chữ chồng
   * lên nhau. Nên tính chỗ cho rail theo bề rộng **đủ đọc** của pane giữa (`DOC_COMFORT`), không phải
   * bề rộng tối thiểu kỹ thuật.
   */
  const narrow = rightPanel !== null && viewport - panel.width - CHAT_MIN - DOC_COMFORT < rail.width;
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
  /**
   * Hộp "Dịch tài liệu" (FLF-265): mở từ cảnh báo "N mục chưa dịch" trên tài liệu; lệnh chat "dịch sang tiếng …" (§3.7)
   * cũng mở bằng chính state này. Mode 1 không dịch (D3).
   */
  const [translateOpen, setTranslateOpen] = useState(false);
  /** Ước tính đã đọc sẵn (lệnh chat vừa đổi ngôn ngữ / thẻ "Dịch N mục còn thiếu") ⇒ hộp dịch khỏi đọc lại lần đầu. */
  const [translateStatus, setTranslateStatus] = useState<TranslationStatus | undefined>(undefined);
  /** Thẻ lệnh đổi ngôn ngữ tài liệu trong chat (§3.7); `languageCommandSeq` bỏ kết quả về trễ của thẻ đã thay. */
  const [languageCommand, setLanguageCommand] = useState<LanguageCommandState | null>(null);
  const languageCommandSeq = useRef(0);
  /**
   * Bước đang xem, kèm số lần chọn. Chọn lại đúng bước đang xem là thao tác có nghĩa ("cho tôi xem lại
   * kết quả"), nhưng nếu chỉ giữ id thì state không đổi và React bỏ qua — user bấm mà màn hình đứng im.
   * `nonce` tăng mỗi lần chọn để phần cuộn-và-nháy bên dưới chạy lại kể cả khi id không đổi.
   */
  const [selection, setSelection] = useState<{ id: string | null; nonce: number }>({ id: null, nonce: 0 });
  const selectedStepId = selection.id;
  const setSelectedStepId = useCallback((id: string | null) => setSelection((s) => ({ id, nonce: s.nonce + 1 })), []);
  /**
   * Kết quả của mục vừa chọn nằm trong khung chat, mà khung chat có thể đang cuộn ở chỗ khác — và chọn lại
   * mục cũ thì chẳng có gì đổi để user nhận ra. Mỗi lần chọn: cuộn tới thẻ rồi nháy viền một lượt. Gắn/gỡ
   * class thẳng trên DOM thay vì qua state để khỏi set state trong effect.
   */
  const staleCardRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = staleCardRef.current;
    if (!el || selection.nonce === 0) return;
    el.scrollIntoView({ block: "nearest", behavior: "smooth" });
    el.classList.remove("ff-flash");
    void el.offsetWidth; // ép trình duyệt tính lại, nếu không animation cũ không chạy lại
    el.classList.add("ff-flash");
  }, [selection.nonce]);
  /** Chip "Sửa tài liệu" trên ô chat: bật ⇒ nội dung gửi đi là lệnh sửa (`/changes/preview`), không phải tin chat. */
  // Mode 1 (phase 8): chat bên trái mặc định là sửa tài liệu qua change request; tắt chip ⇒ hỏi đáp
  const [editMode, setEditMode] = useState(mode1);
  /**
   * Chip "Hỏi kiến thức BA" (FLF-279): bật ⇒ câu gửi đi là câu hỏi tri thức (`knowledge: true`), trả lời
   * có trích dẫn. Loại trừ với `editMode` — hai chế độ đi hai đường gửi khác nhau, trộn vào một biến là
   * mở đường cho lỗi gửi lầm.
   */
  const [knowledgeMode, setKnowledgeMode] = useState(false);
  const [savingChange, setSavingChange] = useState(false);
  /** Lỗi của lượt ghi op thuần (panel Tên riêng, hàng đợi màn, quyết định giả định) — nói bằng tiếng Việt. */
  const [saveError, setSaveError] = useState<string | null>(null);
  /** Thông báo ngắn sau một việc đã xong ("Đã áp dụng 3 thay đổi") — BUG-27. */
  const [toast, setToast] = useState<string | null>(initialNotice);
  /** "Giữ nguyên, duyệt lại" đang gửi (E2E FAP #20). */
  const [keepingStep, setKeepingStep] = useState(false);
  useEffect(() => {
    if (toast === null) return;
    const timer = setTimeout(() => setToast(null), TOAST_MS);
    return () => clearTimeout(timer);
  }, [toast]);
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
  /** FLF-329: cờ đỏ chỉ có "Giữ nguyên + lý do" — cờ vẫn chặn nên readiness không đổi, vẫn tải lại cho đồng bộ. */
  const handleFlagKeep = useCallback(
    async (flagId: string, reason: string) => {
      await keepFlagFn(flagId, reason);
      void reloadProgress();
    },
    [keepFlagFn, reloadProgress]
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
      if (diagrams.length === 0) throw new Error(t("page.redrawNotFound"));
      const targets = [...new Map(diagrams.map((d) => [`${d.kind}:${d.owner_id ?? ""}`, d])).values()];
      try {
        for (const d of targets) await renderDiagram(projectId, d.kind, d.owner_id);
      } catch (err) {
        const code = err instanceof ApiClientError ? err.code : "UNKNOWN_ERROR";
        throw new Error(friendlyError(code, err instanceof ApiClientError ? err.rawMessage : "", locale).message);
      }
      await recomputeFlagsFn();
      void reloadSpine();
      void reloadProgress();
      setDocumentRefreshToken((v) => v + 1);
      setToast(t("toasts.redrawn"));
    },
    [projectId, recomputeFlagsFn, reloadSpine, reloadProgress, t, locale]
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
        setSaveError(err instanceof Error ? err.message : t("page.redrawFailed"));
      }
    },
    [redrawDiagrams, spineState.spine, t]
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

  /**
   * Vòng dịch xong / dừng giữa chừng (FLF-265): chữ dịch nằm ở lớp bản dịch, Spine và `spine_version` không đổi ⇒ chỉ
   * tải lại tài liệu và số dư credit.
   */
  const handleTranslated = useCallback(() => {
    setDocumentRefreshToken((v) => v + 1);
    refreshUser();
  }, [refreshUser]);

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
  useTurnNotice(runner.state.status === "needs_input" || runner.state.status === "gate_ready", {
    detail: runner.state.status === "needs_input" ? t("page.turnNeedsInput") : t("page.turnGateReady"),
    title: t("turnNotice.title"),
    notification: t("turnNotice.notification"),
  });

  // Thời gian và credit THẬT của bước vừa xong — dùng lại làm ước lượng cho lần sau (03 §6)
  useEffect(() => {
    if (runner.state.status !== "gate_ready") return;
    rememberStat(runner.state.stepId, runner.state.gate?.payload);
  }, [runner.state.status, runner.state.stepId, runner.state.gate, rememberStat]);


  const spine = spineState.spine;
  const currentStep = progress?.progress.current_step ?? steps?.current_step ?? spine?.progress.current_step ?? null;

  // Reload / mất mạng giữa chừng: dựng lại đúng chỗ đang dở (BUG-07) — không chạy lại, không tốn credit.
  const { restore: restoreRunner } = runner;
  const restoredRef = useRef(false);
  useEffect(() => {
    if (!ws.ready || restoredRef.current || currentStep === null) return;
    restoredRef.current = true;
    // `/run-state/active` bỏ qua lượt đã gián đoạn (BE restart, mất kết nối) ⇒ hỏi thêm run-state của bước hiện tại để
    // còn dải "Chạy lại" sau reload (E2E FAP #2). Lượt đã xong thì reducer trả về rảnh như cũ.
    void restoreRunner().then((run) => (run === null ? restoreRunner(currentStep) : run));
  }, [ws.ready, restoreRunner, currentStep]);
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
        setSaveError(friendlyError(code, raw, locale).message);
        if (code === "SPINE_VERSION_CONFLICT") void reloadSpine();
        return false;
      } finally {
        setSavingChange(false);
      }
    },
    [projectId, bumpVersion, replaceSpine, reloadProgress, reloadSpine, locale]
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
          setToast(t("toasts.assumptionEdited"));
          return true;
        } catch (err) {
          const code = err instanceof ApiClientError ? err.code : "UNKNOWN_ERROR";
          setToast(t("toasts.assumptionEditFailed", { error: friendlyError(code, err instanceof ApiClientError ? err.rawMessage : "", locale).message }));
          if (code === "SPINE_VERSION_CONFLICT") void reloadSpine();
          return false;
        } finally {
          setSavingChange(false);
        }
      });
      writeQueueRef.current = run;
      return run;
    },
    [submitOps, projectId, bumpVersion, replaceSpine, reloadProgress, reloadSpine, refreshUser, t, locale]
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
      // Lượt chạy cả giai đoạn lỗi trước khi tới bước nào thì `stepId` rỗng — "Thử lại" từng không làm gì (E2E FAP #3);
      // lượt phỏng vấn đầu giai đoạn (`S-5@S05`) chạy lại bằng đường giai đoạn, không phải `/steps/:id/run`.
      const unit = stepId !== null && isPhaseUnit(stepId) ? stepId : stepId === null ? runner.state.phase : null;
      const rerun = async () => {
        if (unit) await runner.runWholePhase(unit);
        else if (stepId) await runner.run(stepId);
      };
      switch (action.kind) {
        case "cancel_and_rerun":
          await runner.cancel();
          await rerun();
          return;
        case "retry":
          runner.reset();
          await rerun();
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
    [runner, onSpineChanged, setSelectedStepId]
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
      setToast(result.changes.length > 0 ? t("toasts.changesApplied", { count: result.changes.length }) : t("toasts.noChange"));
      bumpVersion(result.spine_version);
      replaceSpine(result.spine);
      void reloadProgress();
      setDocumentRefreshToken((v) => v + 1);
      setChangedSectionIds(new Set(impactedSectionIds ?? []));
      // Viền nổi bật "một nhịp" (chú thích DocumentPane) — tắt sau một khoảng, không giữ mãi.
      if (changedSectionTimerRef.current) clearTimeout(changedSectionTimerRef.current);
      changedSectionTimerRef.current = setTimeout(() => setChangedSectionIds(new Set()), CHANGED_SECTION_HIGHLIGHT_MS);
    },
    [bumpVersion, replaceSpine, reloadProgress, t]
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
  /** FLF-318 (mode 1): lệnh thêm / xoá use case + các câu trả lời làm rõ của nó, theo thứ tự — `null` khi không ở vòng đó. */
  const useCaseTurnsRef = useRef<string[] | null>(null);
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
        setToast(t("toasts.undone"));
        setAppliedEdit(null);
        setEditCardOpen(false);
      } else if (action === "instruction") {
        setEditDetailOpen(false);
        // Lệnh sửa đã ghi ⇒ ô chat về trả lời bước; muốn sửa tiếp thì bật lại chip (E2E FAP: kẹt "Mô tả chỗ cần sửa…")
        if (!mode1) setEditMode(false);
        setAppliedEdit({ instruction: pendingInstructionRef.current, count: result.changes.length, version: result.spine_version });
        // BE đã ghi tin "Đã áp dụng …" vào phiên
        if (activeSessionId) void reloadActiveSession(activeSessionId);
      } else {
        // Lần áp khác (cập nhật mục cũ) đè lên ⇒ thẻ cũ không còn là lần mới nhất, thôi hoàn tác
        setAppliedEdit(null);
      }
    },
    [handleChangeApplied, activeSessionId, reloadActiveSession, mode1, t]
  );
  const changes = useChanges(projectId, getBaseVersion, getLatestSeq, onChangesApplied, getSessionId);
  const outdatedSections = mode1 ? 0 : (progress?.readiness.stale ?? 0);
  // FLF-248: cờ "rỗng" của bước đã chốt là vấn đề thật (chặn ký baseline), không phải "sẽ điền ở bước sau"
  const acceptedSteps = new Set((steps?.steps ?? []).filter((s) => s.status === "accepted").map((s) => s.id));
  const documentIssues = issueCounts(flags, outdatedSections, acceptedSteps);

  // ── Góp ý + chốt baseline (UC-45/46/47) ──────────────────────────
  /** Chỗ người dùng vừa bấm "Góp ý" — panel mở sẵn ô soạn cho chỗ đó. */
  const [pendingComment, setPendingComment] = useState<PendingCommentAnchor | null>(null);
  /** Panel góp ý đang lọc theo mã của lượt Lead từ chối baseline. */
  const [focusCommentIds, setFocusCommentIds] = useState<readonly string[] | null>(null);
  const openComments = (commentIds?: readonly string[]) => {
    setFocusCommentIds(commentIds ?? null);
    setRightPanel("comments");
  };
  const startComment = (anchor: PendingCommentAnchor) => {
    setPendingComment(anchor);
    setFocusCommentIds(null);
    setRightPanel("comments");
  };
  const submitComment = async (text: string) => {
    if (!pendingComment) return;
    await comments.create({
      version: { source: "draft" },
      anchor: {
        section_id: pendingComment.sectionId,
        ...(pendingComment.blockIndex !== undefined ? { block_index: pendingComment.blockIndex } : {}),
      },
      text,
    });
    setPendingComment(null);
  };
  /** Xử lý góp ý mở lại bước sở hữu mục ở BE (UC-47) ⇒ phải đọc lại Spine để tiến độ hiện đúng. */
  const resolveComment = async (commentId: string, resolution: CommentResolutionInput) => {
    await comments.resolve(commentId, resolution);
    await spineState.reload();
  };
  /** FLF-271 (UC-40): comment đang được nhờ AI sửa — lượt áp kế tiếp gửi `comment_id` để BE tự đóng. */
  const [fixingCommentId, setFixingCommentId] = useState<string | null>(null);
  const fixCommentByChat = (comment: SrsComment) => {
    setFixingCommentId(comment.comment_id);
    setRightPanel(null);
    startEditing(t("userText.fixComment", { label: comment.anchor.label, text: comment.text }));
  };

  const [baselineBusy, setBaselineBusy] = useState(false);
  const [baselineError, setBaselineError] = useState<string | null>(null);
  /** Cờ đỏ chặn lượt nộp/ký gần nhất, lấy từ `meta.flags[]` của 422 — xem `runBaselineAction`. */
  const [baselineBlockingFlags, setBaselineBlockingFlags] = useState<BlockingFlag[]>([]);

  /**
   * Chip trạng thái chốt bản trên breadcrumb. Nói theo vai trò người đang xem: Lead cần biết "có bản chờ
   * mình duyệt", Analyst cần biết "bản mình gửi đang ở đâu". Chưa nộp gì và chưa ký gì ⇒ không có chip.
   */
  const baselineStatus = ((): { label: string; tone: BadgeTone } | null => {
    if (mode1) return null; // mode 1 chốt bản qua release gói CR, không đi đường nộp/duyệt baseline
    const submission = spine?.baseline_submission ?? null;
    const isLead = ws.orgRole === "lead";
    if (submission?.status === "pending") {
      return isLead ? { label: t("page.baselinePendingLead"), tone: "warning" } : { label: t("page.baselinePending"), tone: "info" };
    }
    if (submission?.status === "rejected") {
      const open = submission.rejection_comment_ids.filter(
        (id) => comments.comments.find((c) => c.comment_id === id)?.status === "open"
      ).length;
      return { label: open > 0 ? t("page.baselineRejectedComments", { count: open }) : t("page.baselineRejected"), tone: "danger" };
    }
    const version = spine?.baselines.at(-1)?.version;
    return version ? { label: t("page.baselineVersion", { version }), tone: "success" } : null;
  })();
  /**
   * Mọi điều kiện thật do BE kiểm. Lỗi `BASELINE_BLOCKED` / `REJECTION_COMMENTS_OPEN` mang `meta` chỉ
   * đúng chỗ phải xử lý, nên đẩy người dùng sang panel tương ứng thay vì chỉ hiện câu lỗi.
   */
  const runBaselineAction = async (action: (baseVersion: number) => Promise<unknown>) => {
    const baseVersion = getBaseVersion();
    if (baseVersion === null) {
      setBaselineError(t("page.baselineNotLoaded"));
      return;
    }
    setBaselineBusy(true);
    setBaselineError(null);
    setBaselineBlockingFlags([]);
    try {
      await action(baseVersion);
      await Promise.all([spineState.reload(), comments.reload()]);
      // FLF-318: duyệt baseline ⇒ dự án có thể đã sang mode 1
      signalProjectModeMaybeChanged();
    } catch (err) {
      setBaselineError(userErrorMessage(err, t("page.baselineFailed")));
      if (err instanceof ApiClientError && err.code === "BASELINE_BLOCKED") {
        // Lượt quét ở mức ký (`at_baseline`) của BE vừa MỞ RA cờ mới và ghi vào Spine. Không tải lại thì
        // panel vẫn hiện danh sách cờ cũ (thường là rỗng) trong khi câu lỗi nói "còn cờ đỏ" — nhìn như app
        // nói dối. `meta.flags[]` là nguồn chuẩn cho đúng lượt này nên giữ luôn để hiện ngay tên việc phải làm.
        setBaselineBlockingFlags((err.meta as { flags?: BlockingFlag[] } | undefined)?.flags ?? []);
        await spineState.reload();
        openIssues();
      }
      if (err instanceof ApiClientError && err.code === "REJECTION_COMMENTS_OPEN") {
        openComments((err.meta as { comment_ids?: string[] } | undefined)?.comment_ids);
      }
    } finally {
      setBaselineBusy(false);
    }
  };
  const editLockKey = editLockReason({
    mode1,
    submission: spine?.baseline_submission,
    runnerBusy: runner.state.busy,
    runnerNeedsInput: runner.state.status === "needs_input",
  });
  const editDisabledReason = editLockKey ? t(`editLock.${editLockKey}`) : null;
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
    // Bỏ bản xem trước ⇒ kết thúc vòng hỏi đáp thêm / xoá use case (lệnh sau mở lại từ đầu)
    useCaseTurnsRef.current = null;
    cancelPreview();
    setEditCardOpen(false);
    setEditDetailOpen(false);
    setAppliedEdit(null);
    if (!mode1) setEditMode(false);
  };
  /** Bật chip sửa và đưa con trỏ vào ô chat — `prefill` điền sẵn chỗ cần sửa (nút "Sửa mục này" trên tài liệu). */
  const startEditing = (prefill?: string) => {
    if (editDisabledReason) {
      setToast(editDisabledReason);
      return;
    }
    setEditMode(true);
    setKnowledgeMode(false);
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
    // Chừa chỗ cho tài liệu ở bề rộng còn đọc được + panel phải đang mở
    max: () => Math.min(1000, mainWidth() - (rightPanel ? panel.width : 0) - DOC_COMFORT),
    measure: (x) => {
      const el = document.getElementById("flintflow-chat-pane");
      return el ? x - el.getBoundingClientRect().left : null;
    },
  });

  /**
   * Mở panel phải thì **co bớt khung kéo được** để lấy chỗ, thay vì đẩy nội dung ra khỏi màn hình.
   *
   * Khung chat đã tự co (`shrink min-w-[320px]`), nhưng cột Brief và panel phải đều `shrink-0` nên trên
   * màn hẹp tổng bề rộng vượt viewport và phần thừa bị cắt mất — trước đây người dùng phải tự zoom
   * trình duyệt mới đọc được panel.
   *
   * Trần này **tạm thời**: đóng panel là bề rộng user đã kéo quay lại nguyên vẹn, không ghi đè lựa chọn
   * của họ trong localStorage.
   */
  useEffect(() => {
    if (rightPanel === null) {
      chat.capTo(null);
      brief.capTo(null);
      return;
    }
    const taken = (railShown ? rail.width : 0) + panel.width;
    if (briefPane && !briefHidden) {
      // Pha Brief: chat co giãn (flex-1), cột tóm tắt mới là cái cố định ⇒ co nó
      brief.capTo(viewport - taken - CHAT_MIN);
      chat.capTo(null);
    } else {
      // Pha tài liệu: pane tài liệu co giãn, khung chat cố định ⇒ co khung chat
      chat.capTo(viewport - taken - DOC_MIN);
      brief.capTo(null);
    }
  }, [rightPanel, viewport, railShown, rail.width, panel.width, briefPane, briefHidden, chat, brief]);

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
  /** FLF-265: ngôn ngữ tài liệu client đã biết — mode 1 chưa biết ngôn ngữ file ⇒ `null`, không gọi thêm BE. */
  const documentLanguage = knownDocumentLanguage(ws.project);
  /**
   * BUG-03: vòng S-5 của màn đang để trống — panel Tiến độ mở lại được, thay vì khoá cứng 5 bước.
   * Chỉ S-5.1 là chỗ vào: chạy nó đưa màn về `in_progress` và các bước còn lại tự tới lượt.
   */
  const reopenableStepIds = new Set([
    ...(spine?.screens ?? []).filter((screen) => screen.detail_status === "placeholder").map((screen) => `S-5.1@${screen.id}`),
    // Section đã cũ: cờ chỉ về step sở hữu, và step đó chạy lại được dù đã chốt (BE cho phép). Không mở
    // đường này thì cờ đỏ chặn baseline chỉ còn nước Waive.
    ...flags
      .filter((f) => !f.resolved_at && (f.rule_id === "section_stale_at_baseline" || f.rule_id === "section_awaiting_reaccept"))
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
   * Thao tác ở cổng duyệt như một lượt của user trong lịch sử. Đồng ý / làm lại giữ đúng câu BE ghi transcript (hiện ra
   * theo ngôn ngữ giao diện qua `displayUserText`); câu thay cho ghi chú trống theo ngôn ngữ giao diện.
   */
  const gateActionText = (action: GateAction, note?: string): string => {
    const text = (note ?? "").trim();
    switch (action) {
      case "accept":
        return ACCEPT_USER_TEXT;
      case "regenerate":
        return REGENERATE_USER_TEXT;
      case "revision":
        return text || t("userText.wantEdit");
      case "accept_as_is":
        return text ? t("userText.acceptAsIs", { note: text }) : t("userText.acceptAsIsEmpty");
    }
  };

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
    const said = gateActionText(action, note);
    if (spoken) ws.appendLocalMessage(spoken, runnerStep, "ai");
    ws.appendLocalMessage(said, runnerStep);
    void runner.gate(action, note).then((outcome) => {
      if (outcome === "ok") {
        // FLF-318: Accept S-9.5 là ký baseline ⇒ dự án có thể đã sang mode 1
        if (runnerStep?.startsWith("S-9.5")) signalProjectModeMaybeChanged();
        return;
      }
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
      .filter((f) => f.level === level && !f.resolved_at && (level === "red" || !f.waived_by_user) && f.rule_id !== "unconfirmed_assumption")
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
    const said = t("userText.fixFlag", { message: flag.message });
    ws.appendLocalMessage(said, runnerStep);
    void runner.gate("revision", said).then((outcome) => {
      if (outcome !== "ok") ws.dropLocalMessage(said);
    });
  };

  /** Mở hộp "Dịch tài liệu"; `status` đã đọc sẵn thì hộp khỏi đọc lại lần đầu. */
  const openTranslate = (status?: TranslationStatus) => {
    setTranslateStatus(status);
    setTranslateOpen(true);
  };

  /**
   * FLF-265 §3.7 (D15): câu gõ là lệnh đổi ngôn ngữ tài liệu ⇒ KHÔNG gửi cho AI (dù là tin chat, lượt chạy bước hay lệnh
   * sửa) — AI sẽ viết lại chữ Spine sang ngôn ngữ khác, trong khi Spine phải giữ tiếng Anh và bản dịch nằm ở lớp overlay.
   * Hiện thẻ xác nhận trong chat thay vào. Viewer / câu không phải lệnh ⇒ `false`, nơi gọi gửi như cũ.
   * Đính kèm đang chờ được giữ nguyên trong ô chat (chưa tải lên): "Gửi như tin nhắn" mang chúng đi cùng câu, còn đổi
   * ngôn ngữ thì chúng ở lại cho tin nhắn kế tiếp.
   */
  const interceptLanguageCommand = (text: string, via: LanguageCommandState["via"], intent?: RunIntent): boolean => {
    const target = parseLanguageCommand(text);
    // FLF-318: dự án tạo SRS đã chốt baseline chạy ở mode 1 nhưng không phải dự án tải file lên ⇒ vẫn đổi được ngôn ngữ
    const languageLocked = mode1 && ws.project?.converted_from !== "fpt";
    const kind = languageCommandOutcome({ target, canEdit, mode1: languageLocked, current: documentLanguage });
    if (target === null || kind === "send") return false;
    const id = ++languageCommandSeq.current;
    ws.setInputMessage("");
    setLanguageCommand({ id, kind, text: text.trim(), target, via, ...(intent ? { intent } : {}), status: null, busy: false, error: null });
    // Đã ở đúng ngôn ngữ mà khác ngôn ngữ gốc: đọc ước tính để mời dịch nốt phần còn thiếu (lỗi ⇒ thẻ không có nút đó)
    if (kind === "same" && target !== MODE2_SOURCE_LANGUAGE) {
      void getTranslationStatus(projectId).then(
        (res) => setLanguageCommand((prev) => (prev?.id === id && res.data ? { ...prev, status: res.data } : prev)),
        () => undefined
      );
    }
    return true;
  };

  /** Lệnh sửa (chip "Sửa tài liệu") cũng đi qua bước chặn — lệnh dịch không được thành một lệnh sửa gửi cho AI. */
  const sendEditInstruction = (text: string) => {
    if (interceptLanguageCommand(text, "edit")) return;
    if (!mode1) return submitEditInstruction(text);
    // FLF-318: chưa có CR đang mở mà lệnh là thêm / xoá use case (hoặc đang trả lời câu hỏi của lệnh đó) ⇒ đi đúng vòng hỏi
    // đáp + bản xem trước như trước baseline (màn riêng / popup, ai xử lý, giữ / bỏ use case đề xuất, xoá cả luồng); xong
    // thì "Tạo change request" mang bản xem trước đó. Lệnh khác vẫn mở CR thẳng trong chat như cũ.
    if (!crChat.detail && !crChat.pending && (useCaseTurnsRef.current || editUseCaseIntent(text))) {
      useCaseTurnsRef.current = [...(useCaseTurnsRef.current ?? []), text.trim()];
      return submitEditInstruction(text);
    }
    void crChat.send(text);
  };

  /** "Gửi như tin nhắn": đúng câu đã gõ, đúng đường ban đầu, bỏ qua bước chặn. */
  const sendLanguageCommandAsMessage = () => {
    if (!languageCommand) return;
    const { text, via, intent } = languageCommand;
    setLanguageCommand(null);
    if (via === "chat") void sendFromChat(text, intent, true);
    else if (mode1) void crChat.send(text);
    else submitEditInstruction(text);
  };

  /** Đóng thẻ không làm gì: trả câu về ô chat (nếu ô đang trống) để user sửa lại. */
  const dismissLanguageCommand = () => {
    if (!languageCommand) return;
    if (!ws.inputMessage.trim()) ws.setInputMessage(languageCommand.text);
    setLanguageCommand(null);
  };

  /**
   * "Đồng ý": `PATCH document-language` ⇒ project mới vào workspace (chip + khoá tải lại tài liệu đổi theo) ⇒ đích khác
   * ngôn ngữ gốc và còn mục chưa dịch thì mở hộp "Dịch tài liệu" với ước tính vừa đọc (user xác nhận credit ở đó).
   */
  const confirmLanguageSwitch = async () => {
    const command = languageCommand;
    if (!command || command.kind !== "switch") return;
    setLanguageCommand({ ...command, busy: true, error: null });
    try {
      const res = await setDocumentLanguage(projectId, command.target);
      const next = res.data ?? (ws.project ? { ...ws.project, documentLanguage: command.target } : null);
      if (next) ws.replaceProject(next);
    } catch (err) {
      setLanguageCommand((prev) =>
        prev?.id === command.id ? { ...prev, busy: false, error: userErrorMessage(err, t("page.languageSwitchFailed")) } : prev
      );
      return;
    }
    setLanguageCommand((prev) => (prev?.id === command.id ? null : prev));
    setDocumentRefreshToken((v) => v + 1);
    setToast(t("toasts.languageSwitched", { language: tLanguage(command.target) }));
    if (command.target === MODE2_SOURCE_LANGUAGE) return;
    const status = await getTranslationStatus(projectId).then(
      (res) => res.data,
      () => null
    );
    if (status && status.missing > 0) openTranslate(status);
  };

  /**
   * Tin chat thường mà BE nhận là lệnh sửa ("Bổ sung: …") trả kèm bản xem trước ⇒ mở thẻ sửa với nút Áp dụng. Trước đây
   * chat chỉ hiện "…bấm Áp dụng để ghi" mà không có nút nào (E2E FAP #4).
   */
  const sendChat = async (custom?: string) => {
    const instruction = (custom ?? ws.inputMessage).trim();
    const data = await ws.sendMessage(currentStep, custom);
    const preview = chatChangePreview(data);
    if (!preview) return;
    pendingInstructionRef.current = instruction;
    changes.adoptPreview(preview, instruction);
    setAppliedEdit(null);
    setEditDetailOpen(false);
    setEditCardOpen(true);
  };

  const sendFromChat = async (custom?: string, intent?: RunIntent, asMessage = false) => {
    // FLF-265 §3.7: chặn lệnh đổi ngôn ngữ tài liệu trước MỌI nhánh gửi (mode 1, phiên phụ, trả lời, cổng, chạy bước)
    if (!asMessage && interceptLanguageCommand(custom ?? ws.inputMessage, "chat", intent)) return;
    // FLF-279 §1.2: BE xử lý lượt tri thức TRƯỚC lượt chờ trả lời của step và trước lệnh sửa, và chốt
    // 409 CHANGE_REQUIRES_CR của mode 1 không áp. Rẽ ở đây để FE theo đúng thứ tự đó — đặt muộn hơn thì
    // ở mode 1 câu hỏi bị đẩy vào CR, còn ở `needs_input` nó bị tính là câu trả lời của bước.
    //
    // `intent` / `asMessage` là các lối gửi do code dựng (chip mở đầu, lệnh đổi ngôn ngữ gửi lại thành
    // tin): chúng mang ý định riêng, không phải câu user gõ để hỏi, nên không đi nhánh này.
    if (knowledgeMode && !asMessage && intent === undefined) {
      // Hợp đồng chỉ cho lượt tri thức đi trước lượt CHỜ trả lời; nó không nói gì về lúc step đang
      // chạy. Gửi lúc đó thì `onFinish` thay cả session bằng bản BE và các tin runner vừa chèn tại chỗ
      // biến mất khỏi khung chat.
      if (aiWorking) {
        setToast(t("toasts.aiBusyAsk"));
        return;
      }
      // Chip tự tắt sau một lượt: mỗi lượt BE chỉ nhận một câu hỏi và không đọc lịch sử chat.
      setKnowledgeMode(false);
      return void (await ws.sendMessage(currentStep, custom, { knowledge: true }));
    }
    if (mode1) return void (await ws.sendMessage(currentStep, custom));
    // FLF-244: phiên phụ là phiên hỏi đáp — không đụng step runner (BE chặn run/answer/gate ngoài phiên chính)
    if (!onPipelineSession) return sendChat(custom);
    if (aiWorking) {
      setToast(t("toasts.aiBusyChat"));
      return;
    }
    const raw = (custom ?? ws.inputMessage).trim();
    const status = runner.state.status;
    const toRun = stepNotStarted || (reopenable && status === "idle");
    if (status !== "needs_input" && status !== "gate_ready" && !toRun) return sendChat(custom);
    if (!(await ws.uploadPendingAttachments())) return;
    const text = raw || t("session.attachmentOnly");

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
          setToast(t("toasts.gateBlocked"));
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
  /**
   * Bước bị hoà giải đưa về chờ duyệt (`revision_requested`) mà nội dung vẫn đúng: duyệt nguyên trạng, không bắt AI soạn lại.
   * Chỉ có "Cập nhật lại bước này" thì mỗi lần duyệt lại AI viết khác đi đôi chút ⇒ mục khác thành "cũ" ⇒ hoà giải ⇒ lại chờ
   * duyệt — vòng không hội tụ (E2E FAP #20). BE vốn cho `accept` ở trạng thái này.
   */
  const keepStepAsIs = async (stepId: string) => {
    const sessionId = ws.pipelineSession?._id;
    const baseVersion = getBaseVersion();
    if (!sessionId || baseVersion === null) return;
    setKeepingStep(true);
    try {
      const res = await submitGate(projectId, stepId, { session_id: sessionId, action: "accept", base_version: baseVersion });
      onSpineChanged(res.data?.spine_version);
      setToast(t("toasts.stepKept", { step: stepLabel(stepId, locale) }));
    } catch (err) {
      onSpineChanged();
      setToast(userErrorMessage(err, t("page.keepStepFailed")));
    } finally {
      setKeepingStep(false);
    }
  };

  const noticeText = (notice: WorkspaceNotice): string => {
    if ("text" in notice) return notice.text;
    if (notice.key === "deleteFailed") return t("session.deleteFailed", { error: notice.error ?? t("session.error") });
    return t(`session.${notice.key}`);
  };
  const shownToast = toast ?? (ws.notice ? noticeText(ws.notice) : null);

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
        <ResizeHandle active={rail.resizing} onStart={rail.startResize} onReset={rail.reset} label={t("page.resizeRail")} />
      </Collapse>

      <div className="flex-1 min-w-0 flex flex-col">
      {/* z-20: menu tài khoản trong header nổi trên dải mờ của các pane bên dưới */}
      <Collapse open={!focusMode} className="relative z-20">
        <WorkspaceHeader
          project={ws.project}
          user={ws.user}
          baselineStatus={baselineStatus}
          progressHidden={!mode1 && !railShown}
          onShowProgress={toggleProgress}
          // FLF-221: không còn nút chạy — gõ chat là chạy
          currentStep={mode1 ? null : currentStep}
          onBackToCurrent={!mode1 && viewedStep !== currentStep ? () => setSelectedStepId(null) : undefined}
          onExportClick={() => setExportOpen((v) => !v)}
          // Mode 1: gap report, change request, so sánh version mở dạng popup ngay trên màn tài liệu
          // (`?panel=gap|cr|compare`)
          actions={
            mode1 ? (
              <>
                <Link href={gapReportHref(projectId)} scroll={false} className={MODE1_ACTION}>
                  {t("page.gapReport")}
                </Link>
                <Link href={crListHref(projectId)} scroll={false} className={MODE1_ACTION}>
                  {t("page.changeRequest")}
                </Link>
                <Link href={compareHref(projectId)} scroll={false} className={MODE1_ACTION}>
                  {t("page.compareVersions")}
                </Link>
              </>
            ) : undefined
          }
          onEnterFocus={() => setFocusMode(true)}
          // Mode 1 chốt bản qua release gói CR, không có panel kiểm tra + chốt baseline
          onVerifyClick={mode1 ? undefined : () => (rightPanel === "verification" ? setRightPanel(null) : openIssues())}
          verifyActive={rightPanel === "verification"}
          verifyCount={documentIssues.blocking}
          onToolsClick={() => togglePanel("tools")}
          toolsActive={rightPanel === "tools"}
          toolsLabel={mode1 ? t("page.toolsMode1") : t("page.toolsRecord")}
          toolsShortLabel={mode1 ? undefined : t("page.toolsRecordShort")}
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
          title={mode1 ? t("page.chatTitleMode1") : undefined}
          width={chat.width}
          fill={briefHidden || briefPane}
          session={ws.activeSession}
          stepLabel={!mode1 && viewedStep ? stepLabel(viewedStep, locale) : null}
          stepCode={!mode1 ? viewedStep : null}
          inputMessage={ws.inputMessage}
          setInputMessage={ws.setInputMessage}
          onSendMessage={(custom) => void sendFromChat(custom)}
          sending={ws.sending || (!mode1 && aiWorking)}
          // Nút dừng / Esc: lượt chat đang stream ⇒ huỷ nó; không thì lượt chạy step của tab này ⇒ huỷ như "Huỷ lượt".
          // Step chạy ở tab khác (`stepRunningElsewhere`) không dừng từ đây — vẫn qua thanh tiến độ.
          onStop={ws.sending ? ws.stopMessage : !mode1 && runner.state.busy ? () => void runner.cancel() : undefined}
          inputPlaceholder={
            !mode1 && !onPipelineSession
              ? t("page.placeholderSide")
              : !mode1 && aiWorking
              ? t("page.placeholderWorking")
              : !mode1 && gate
                ? t("page.placeholderGate")
                : !mode1 && stepNotStarted
                  ? t("page.placeholderStart")
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
          onEditInstruction={sendEditInstruction}
          onGoToPipeline={ws.pipelineSession ? () => void ws.selectSession(ws.pipelineSession!) : undefined}
          readOnlyNotice={canEdit ? undefined : t("page.viewerNotice")}
          editPlaceholder={mode1 ? crChat.inputHint : undefined}
          editMode={editMode}
          onToggleEditMode={() => (editMode ? setEditMode(false) : startEditing())}
          editDisabledReason={editDisabledReason}
          knowledgeMode={knowledgeMode}
          onToggleKnowledgeMode={
            canEdit
              ? () => {
                  // Tắt tri thức ⇒ trả `editMode` về mặc định của chế độ dự án, không để nó nằm lại
                  // `false`: ở mode 1, chat im lặng thôi đã là chat sửa-qua-CR.
                  if (knowledgeMode) {
                    setKnowledgeMode(false);
                    setEditMode(mode1);
                    return;
                  }
                  setEditMode(false);
                  setKnowledgeMode(true);
                }
              : undefined
          }
          knowledgeHidden={ws.knowledgeDisabled}
          knowledgePending={ws.knowledgePending}
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
            <div
              ref={staleCardRef}
              onAnimationEnd={(e) => e.currentTarget.classList.remove("ff-flash")}
              className="bg-accent-gold-soft rounded-control p-3 flex flex-col gap-2 text-body text-accent-gold-text">
              <p className="leading-relaxed">
                {t.rich("page.staleNotice", {
                  step: stepLabel(viewedStep, locale),
                  sections: staleSectionsOfViewed.map((id) => sectionLabels.get(id) ?? id).join(", "),
                  strong: (chunks) => <strong>{chunks}</strong>,
                })}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => void rerunStaleStep(viewedStep)}
                  className="h-8 px-3.5 rounded-control text-body font-bold bg-primary text-on-primary hover:bg-primary-hover cursor-pointer"
                >
                  {t("page.rerunStep")}
                </button>
                {viewedSummary?.status === "revision_requested" && (
                  <button
                    type="button"
                    disabled={keepingStep}
                    onClick={() => void keepStepAsIs(viewedStep)}
                    className="h-8 px-3.5 rounded-control text-body font-bold bg-surface text-on-surface hover:bg-surface-container-low cursor-pointer disabled:opacity-50"
                  >
                    {keepingStep ? t("page.keeping") : t("page.keepAsIs")}
                  </button>
                )}
              </div>
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
              canSignOff={ws.orgRole === "lead"}
              newFlags={newGateFlags}
              onFixFlag={fixFlagByChat}
              // FLF-329: cờ đỏ ⇒ giữ nguyên + lý do (vẫn chặn); cờ vàng ⇒ bỏ qua
              onKeepFlag={(flag, reason) => (flag.level === "red" ? handleFlagKeep(flag.id, reason) : handleFlagWaive(flag.id, reason))}
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
                {t("page.close")}
              </button>
            </div>
          )}
          {!mode1 && canEdit && onPipelineSession && runner.state.status === "interrupted" && !runner.state.error && runner.state.stepId && (
            // Lượt chết giữa chừng (reload, mất mạng): nút "Chạy lại" là lối duy nhất còn lại để chạy bước này (FLF-221)
            <div role="alert" className="bg-error-container rounded-control p-3 text-body text-error flex flex-wrap items-center gap-2">
              <span className="flex-1 min-w-0">{t("page.interrupted")}</span>
              <button
                type="button"
                onClick={() => void handleErrorAction({ kind: "retry", label: t("page.rerun") })}
                className="px-2.5 py-1 rounded-full text-body font-bold bg-error text-on-error cursor-pointer"
              >
                {t("page.rerun")}
              </button>
            </div>
          )}
          {runner.state.error && (
            // BUG-25: lỗi nói bằng tiếng Việt kèm việc làm được. Đây là NƠI DUY NHẤT nói câu lỗi — nhật ký
            // lượt chạy phía trên cố ý im, vì BE trả câu đã viết cho người nên nhắc lại chỉ thành tiếng vọng.
            <div role="alert" className="bg-error-container rounded-control p-3 text-body text-error flex flex-col gap-2">
              <span>{friendlyError(runner.state.error.code, runner.state.error.message, locale).message}</span>
              <div className="flex flex-wrap items-center gap-2">
                {friendlyError(runner.state.error.code, runner.state.error.message, locale).actions.map((action) => (
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
                  {t("page.close")}
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
              error={hookError(changes.error)}
              preview={changes.previewSource === "instruction" ? changes.preview : null}
              applied={appliedEdit}
              requiresCr={mode1}
              onShowDetail={() => setEditDetailOpen(true)}
              onApply={() => {
                // FLF-318: bản xem trước của lệnh thêm / xoá use case ⇒ tạo CR ngay trong chat, kèm đúng bản xem trước
                // và cả đoạn hỏi đáp làm mô tả
                const turns = useCaseTurnsRef.current;
                const previewId = changes.preview?.ok ? changes.preview.preview_id : undefined;
                if (mode1 && turns && previewId) {
                  crChat.startFromPreview(turns[0], describeConversation(turns), previewId);
                  useCaseTurnsRef.current = null;
                  cancelPreview();
                  setEditCardOpen(false);
                  return;
                }
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
                void changes.confirmPreview(undefined, undefined, fixingCommentId).finally(() => setFixingCommentId(null));
              }}
              onCancel={closeEditCard}
              // BR-03 (FLF-294): sau baseline không hoàn tác — gỡ thay đổi là một change request mới
              onUndo={
                (spine?.baselines.length ?? 0) > 0
                  ? undefined
                  : () => {
                      editActionRef.current = "undo";
                      void changes.undo();
                    }
              }
              onDismiss={closeEditCard}
            />
          )}
          {languageCommand && (
            <LanguageCommandCard
              kind={languageCommand.kind}
              text={languageCommand.text}
              target={languageCommand.target}
              sourceLanguage={MODE2_SOURCE_LANGUAGE}
              missing={languageCommand.status?.missing ?? null}
              busy={languageCommand.busy}
              error={languageCommand.error}
              onConfirm={() => void confirmLanguageSwitch()}
              onTranslate={() => {
                const status = languageCommand.status ?? undefined;
                setLanguageCommand(null);
                openTranslate(status);
              }}
              onSendAsMessage={sendLanguageCommandAsMessage}
              onCancel={dismissLanguageCommand}
            />
          )}
        </ChatPane>

        {briefHidden ? null : briefPane ? (
          <ResizeHandle active={brief.resizing} onStart={brief.startResize} onReset={brief.reset} label={t("page.resizeBrief")} />
        ) : (
          <ResizeHandle active={chat.resizing} onStart={chat.startResize} onReset={chat.reset} label={t("page.resizeChat")} />
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
          onEditSection={canEdit ? (label) => startEditing(t("userText.editSection", { label })) : undefined}
          issues={documentIssues}
          onOpenIssues={() => (rightPanel === "verification" && !issueSectionId ? setRightPanel(null) : openIssues())}
          onOpenSectionIssues={(sectionId) => openIssues(sectionId)}
          // Góp ý ghim vào mục (UC-49) — Viewer cũng góp ý được (BR-05: comment không đổi nội dung),
          // nhưng chỉ trên bản đã phát hành, nên ở bản nháp chỉ mở cho Lead/Analyst.
          onCommentSection={canEdit ? startComment : undefined}
          commentCountOf={(sectionId) => comments.openCountBySection.get(sectionId) ?? 0}
          onOpenSectionComments={() => openComments()}
          rewriteError={!editCardOpen ? hookError(changes.error) : null}
          onSectionsLoaded={handleSectionsLoaded}
          // Mode 1 v3: tài liệu chỉ đổi qua change request — không vẽ lại thẳng.
          // Tạm ẩn nút "Vẽ lại sơ đồ" dưới hình: bật lại bằng REDRAW_SECTION_ENABLED.
          onRedrawSection={mode1 || !REDRAW_SECTION_ENABLED ? undefined : (sectionId) => redrawDiagrams(diagramsOfSection(sectionId))}
          hasDiagrams={(sectionId) => diagramsOfSection(sectionId).length > 0}
          // Nút thoát mở rộng (trước nằm đầu rail công cụ) — giữ nguyên icon, đặt cuối header tài liệu
          headerEnd={focusMode ? <IconButton icon="collapse" label={t("page.exitFocus")} onClick={() => setFocusMode(false)} /> : undefined}
          documentLanguage={documentLanguage}
          // Dịch tốn credit ⇒ chỉ Lead/Analyst; mode 1 giữ ngôn ngữ file, không dịch (D3)
          onTranslate={!mode1 && canEdit ? () => setTranslateOpen(true) : undefined}
        />
        )}

        <Collapse axis="x" open={rightPanel !== null}>
        <ResizeHandle active={panel.resizing} onStart={panel.startResize} onReset={panel.reset} label={t("page.resizePanel")} />
        <div id="workspace-right-panel" style={{ width: panel.width }} className="h-full shrink-0">
        {shownPanel === "tools" && spine && (
          <aside className="w-full h-full bg-surface-container flex flex-col overflow-hidden" aria-label={mode1 ? t("page.toolsMode1") : t("page.toolsRecord")}>
            <div className="ff-fade-below [--ff-fade:var(--color-surface-container)] h-12 pl-4 pr-2 bg-surface-container flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <Icon name="folder" size={16} className="text-primary" />
                <h3 className="font-bold text-body text-on-surface truncate">{mode1 ? t("page.toolsMode1") : t("page.toolsRecord")}</h3>
              </div>
              <IconButton icon="close" size="sm" label={t("page.closeRecord")} onClick={() => setRightPanel(null)} />
            </div>
            <div className="flex-1 overflow-y-auto ff-scroll p-4 flex flex-col gap-3">
            {mode1 && (
              <Mode1WorkspaceTools
                projectId={projectId}
                projectName={ws.project?.name}
                flags={flags}
                onSpineChanged={() => onSpineChanged()}
                readOnly={!canEdit}
                canRelease={ws.orgRole === "lead"}
                orgRole={ws.orgRole}
              />
            )}
            {/* Ghi Spine thẳng (`/changes`) — mode 1 v3 mọi sửa qua CR nên không hiện */}
            {!mode1 && (
              <ProjectRecordPanel
                projectId={projectId}
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
            // Bản đồ truy vết chọn thực thể từ Spine đang mở — không gọi thêm request
            spine={spine ?? undefined}
            issues={{
              sectionLabelOf: (id) => sectionLabels.get(id),
              onShowSection: showSection,
              focusSectionId: issueSectionId,
              // "Hoà giải" cũ: gom các mục đã cũ, AI viết lại cho khớp, xem trước rồi áp (mode 1 sửa qua CR nên không có)
              outdatedCount: outdatedSections,
              onRewriteOutdated: canEdit
                ? () => {
                    editActionRef.current = "outdated";
                    void changes.reconcileOnce();
                  }
                : undefined,
              rewriting: changes.applying && changes.previewSource !== "instruction",
              onEditSection: canEdit ? (label) => startEditing(t("userText.editSection", { label })) : undefined,
              acceptedSteps,
            }}
            readiness={progress?.readiness ?? null}
            flags={flags}
            flagsLoading={flagsLoading}
            flagsError={hookError(flagsError)}
            flagsBusy={flagsBusy}
            onClose={() => setRightPanel(null)}
            // Mode 1 v3: không có step, không sửa thẳng giả định — cờ chỉ đóng bằng change request
            onSelectStep={mode1 ? undefined : setSelectedStepId}
            onWaive={mode1 || !canEdit ? undefined : handleFlagWaive}
            onKeep={!canEdit ? undefined : handleFlagKeep}
            onRedraw={canEdit ? handleRedrawDiagram : undefined}
            onAssumptionDecision={mode1 || !canEdit ? undefined : (decision) => void applyAssumptionDecision(decision)}
            onConfirmAllAssumptions={mode1 || !canEdit ? undefined : (ids) => void confirmAllAssumptions(ids)}
            onRecompute={canEdit ? handleFlagRecompute : undefined}
            // Mode 1 chốt bản qua release gói CR (UC-52), không đi đường nộp/duyệt baseline 1.0
            baseline={
              mode1
                ? undefined
                : {
                    role: ws.orgRole,
                    submission: spine?.baseline_submission ?? null,
                    blocking: documentIssues.blocking,
                    blockingFlags: baselineBlockingFlags,
                    comments: comments.comments,
                    busy: baselineBusy,
                    error: baselineError,
                    onSubmit: () => runBaselineAction((v) => submitBaseline(projectId, v)),
                    onApprove: () => runBaselineAction((v) => createBaseline(projectId, v)),
                    onReject: (reason, ids) => runBaselineAction((v) => rejectBaseline(projectId, v, reason, ids)),
                    onOpenComments: openComments,
                  }
            }
          />
        )}

        {shownPanel === "comments" && (
          <CommentsPanel
            comments={comments.comments}
            loading={comments.loading}
            error={hookError(comments.error)}
            busy={comments.busy}
            canResolve={canEdit}
            pendingAnchor={pendingComment}
            onCancelPending={() => setPendingComment(null)}
            onSubmit={submitComment}
            onResolve={resolveComment}
            onShowSection={showSection}
            onFixByChat={canEdit && !mode1 ? fixCommentByChat : undefined}
            focusCommentIds={focusCommentIds}
            onClearFocus={() => setFocusCommentIds(null)}
            onClose={() => setRightPanel(null)}
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

      {shownToast && (
        <div
          role="status"
          className="fixed top-5 left-1/2 -translate-x-1/2 z-50 bg-[#191817] text-white text-body font-semibold px-4 py-2 rounded-full shadow-[0_10px_30px_rgba(0,0,0,0.25)] flex items-center gap-3"
        >
          <span>{shownToast}</span>
          <button
            type="button"
            onClick={() => {
              setToast(null);
              ws.clearNotice();
            }}
            className="text-caption underline cursor-pointer"
          >
            {t("page.close")}
          </button>
        </div>
      )}

      {/* Diff đầy đủ: lệnh sửa (bấm "Xem chi tiết") hoặc lượt cập nhật mục đã cũ (nút trên header tài liệu) */}
      {changes.preview && changes.previewSource === "instruction" && editDetailOpen && mode1 && (
        <CreateCrPreviewModal
          projectId={projectId}
          preview={changes.preview}
          instruction={changes.pendingInstruction}
          spine={spineState.spine}
          onCancel={() => setEditDetailOpen(false)}
        />
      )}
      {changes.preview && ((changes.previewSource === "instruction" && editDetailOpen && !mode1) || changes.previewSource === "reconcile") && (
        <DiffPreviewModal
          preview={changes.preview}
          spine={spineState.spine}
          busy={changes.applying}
          confirmLabel={changes.previewSource === "reconcile" ? t("page.confirmUpdate") : t("page.confirmApply")}
          onCancel={() => (changes.previewSource === "reconcile" ? changes.cancelPreview() : setEditDetailOpen(false))}
          onConfirm={(reason, changeRequest) => {
            editActionRef.current = changes.previewSource === "reconcile" ? "outdated" : "instruction";
            void changes.confirmPreview(reason, changeRequest, fixingCommentId).finally(() => setFixingCommentId(null));
          }}
        />
      )}

      {exportOpen && (
        <ExportPanel
          projectId={projectId}
          projectName={documentName}
          flags={flags}
          onClose={() => setExportOpen(false)}
          documentLanguage={documentLanguage}
          // Hai lớp phủ không chồng nhau: đóng hộp xuất rồi mới mở hộp dịch
          onTranslate={
            !mode1 && canEdit
              ? () => {
                  setExportOpen(false);
                  setTranslateOpen(true);
                }
              : undefined
          }
        />
      )}

      {!mode1 && canEdit && (
        <TranslateDialog
          projectId={projectId}
          open={translateOpen}
          initialStatus={translateStatus}
          onClose={() => {
            setTranslateOpen(false);
            setTranslateStatus(undefined);
          }}
          onDone={handleTranslated}
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
