"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import Collapse from "@/components/ui/Collapse";
import Icon from "@/components/ui/Icon";
import IconButton from "@/components/ui/IconButton";
import Skeleton from "@/components/ui/Skeleton";
import { isImportPending } from "@/lib/import-pending";
import { chooseProjectUploadVersion, dismissProjectUpload, retryProjectUpload, useProjectUploads } from "@/lib/project-uploads";
import { STEP_REGISTRY } from "@/lib/constants/step-registry";
import type { StepSummary } from "@/types/pipeline";
import type { Project } from "@/types/project";
import type { User } from "@/types/user";
import { useWorkspaceBoot } from "../../workspace-boot";
import type { UseDocumentResult } from "../hooks/useDocument";
import AiSettingsMenu from "./AiSettingsMenu";
import BriefPanel from "./BriefPanel";
import ChatPane from "./ChatPane";
import ChatSessionHistory from "./ChatSessionHistory";
import DocumentPane from "./DocumentPane";
import ImportSkeleton from "./import/import-skeleton";
import { CreationProgressShell } from "./import/creation-progress";
import { compareHref, crListHref, gapReportHref, reuploadHref } from "./mode1/prefill";
import ResizeHandle from "./ResizeHandle";
import WorkspaceHeader from "./WorkspaceHeader";
import WorkspaceProgressRail from "./WorkspaceProgressRail";
import {
  BRIEF_DEFAULT_WIDTH,
  BRIEF_MIN,
  BRIEF_WIDTH_KEY,
  CHAT_DEFAULT_WIDTH,
  CHAT_MIN,
  CHAT_WIDTH_KEY,
  MODE1_ACTION,
  PANEL_DEFAULT_WIDTH,
  PANEL_MIN,
  PANEL_WIDTH_KEY,
  RAIL_DEFAULT_WIDTH,
  RAIL_MIN,
  RAIL_WIDTH_KEY,
  readSavedProgressOpen,
  readSavedWidth,
} from "./workspace-layout";

const noop = () => undefined;
// localStorage không phát sự kiện trong cùng tab — chỉ cần đọc lại sau hydrate, không cần đăng ký
const subscribeNothing = () => () => {};

/** Danh sách bước dựng từ registry (chưa có trạng thái) ⇒ rail vẽ thật tên nhóm + tên giai đoạn trong lúc chờ tiến độ. */
const REGISTRY_STEPS: StepSummary[] = STEP_REGISTRY.map((step) => ({
  id: step.id,
  phase: step.phase,
  label_vi: step.label_vi,
  label_en: step.label_en,
  kind: step.kind,
  status: "pending",
  deterministic: step.deterministic,
  calls_used: 0,
  calls_limit: 8,
  regenerate_used: 0,
  regenerate_limit: 3,
  accepted_at: null,
  running: false,
}));

/** Tài liệu "đang tải lần đầu" cho `DocumentPane` thật (header thật, thân là dòng giữ chỗ). */
const LOADING_DOCUMENT: UseDocumentResult = {
  document: null,
  meta: null,
  translation: null,
  loading: true,
  refreshing: false,
  refreshError: null,
  lastDiff: null,
  pendingSectionIds: new Set(),
  markPending: noop,
  clearPending: noop,
  empty: false,
  error: null,
  reload: async () => undefined,
};

/** Bề rộng đã lưu: HTML server dùng mặc định, ngay sau hydrate đọc bản đã kéo. */
const useSavedWidth = (key: string, fallback: number, min: number) =>
  useSyncExternalStore(subscribeNothing, () => readSavedWidth(key, fallback, min), () => fallback);

/** Tin nhắn đang tải: lượt AI (trái, rộng) xen lượt người dùng (phải, hẹp) — cùng nhịp với khung chat thật. */
function ChatMessagesSkeleton({ label }: { label: string }) {
  return (
    <div role="status" aria-busy="true" aria-label={label} className="flex flex-col gap-6">
      {[0, 1, 2, 3].map((i) =>
        i % 2 ? (
          <Skeleton key={i} className="self-end h-12 w-3/5 rounded-card" />
        ) : (
          <div key={i} className="flex flex-col gap-2">
            <Skeleton className="h-3.5 w-full" />
            <Skeleton className="h-3.5 w-11/12" />
            <Skeleton className="h-3.5 w-2/3" />
          </div>
        )
      )}
    </div>
  );
}

