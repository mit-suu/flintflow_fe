"use client";

import { useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAppShell } from "@/components/layout/AppShell";
import TopBar from "@/components/layout/TopBar";
import AddToFolderDialog from "@/components/project/AddToFolderDialog";
import CreateProjectForm from "@/components/project/CreateProjectForm";
import FolderCard, { NewFolderTile } from "@/components/project/FolderCard";
import FolderDialogs, { type FolderDialogTarget } from "@/components/project/FolderDialogs";
import ProjectActionDialogs, { type ProjectActionTarget } from "@/components/project/ProjectActionDialogs";
import ProjectGrid, { CARD_GRID, ProjectGridSkeleton } from "@/components/project/ProjectGrid";
import ProjectTimeline, { type ProjectSort } from "@/components/project/ProjectTimeline";
import { BackLink, Button, CountBadge, EmptyState, FilterSelect, Icon, Modal, SearchInput, STICKY_BLEED, STICKY_FADE, Tabs } from "@/components/ui";
import { listCrs } from "@/lib/api/change-requests";
import { moveProjectsToFolder } from "@/lib/api/folders";
import { getProgress } from "@/lib/api/pipeline";
import { cachedOpenCrs, cachedProgress, rememberOpenCrs } from "@/lib/progress-cache";
import { listProjectsPage, moveProjectToFolder, type ProjectListSort } from "@/lib/api/projects";
import { useActiveOrganization } from "@/lib/hooks/use-active-org";
import { useDebounce } from "@/lib/hooks/use-debounce";
import { useInfiniteList } from "@/lib/hooks/use-infinite-list";
import { projectsErrorText, useProjects } from "@/lib/hooks/use-projects";
import { SOURCE_MODE_OPTIONS, getProjectStartRoute } from "@/lib/project-source-mode";
import { CR_TERMINAL_STATUSES } from "@/types/change-request";
import type { Folder } from "@/types/folder";
import type { ProgressResponse } from "@/types/pipeline";
import type { Project, ProjectMode, ProjectStatus } from "@/types/project";
import { userErrorMessage } from "@/lib/api/error-messages";

type ModeFilter = ProjectMode | "all";
type DashboardTab = "all" | "folders" | "projects";

const STATUS_VALUES: readonly ProjectStatus[] = ["active", "archived"];
const SORT_VALUES: readonly ProjectSort[] = ["updated", "opened"];
/** Số thẻ mỗi trang — chia hết cho 2 / 3 / 4 cột của lưới. */
const PAGE_SIZE = 24;

/**
 * Tiêu đề mục dính ngay dưới thanh tab khi cuộn, và nhả ra khi cuộn hết mục (sticky trong `<section>` cha).
 * `--toolbar-h` do trang đo từ thanh tab thật (xuống dòng trên mobile ⇒ cao hơn). z trên nút ⋮ của card (z-20).
 * Chỉ âm margin phía trên: đệm dưới 8px + gap của mục chứa trọn dải mờ `STICKY_FADE`, nên lúc chưa dính dải mờ
 * không phủ lên nội dung. Gợi ý (`hint`) nằm cùng hàng tiêu đề vì lý do đó.
 */
function SectionTitle({ id, title, count, hint }: { id: string; title: string; count?: number; hint?: string }) {
  return (
    // `z-[27]` phải CAO HƠN `z-[26]` mà `FolderCard` tự nâng lên lúc hover: thẻ cuộn chui xuống dưới tiêu đề
    // mà rê chuột vào thì nó nhảy đè lên, che mất tiêu đề. Tiêu đề có nền đặc nên thẻ khuất gọn bên dưới —
    // đổi lại bóng đổ của thẻ bị nền tiêu đề cắt, nhưng lúc đó thẻ đã khuất một nửa, cái bóng không ai thấy.
    <div className={`sticky top-[var(--toolbar-h,0px)] z-[27] -mt-2 py-2 bg-surface-container-lowest flex items-center gap-2 ${STICKY_BLEED} ${STICKY_FADE}`}>
      <h2 id={id} className="text-title sm:text-title font-semibold text-on-surface tracking-tight">
        {title}
      </h2>
      {count !== undefined && <CountBadge count={count} max={999} />}
      {hint && <p className="hidden sm:block ml-2 text-body text-on-surface-muted truncate">{hint}</p>}
    </div>
  );
}

/**
 * Project Dashboard (UC-13/14/15/16/19/75). Tab: **Tất cả** = thư mục + dự án ngoài thư mục; **Thư mục**; **Dự án** =
 * mọi dự án chia vùng thời gian. Mở một thư mục ⇒ chỉ dự án trong đó + "Thêm dự án". Kéo card vào thẻ thư mục để chuyển.
 *
 * FLF-404: dự án **tải dần khi cuộn** (`useInfiniteList`), lọc trạng thái / nguồn / thư mục, tìm tên (không dấu) và sắp xếp
 * chạy ở BE — lọc trên mấy trang đã tải sẽ ra kết quả sai. Thư mục ít nên vẫn tải hết và lọc tại chỗ.
 */
export default function HomePage() {
  const t = useTranslations("app.home");
  const tc = useTranslations("app.common");
  const tMode = useTranslations("app.sourceMode");
  const tLoad = useTranslations("app.home.loadErrors");
  const tList = useTranslations("common.dataTable");
  const router = useRouter();
  const { activeCount, hasProjects, folders, loading, error, foldersError, reload: reloadSummary } = useProjects();
  // "Dịch tài liệu" sau khi đổi ngôn ngữ dự án (FLF-265) trừ credit ngay trên trang ⇒ chip số dư phải tải lại
  const { reloadBalance } = useAppShell();
  // Viewer chỉ xem: không tạo/sửa/chuyển/xoá dự án hay thư mục (BE cũng chặn ghi với 403). Chưa biết vai trò ⇒ coi
  // như được — cùng quy ước với trang thanh toán, lỡ bấm thì BE vẫn chặn.
  const canAuthor = useActiveOrganization()?.role !== "viewer";

  const [tab, setTab] = useState<DashboardTab>("all");
  const [sortBy, setSortBy] = useState<ProjectSort>("updated");
  const [status, setStatus] = useState<ProjectStatus>("active");
  const [mode, setMode] = useState<ModeFilter>("all");
  const [query, setQuery] = useState("");
  const [openFolderId, setOpenFolderId] = useState<string | null>(null);
  /** Vùng cuộn của trang — gốc để dò "đã cuộn gần cuối". State (không phải ref) để đọc được lúc render. */
  const [scrollEl, setScrollEl] = useState<HTMLDivElement | null>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const [createOpen, setCreateOpen] = useState(false);
  // Số file đang chọn trong hộp Tạo dự án (chưa gửi) — đóng hộp khi còn file thì hỏi trước, đóng là mất file
  const [createPendingFiles, setCreatePendingFiles] = useState(0);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const closeCreate = () => {
    setConfirmDiscard(false);
    setCreatePendingFiles(0);
    setCreateOpen(false);
  };
  const requestCloseCreate = () => (createPendingFiles > 0 ? setConfirmDiscard(true) : closeCreate());
  const [addTarget, setAddTarget] = useState<Folder | null>(null);
  const [actionTarget, setActionTarget] = useState<ProjectActionTarget | null>(null);
  const [folderTarget, setFolderTarget] = useState<FolderDialogTarget | null>(null);
  const [dropError, setDropError] = useState<string | null>(null);
  /** Chọn nhiều: bật bằng nút "Chọn"; tắt khi rời thư mục / đổi bộ lọc để không giữ lựa chọn đã khuất mắt. */
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(new Set());
  /**
   * T23: thẻ dự án hiện việc tiếp theo và trạng thái theo Spine thật. `GET /projects` chỉ trả document
   * Project (không có tiến độ), nên nạp `progress` riêng cho từng dự án — song song, và **lỗi của một
   * dự án không làm hỏng lưới**: dự án chưa có Spine trả `null` và hiện "Chưa bắt đầu".
   */
  // Bắt đầu từ số đã biết trong tab (vào workspace rồi quay lại không chớp "Đang tải…"); mỗi thẻ cập nhật ngay khi request của nó
  // về — không chờ dự án chậm nhất
  const [progressById, setProgressById] = useState<Record<string, ProgressResponse | null>>(cachedProgress);
  /** Mode 1: số change request đang mở (UC-14) — lỗi của một dự án không làm hỏng lưới. */
  const [openCrsById, setOpenCrsById] = useState<Record<string, number>>(cachedOpenCrs);

  // Dự án tải dần ⇒ chỉ hỏi tiến độ / CR cho thẻ mới về, không hỏi lại thẻ đã có
  const progressRequested = useRef(new Set<string>());

  const folderById = useMemo(() => new Map(folders.map((f) => [f._id, f])), [folders]);
  // Thư mục đang mở bị xoá (ở tab khác / vừa xoá) ⇒ tự về dashboard
  const openFolder = openFolderId ? folderById.get(openFolderId) ?? null : null;

  const normalizedQuery = query.trim().toLocaleLowerCase("vi");
  // Gõ liên tục chỉ gọi BE một lần sau khi dừng gõ (thư mục vẫn lọc ngay tại chỗ)
  const q = useDebounce(query.trim(), 300);
  // Tab Thư mục mà có từ khoá ⇒ hiện luôn dự án khớp (kể cả trong thư mục)
  const showProjects = openFolder !== null || tab !== "folders" || normalizedQuery.length > 0;

  // Phạm vi theo ngữ cảnh: trong thư mục · tab Dự án (mọi dự án) · tab Tất cả (ngoài thư mục; có từ khoá ⇒ tìm cả trong thư mục)
  const folderScope = openFolder ? openFolder._id : tab === "projects" || q ? undefined : "none";
  // Tab Dự án chia vùng thời gian theo mốc đang chọn ⇒ BE sắp đúng mốc đó để trang sau nối tiếp vùng cuối; lưới: mới tạo trước
  const listSort: ProjectListSort = tab === "projects" && !openFolder ? sortBy : "created";
  // Tách từng giá trị: `sentinelRef` là callback ref gắn vào JSX — để chung một object thì lint coi cả object là ref
  const {
    items: visible,
    total: listTotal,
    loading: listLoading,
    loadingMore,
    error: listError,
    loadMoreError,
    hasMore,
    retry,
    reload: reloadList,
    sentinelRef,
  } = useInfiniteList<Project>({
    key: [status, mode, q, folderScope ?? "*", listSort].join("|"),
    // Đang mở một thư mục vừa bị xoá ⇒ chờ về dashboard, không hỏi BE thư mục không còn
    enabled: showProjects && !(openFolderId && !openFolder),
    root: scrollEl,
    fetchPage: (page) =>
      listProjectsPage({ page, limit: PAGE_SIZE, status, mode: mode === "all" ? undefined : mode, q: q || undefined, sort: listSort, folder: folderScope }),
  });

  /** Sau thao tác trên dự án / thư mục: tải lại danh sách từ trang 1 và tóm tắt (số đếm, sidebar, thư mục). */
  const reload = async () => {
    progressRequested.current.clear();
    reloadList();
    await reloadSummary();
  };

  useEffect(() => {
    const fresh = visible.filter((p) => !progressRequested.current.has(p._id));
    if (fresh.length === 0) return;
    for (const p of fresh) progressRequested.current.add(p._id);
    let cancelled = false;
    for (const project of fresh) {
      getProgress(project._id)
        .then((res) => res.data ?? null)
        // Lỗi: giữ số đã biết; chưa biết gì ⇒ `null` ("Chưa bắt đầu") để thẻ không kẹt ở "Đang tải…"
        .catch(() => undefined)
        .then((progress) => {
          if (cancelled) return;
          setProgressById((cur) => {
            const next = progress === undefined ? (cur[project._id] ?? null) : progress;
            return cur[project._id] === next ? cur : { ...cur, [project._id]: next };
          });
        });
    }
    for (const project of fresh.filter((p) => p.mode === "import" && p.import_state !== null)) {
      listCrs(project._id)
        .then((res) => (res.data ?? []).filter((c) => !CR_TERMINAL_STATUSES.includes(c.status)).length)
        .catch(() => 0)
        .then((count) => {
          rememberOpenCrs(project._id, count);
          if (!cancelled) setOpenCrsById((cur) => (cur[project._id] === count ? cur : { ...cur, [project._id]: count }));
        });
    }
    return () => {
      cancelled = true;
    };
  }, [visible]);

  // Lỗi tóm tắt (sidebar, số đếm) hoặc lỗi tải trang đầu của danh sách — chuỗi rỗng từ BE ⇒ câu chung
  const loadError = error ? projectsErrorText(error, tLoad) : listError ? userErrorMessage(listError) || tLoad("projectsLoadFailed") : null;
  const filtersActive = status !== "active" || mode !== "all" || normalizedQuery.length > 0;
  const initialLoading = loading && !hasProjects && folders.length === 0;
  // Chưa có dự án lẫn thư mục ⇒ tạo dự án ngay trên trang
  const showOnboarding = !initialLoading && !error && !hasProjects && folders.length === 0;
  // Đo chiều cao thật của thanh tab dính ⇒ `--toolbar-h` để tiêu đề mục dính ngay bên dưới (ghi thẳng CSS, không re-render)
  useEffect(() => {
    const toolbar = toolbarRef.current;
    const scroller = scrollEl;
    if (!toolbar || !scroller) return;
    const sync = () => scroller.style.setProperty("--toolbar-h", `${toolbar.offsetHeight}px`);
    sync();
    if (typeof ResizeObserver === "undefined") return; // jsdom/trình duyệt cũ: đo một lần là đủ
    const observer = new ResizeObserver(sync);
    observer.observe(toolbar);
    return () => observer.disconnect();
  }, [showOnboarding, scrollEl]);
  const showFolders = !openFolder && tab !== "projects";
  const visibleFolders = normalizedQuery ? folders.filter((f) => f.name.toLocaleLowerCase("vi").includes(normalizedQuery)) : folders;
  // Tab Dự án hiện cả dự án trong thư mục ⇒ ghi tên thư mục trên card
  const folderNameOf = (p: Project) => (p.folderId ? folderById.get(p.folderId)?.name ?? null : null);

  const statusOptions = STATUS_VALUES.map((value) => ({ value, label: t(value === "active" ? "statusActive" : "statusArchived") }));
  const sortOptions = SORT_VALUES.map((value) => ({ value, label: t(value === "updated" ? "sortUpdated" : "sortOpened") }));
  const modeOptions: readonly { value: ModeFilter; label: string }[] = [
    { value: "all", label: t("modeAll") },
    ...SOURCE_MODE_OPTIONS.map((o) => ({ value: o.value as ModeFilter, label: tMode(`${o.key}.shortLabel`) })),
  ];

  const clearFilters = () => {
    setStatus("active");
    setMode("all");
    setQuery("");
  };

  const handleCreated = async (project: Project) => {
    // Vào dự án ngay (file đang tải nền). Không đọc lại danh sách ở đây: trang chủ đang rời đi, còn lượt đọc lại kéo theo request
    // tiến trình của từng dự án chen với lượt tải + đọc khung file SRS (BE chậm hẳn); quay lại trang chủ thì danh sách tự đọc mới
    router.push(getProjectStartRoute(project._id));
  };

  const handleDropProject = async (folder: Folder, projectId: string) => {
    if (visible.find((p) => p._id === projectId)?.folderId === folder._id) return;
    setDropError(null);
    try {
      await moveProjectToFolder(projectId, folder._id);
      await reload();
    } catch (err) {
      setDropError(userErrorMessage(err, t("moveFailed")));
    }
  };

  // Chỉ thao tác trên dự án đang thấy: lọc/tìm đổi thì lựa chọn khuất mắt cũng biến mất theo
  const selectedProjects = visible.filter((p) => selectedIds.has(p._id));

  const endSelecting = () => {
    setSelectMode(false);
    setSelectedIds(new Set());
  };

  const removeSelectedFromFolder = async () => {
    setDropError(null);
    try {
      await moveProjectsToFolder(selectedProjects, null);
      await reload();
      endSelecting();
    } catch (err) {
      setDropError(userErrorMessage(err, t("removeFailed")));
    }
  };

  const openAction = (action: ProjectActionTarget["action"]) => (project: Project) => setActionTarget({ action, project });
  const gridProps = {
    progressById,
    openCrsById,
    onRename: openAction("rename"),
    onDelete: openAction("archive"),
    onHardDelete: openAction("delete"),
    onMoveToFolder: (project: Project) => setFolderTarget({ kind: "move", projects: [project] }),
    onChangeDocumentLanguage: openAction("documentLanguage"),
    onChangeErdNotation: openAction("erdNotation"),
    selectable: selectMode,
    selectedIds,
    onToggleSelect: (project: Project) =>
      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (!next.delete(project._id)) next.add(project._id);
        return next;
      }),
    readOnly: !canAuthor,
  };

  const projectsBody = initialLoading || listLoading ? (
    <ProjectGridSkeleton />
  ) : visible.length > 0 ? (
    <>
      {tab === "projects" && !openFolder ? (
        <ProjectTimeline projects={visible} sortBy={sortBy} folderNameOf={folderNameOf} {...gridProps} />
      ) : (
        <ProjectGrid projects={visible} draggable={canAuthor && !openFolder && folders.length > 0} folderNameOf={normalizedQuery ? folderNameOf : undefined} {...gridProps} />
      )}
      {/* Cuối danh sách: khung giữ chỗ lúc tải trang kế, lỗi kèm nút thử lại, mốc kích tải trang kế */}
      {loadingMore && <ProjectGridSkeleton />}
      {loadMoreError ? (
        <div role="alert" className="flex flex-wrap items-center justify-center gap-3 py-3 text-body text-on-surface-muted">
          {tList("loadMoreFailed")}
          <Button size="sm" variant="secondary" onClick={retry}>
            {tList("retry")}
          </Button>
        </div>
      ) : null}
      {hasMore && <div ref={sentinelRef} aria-hidden className="h-px" />}
      <p className="sr-only" aria-live="polite">
        {tList("shown", { shown: visible.length, total: listTotal })}
      </p>
    </>
  ) : loadError ? null : filtersActive ? (
    <EmptyState
      icon="search"
      title={t("noMatchTitle")}
      description={t("noMatchBody")}
      action={
        <Button variant="secondary" size="sm" onClick={clearFilters}>
          {t("clearFilters")}
        </Button>
      }
    />
  ) : (
    // Rỗng mà không lọc gì ⇒ hiện sẵn form tạo dự án (chọn cách bắt đầu + tên) ngay tại chỗ, không bắt user tự tìm nút "Dự án mới"
    <div className="flex flex-col gap-5">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h3 className="text-heading font-bold text-on-surface">
            {openFolder
              ? t("emptyFolderTitle")
              : tab === "all" && status === "active" && folders.some((f) => f.projectCount > 0)
                ? t("allInFoldersTitle")
                : t("emptyTitle")}
          </h3>
          <p className="text-body text-on-surface-muted leading-[1.55]">
            {!canAuthor ? t("viewerEmptyBody") : openFolder ? t("emptyFolderBody") : t("emptyBody")}
          </p>
        </div>
        {!openFolder && (
          <Button variant="secondary" size="sm" className="self-start shrink-0" onClick={() => setStatus("archived")}>
            {t("viewArchived")}
          </Button>
        )}
      </div>
      {canAuthor && <CreateProjectForm variant="inline" onCreated={handleCreated} folderId={openFolder?._id} />}
    </div>
  );

  return (
    <>
      <TopBar
        trail={openFolder ? [t("projectsTitle"), openFolder.name] : [t("projectsTitle")]}
        search={<SearchInput value={query} onChange={setQuery} label={t("searchLabel")} placeholder={t("searchPlaceholder")} />}
        actions={
          canAuthor ? (
            <Button size="sm" icon="plus" onClick={() => setCreateOpen(true)}>
              <span className="hidden sm:inline">{t("newProject")}</span>
              <span className="sm:hidden">{t("newProjectShort")}</span>
            </Button>
          ) : undefined
        }
      />

      <div
        ref={setScrollEl}
        // `pb-12`: chừa khoảng thở ở đáy, cuộn hết trang thì dòng cuối không dính sát mép dưới khung nhìn
        className="flex-1 overflow-y-auto overflow-x-hidden flex flex-col gap-4 px-4 sm:px-6 lg:px-8 pb-scroll-end bg-surface-container-lowest"
      >
        {showOnboarding ? (
          <section aria-labelledby="onboarding-title" className="w-full max-w-[920px] mx-auto flex flex-col gap-6 pt-6 pb-2 sm:pt-12 sm:pb-6">
            <div className="flex flex-col gap-2">
              <h1 id="onboarding-title" className="text-title sm:text-metric font-bold text-on-surface tracking-tight">
                {canAuthor ? t("onboardingTitle") : t("viewerEmptyTitle")}
              </h1>
              <p className="text-body text-on-surface-muted leading-[1.6] max-w-[560px]">
                {canAuthor ? t("onboardingBody") : t("viewerEmptyBody")}
              </p>
            </div>
            {canAuthor && <CreateProjectForm variant="inline" onCreated={handleCreated} />}
          </section>
        ) : (
          <>
            {/* Thanh điều hướng (dính khi cuộn): tab ở gốc, hoặc quay lại + thêm dự án khi đang trong thư mục */}
            <div
              ref={toolbarRef}
              className={`sticky top-0 z-30 py-3 bg-surface-container-lowest flex flex-col lg:flex-row lg:items-center justify-between gap-3 ${STICKY_BLEED} ${STICKY_FADE}`}
            >
              {selectMode ? (
                <>
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-body font-semibold text-on-surface" aria-live="polite">
                      {t("selectedCount", { count: selectedIds.size })}
                    </span>
                    <Button size="sm" variant="secondary" onClick={() => setSelectedIds(new Set(visible.map((p) => p._id)))} disabled={selectedIds.size === visible.length}>
                      {t("selectAll")}
                    </Button>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button size="sm" variant="secondary" icon="folder" onClick={() => setFolderTarget({ kind: "move", projects: selectedProjects })} disabled={selectedProjects.length === 0}>
                      {t("moveSelected")}
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => void removeSelectedFromFolder()} disabled={!selectedProjects.some((p) => p.folderId)}>
                      {t("removeFromFolder")}
                    </Button>
                    <Button size="sm" onClick={endSelecting}>
                      {t("doneSelecting")}
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  {openFolder ? (
                    <div className="flex items-center gap-3 min-w-0">
                      <BackLink tone="white" onClick={() => { setOpenFolderId(null); endSelecting(); }}>
                        {t("allProjects")}
                      </BackLink>
                      {canAuthor && (
                        <Button size="sm" variant="secondary" icon="plus" onClick={() => setAddTarget(openFolder)}>
                          {t("addExisting")}
                        </Button>
                      )}
                    </div>
                  ) : (
                    <Tabs
                      label={t("tabsLabel")}
                      idBase="dashboard"
                      value={tab}
                      onChange={(next) => { setTab(next); endSelecting(); }}
                      options={[
                        { value: "all", label: t("tabAll") },
                        { value: "folders", label: t("tabFolders"), count: folders.length },
                        { value: "projects", label: t("tabProjects"), count: activeCount },
                      ]}
                      className="self-start"
                    />
                  )}
                  {showProjects && (
                    <div className="flex flex-wrap items-center gap-2">
                      {canAuthor && visible.length > 0 && (
                        <Button size="sm" variant="secondary" icon="check" onClick={() => setSelectMode(true)}>
                          {t("select")}
                        </Button>
                      )}
                      {tab === "projects" && !openFolder && (
                        <FilterSelect label={t("sortLabel")} value={sortBy} options={sortOptions} onChange={setSortBy} />
                      )}
                      <FilterSelect label={t("statusLabel")} value={status} options={statusOptions} onChange={setStatus} />
                      <FilterSelect label={t("modeLabel")} value={mode} options={modeOptions} onChange={setMode} />
                    </div>
                  )}
                </>
              )}
            </div>

            {(loadError || dropError) && (
              <div role="alert" className="flex items-center gap-3 bg-error-container border border-error-border text-on-error-container px-4 py-3 rounded-control text-body font-medium">
                <Icon name="error-circle" size={18} />
                <span className="flex-1">{loadError ?? dropError}</span>
                <Button size="sm" variant="secondary" onClick={() => (loadError ? void reload() : setDropError(null))}>
                  {loadError ? tc("retry") : tc("close")}
                </Button>
              </div>
            )}

            <div
              role={openFolder ? undefined : "tabpanel"}
              id={openFolder ? undefined : "dashboard-panel"}
              aria-labelledby={openFolder ? undefined : `dashboard-tab-${tab}`}
              className="flex flex-col gap-8"
            >
              {/* Viewer không tạo được thư mục ⇒ chưa có thư mục nào thì bỏ hẳn mục (tiêu đề trơ trọi, không có gì bên dưới) */}
              {showFolders && !initialLoading && (canAuthor || folders.length > 0) && (
                <section aria-labelledby="folders-title" className="flex flex-col gap-3">
                  <SectionTitle
                    id="folders-title"
                    title={t("foldersTitle")}
                    count={folders.length}
                    hint={folders.length > 0 && tab === "all" ? t("foldersHint") : undefined}
                  />
                  {foldersError && (
                    <p role="alert" className="text-body text-on-error-container">
                      {t("foldersError", { message: projectsErrorText(foldersError, tLoad) })}
                    </p>
                  )}
                  <div className={CARD_GRID}>
                    {/* Ô tạo mới đứng đầu: luôn ở cùng một chỗ, không bị đẩy xuống khi thư mục nhiều lên */}
                    {canAuthor && <NewFolderTile onCreate={() => setFolderTarget({ kind: "create" })} />}
                    {visibleFolders.map((folder) => (
                      <FolderCard
                        key={folder._id}
                        folder={folder}
                        onOpen={(f) => { setOpenFolderId(f._id); endSelecting(); }}
                        onRename={(f) => setFolderTarget({ kind: "rename", folder: f })}
                        onDelete={(f) => setFolderTarget({ kind: "delete", folder: f })}
                        onDropProject={canAuthor ? (f, id) => void handleDropProject(f, id) : undefined}
                        readOnly={!canAuthor}
                      />
                    ))}
                  </div>
                </section>
              )}

              {showProjects && (
                <section aria-labelledby="projects-title" className="flex flex-col gap-4">
                  <SectionTitle
                    id="projects-title"
                    title={openFolder ? openFolder.name : tab === "all" && !normalizedQuery ? t("looseProjectsTitle") : t("projectsTitle")}
                    count={initialLoading || listLoading ? undefined : listTotal}
                  />
                  {projectsBody}
                </section>
              )}
            </div>
          </>
        )}
      </div>

      <Modal
        open={createOpen}
        onClose={requestCloseCreate}
        title={openFolder ? t("createInFolderTitle", { folder: openFolder.name }) : t("createTitle")}
        size="lg"
      >
        <CreateProjectForm
          variant="dialog"
          onCreated={handleCreated}
          onCancel={requestCloseCreate}
          folderId={openFolder?._id}
          onPendingFilesChange={setCreatePendingFiles}
        />
      </Modal>
      {/* Mở sau hộp Tạo dự án ⇒ nằm trên cùng: Esc / bấm ra ngoài chỉ đóng hộp này (= ở lại), không đóng hộp Tạo dự án */}
      <Modal open={confirmDiscard} onClose={() => setConfirmDiscard(false)} title={t("discardCreate.title")}>
        <p className="text-body text-on-surface-variant leading-relaxed">{t("discardCreate.body", { count: createPendingFiles })}</p>
        <div className="flex flex-wrap justify-end gap-2 mt-6">
          <Button variant="ghost" onClick={() => setConfirmDiscard(false)} data-autofocus>
            {t("discardCreate.stay")}
          </Button>
          <Button variant="danger" onClick={closeCreate}>
            {t("discardCreate.discard")}
          </Button>
        </div>
      </Modal>

      <AddToFolderDialog folder={addTarget} folderIds={new Set(folderById.keys())} onClose={() => setAddTarget(null)} onAdded={reload} />
      <ProjectActionDialogs target={actionTarget} onClose={() => setActionTarget(null)} onDone={reload} onCreditsSpent={reloadBalance} />
      <FolderDialogs
        target={folderTarget}
        folders={folders}
        onClose={() => setFolderTarget(null)}
        onDone={async () => {
          await reload();
          endSelecting();
        }}
      />
    </>
  );
}