/**
 * Workspace lúc đang tải — dùng CẢ khi còn chờ đăng nhập (khung chờ của `app/projects/layout.tsx`) LẪN khi trang đã chạy mà dự
 * án / tiến độ chưa về (`page.tsx`) ⇒ chỉ một nấc. Dựng bằng chính các component thật (header với đúng nút của loại dự án,
 * rail với tên giai đoạn, khung chat với tiêu đề + ô nhập, Brief / tài liệu, panel Công cụ của dự án nhập SRS); chỉ dữ liệu
 * là khối giữ chỗ. Bố cục theo bản nhớ của dự án mở gần nhất (`lib/workspace-memory`): loại dự án, tên, giai đoạn, khung phải.
 */
export default function WorkspaceLoading({ projectId, viewer = false }: { projectId: string; /** Đã biết là Viewer (đang chuyển sang trang đọc) ⇒ không vẽ ô nhập. */ viewer?: boolean }) {
  const t = useTranslations("workspace");
  const tCr = useTranslations("mode1.crChat");
  const boot = useWorkspaceBoot();
  const memory = boot.memory?.id === projectId ? boot.memory : null;
  // Dự án đang ở màn đọc file SRS ⇒ đúng skeleton của màn đó. Snapshot server = cookie server đã đọc ⇒ HTML đầu khớp
  const importPending = useSyncExternalStore(
    subscribeNothing,
    () => isImportPending(projectId),
    () => boot.importPendingIds.includes(projectId)
  );
  // Tab này vừa tạo dự án và đang tải file ⇒ hiện ngay các bước tích dần thay vì skeleton
  const uploads = useProjectUploads(projectId);
  const railOpen = useSyncExternalStore(subscribeNothing, readSavedProgressOpen, () => true);
  const railWidth = useSavedWidth(RAIL_WIDTH_KEY, RAIL_DEFAULT_WIDTH, RAIL_MIN);
  const chatWidth = useSavedWidth(CHAT_WIDTH_KEY, CHAT_DEFAULT_WIDTH, CHAT_MIN);
  const panelWidth = useSavedWidth(PANEL_WIDTH_KEY, PANEL_DEFAULT_WIDTH, PANEL_MIN);
  const briefWidth = useSavedWidth(BRIEF_WIDTH_KEY, BRIEF_DEFAULT_WIDTH, BRIEF_MIN);

  if (uploads?.items.some((i) => i.kind === "srs" && i.status !== "done")) {
    return (
      <CreationProgressShell
        uploads={uploads}
        onRetry={(key) => retryProjectUpload(projectId, key)}
        onChoose={(key, choice) => chooseProjectUploadVersion(projectId, key, choice)}
        onDismiss={(key) => dismissProjectUpload(projectId, key)}
      />
    );
  }
  if (importPending) return <ImportSkeleton label={t("page.loading")} />;

  const mode1 = memory?.mode === "import";
  // Như trang thật: Viewer không sửa được; chưa biết vai trò ⇒ coi như sửa được (Viewer bị đẩy sang trang đọc ngay sau đó)
  const canEdit = !viewer && boot.orgRole !== "viewer";
  const pane = mode1 ? "document" : (memory?.pane ?? "none");
  const railShown = !mode1 && railOpen;
  const project = { _id: projectId, name: memory?.name ?? "" } as Project;
  const user = boot.profileName ? ({ name: boot.profileName } as User) : null;
  const toolsLabel = mode1 ? t("page.toolsMode1") : t("page.toolsRecord");

  return (
    <div aria-busy="true" className="h-screen flex overflow-hidden bg-surface-container-lowest font-sans">
      <Collapse axis="x" open={railShown} className="relative z-30">
        <div style={{ width: railWidth }} className="h-full shrink-0">
          <WorkspaceProgressRail
            onHide={noop}
            currentPhase={memory?.phase ?? null}
            steps={REGISTRY_STEPS}
            progress={null}
            selectedStepId={null}
            onSelectStep={noop}
          />
        </div>
        <ResizeHandle active={false} onStart={noop} onReset={noop} label={t("page.resizeRail")} />
      </Collapse>

      <div className="flex-1 min-w-0 flex flex-col">
        <div className="relative z-20">
          <WorkspaceHeader
            project={project}
            user={user}
            nameLoading={!memory}
            progressHidden={!mode1 && !railShown}
            onShowProgress={noop}
            onExportClick={noop}
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
                  {canEdit && (
                    <Link href={reuploadHref(projectId)} scroll={false} className={MODE1_ACTION}>
                      {t("page.reupload")}
                    </Link>
                  )}
                </>
              ) : undefined
            }
            onEnterFocus={noop}
            onVerifyClick={mode1 ? undefined : noop}
            onToolsClick={noop}
            toolsActive={mode1}
            toolsLabel={toolsLabel}
            toolsShortLabel={mode1 ? undefined : t("page.toolsRecordShort")}
            onLogout={noop}
          />
        </div>

        <main className="flex-1 min-h-0 flex overflow-hidden bg-surface-container-lowest">
          <ChatPane
            flushLeft={!railShown}
            title={mode1 ? t("page.chatTitleMode1") : undefined}
            width={chatWidth}
            fill={pane !== "document"}
            session={null}
            inputMessage=""
            setInputMessage={noop}
            onSendMessage={noop}
            sending={false}
            pendingAttachments={[]}
            onSelectAttachment={noop}
            onRemoveAttachment={noop}
            headerStart={
              <ChatSessionHistory
                sessions={[]}
                activeSessionId={null}
                readOnly={!canEdit}
                onSelectSession={noop}
                onCreateSession={noop}
                onDeleteSession={noop}
              />
            }
            emptyState={<ChatMessagesSkeleton label={t("page.loading")} />}
            readOnlyNotice={canEdit ? undefined : t("page.viewerNotice")}
            editMode={mode1}
            onEditInstruction={noop}
            editPlaceholder={mode1 ? tCr("hintNew") : undefined}
            onToggleEditMode={noop}
            onToggleKnowledgeMode={canEdit ? noop : undefined}
            inputTools={canEdit ? <AiSettingsMenu reviewMode={memory?.review ?? "balanced"} onChangeReviewMode={noop} /> : undefined}
          />

          {pane === "brief" ? (
            <>
              <ResizeHandle active={false} onStart={noop} onReset={noop} label={t("page.resizeBrief")} />
              <BriefPanel spine={null} updating={false} width={briefWidth} />
            </>
          ) : pane === "document" ? (
            <>
              <ResizeHandle active={false} onStart={noop} onReset={noop} label={t("page.resizeChat")} />
              <DocumentPane projectId={projectId} projectName={memory?.name} doc={LOADING_DOCUMENT} mode1={mode1} />
            </>
          ) : null}

          {/* Dự án nhập SRS mở sẵn panel Công cụ: tiêu đề thật, nội dung giữ chỗ */}
          {mode1 && (
            <>
              <ResizeHandle active={false} onStart={noop} onReset={noop} label={t("page.resizePanel")} />
              <div style={{ width: panelWidth }} className="h-full shrink-0">
                <ToolsPanelFrame title={toolsLabel} closeLabel={t("page.closeRecord")} onClose={noop}>
                  <ToolsPanelSkeleton />
                </ToolsPanelFrame>
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}

/** Khung panel Công cụ: tiêu đề + nút đóng, thân cuộn. Trang thật và khung đang tải dùng chung. */
export function ToolsPanelFrame({
  title,
  closeLabel,
  onClose,
  children,
}: {
  title: string;
  closeLabel: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <aside className="w-full h-full bg-surface-container flex flex-col overflow-hidden" aria-label={title}>
      <div className="ff-fade-below [--ff-fade:var(--color-surface-container)] h-12 pl-4 pr-2 bg-surface-container flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <Icon name="folder" size={16} className="text-primary" />
          <h3 className="font-bold text-body text-on-surface truncate">{title}</h3>
        </div>
        <IconButton icon="close" size="sm" label={closeLabel} onClick={onClose} />
      </div>
      <div className="flex-1 overflow-y-auto ff-scroll p-4 flex flex-col gap-3">{children}</div>
    </aside>
  );
}

/** Thân panel Công cụ lúc dữ liệu chưa về. */
export function ToolsPanelSkeleton() {
  return (
    <div aria-hidden className="flex flex-col gap-3">
      <Skeleton className="h-4 w-40" />
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-5/6" />
      <Skeleton className="mt-2 h-28 w-full rounded-card" />
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-20 w-full rounded-card" />
    </div>
  );
}
