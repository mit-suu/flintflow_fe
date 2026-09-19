"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import TopBar from "@/components/layout/TopBar";
import AddToFolderDialog from "@/components/project/AddToFolderDialog";
import CreateProjectForm from "@/components/project/CreateProjectForm";
import FolderCard, { NewFolderTile } from "@/components/project/FolderCard";
import FolderDialogs, { type FolderDialogTarget } from "@/components/project/FolderDialogs";
import ProjectActionDialogs, { type ProjectActionTarget } from "@/components/project/ProjectActionDialogs";
import ProjectGrid, { CARD_GRID, ProjectGridSkeleton } from "@/components/project/ProjectGrid";
import ProjectTimeline, { type ProjectSort } from "@/components/project/ProjectTimeline";
import { Button, CountBadge, EmptyState, FilterSelect, Icon, Modal, SearchInput, Tabs } from "@/components/ui";
import { getProgress } from "@/lib/api/pipeline";
import { moveProjectToFolder } from "@/lib/api/projects";
import { useProjects } from "@/lib/hooks/use-projects";
import { SOURCE_MODE_OPTIONS, getProjectStartRoute } from "@/lib/project-source-mode";
import type { Folder } from "@/types/folder";
import type { ProgressResponse } from "@/types/pipeline";
import type { Project, ProjectSourceMode, ProjectStatus } from "@/types/project";

type ModeFilter = ProjectSourceMode | "all";
type DashboardTab = "all" | "folders" | "projects";

const STATUS_OPTIONS = [
  { value: "active", label: "Đang làm" },
  { value: "archived", label: "Lưu trữ" },
] as const satisfies readonly { value: ProjectStatus; label: string }[];

const MODE_OPTIONS: readonly { value: ModeFilter; label: string }[] = [
  { value: "all", label: "Tất cả" },
  ...SOURCE_MODE_OPTIONS.map((o) => ({ value: o.value, label: o.shortLabel })),
];

const SORT_OPTIONS = [
  { value: "updated", label: "Mới cập nhật" },
  { value: "opened", label: "Mới mở" },
] as const satisfies readonly { value: ProjectSort; label: string }[];

/**
 * Mép dưới mềm cho phần tử dính (sticky): một dải nền trắng đặc 40% rồi dốc đều về trong suốt, để nội dung cuộn
 * qua mờ dần thay vì bị cắt thẳng. Không có điểm `via` — ép độ mờ ở giữa làm gãy dốc, nhìn ra thành một đường.
 * Dải cao 16px ≈ khoảng cách tiêu đề→card, nên lúc chưa dính không phủ lên nội dung.
 */
const STICKY_FADE =
  "after:content-[''] after:absolute after:inset-x-0 after:top-full after:h-4 after:pointer-events-none after:bg-linear-to-b after:from-surface-container-lowest after:from-40% after:to-transparent";

/**
 * Nền của phần tử dính tràn ra cả lề ngang của vùng cuộn (âm margin = padding của vùng cuộn), để bóng đổ của card
 * cuộn qua bên dưới không lộ ở hai lề thành một viền mờ quanh thanh. Đổi padding vùng cuộn thì đổi cả chỗ này.
 */
const STICKY_BLEED = "-mx-4 px-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8";

/**
 * Tiêu đề mục dính ngay dưới thanh tab khi cuộn, và nhả ra khi cuộn hết mục (sticky trong `<section>` cha).
 * `--toolbar-h` do trang đo từ thanh tab thật (xuống dòng trên mobile ⇒ cao hơn). z trên nút ⋮ của card (z-20).
 * Chỉ âm margin phía trên: đệm dưới 8px + gap của mục chứa trọn dải mờ `STICKY_FADE`, nên lúc chưa dính dải mờ
 * không phủ lên nội dung. Gợi ý (`hint`) nằm cùng hàng tiêu đề vì lý do đó.
 */
function SectionTitle({ id, title, count, hint }: { id: string; title: string; count?: number; hint?: string }) {
  return (
    <div className={`sticky top-[var(--toolbar-h,0px)] z-[25] -mt-2 py-2 bg-surface-container-lowest flex items-center gap-2 ${STICKY_BLEED} ${STICKY_FADE}`}>
      <h2 id={id} className="text-[20px] sm:text-[22px] font-semibold text-on-surface tracking-tight">
        {title}
      </h2>
      {count !== undefined && <CountBadge count={count} max={999} />}
      {hint && <p className="hidden sm:block ml-2 text-[12px] text-on-surface-muted truncate">{hint}</p>}
    </div>
  );
}

/**
 * Project Dashboard (UC-13/14/15/16/19/75). Tab: **Tất cả** = thư mục + dự án ngoài thư mục; **Thư mục**; **Dự án** =
 * mọi dự án chia vùng thời gian. Mở một thư mục ⇒ chỉ dự án trong đó + "Thêm dự án". Kéo card vào thẻ thư mục để chuyển.
 */
export default function HomePage() {
  const router = useRouter();
  const { projects, folders, loading, error, foldersError, reload } = useProjects();

  const [tab, setTab] = useState<DashboardTab>("all");
  const [sortBy, setSortBy] = useState<ProjectSort>("updated");
  const [status, setStatus] = useState<ProjectStatus>("active");
  const [mode, setMode] = useState<ModeFilter>("all");
  const [query, setQuery] = useState("");
  const [openFolderId, setOpenFolderId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [addTarget, setAddTarget] = useState<Folder | null>(null);
  const [actionTarget, setActionTarget] = useState<ProjectActionTarget | null>(null);
  const [folderTarget, setFolderTarget] = useState<FolderDialogTarget | null>(null);
  const [dropError, setDropError] = useState<string | null>(null);
  /**
   * T23: thẻ dự án hiện việc tiếp theo và trạng thái theo Spine thật. `GET /projects` chỉ trả document
   * Project (không có tiến độ), nên nạp `progress` riêng cho từng dự án — song song, và **lỗi của một
   * dự án không làm hỏng lưới**: dự án chưa có Spine trả `null` và hiện "Chưa bắt đầu".
   */
  const [progressById, setProgressById] = useState<Record<string, ProgressResponse | null>>({});

  useEffect(() => {
    if (projects.length === 0) return;
    let cancelled = false;
    void Promise.all(
      projects.map((project) =>
        getProgress(project._id)
          .then((res) => [project._id, res.data ?? null] as const)
          .catch(() => [project._id, null] as const)
      )
    ).then((entries) => {
      if (!cancelled) setProgressById(Object.fromEntries(entries));
    });
    return () => {
      cancelled = true;
    };
  }, [projects]);

  const folderById = useMemo(() => new Map(folders.map((f) => [f._id, f])), [folders]);
  // Thư mục đang mở bị xoá (ở tab khác / vừa xoá) ⇒ tự về dashboard
  const openFolder = openFolderId ? folderById.get(openFolderId) ?? null : null;
  const inFolder = (p: Project) => Boolean(p.folderId && folderById.has(p.folderId));

  const normalizedQuery = query.trim().toLocaleLowerCase("vi");
  const matches = (p: Project) =>
    p.status === status &&
    (mode === "all" || p.sourceMode === mode) &&
    (!normalizedQuery || p.name.toLocaleLowerCase("vi").includes(normalizedQuery));

  // Phạm vi dự án theo ngữ cảnh: trong thư mục · tab Dự án (mọi dự án) · tab Tất cả (ngoài thư mục; có từ khoá ⇒ tìm cả trong thư mục)
  const scoped = openFolder
    ? projects.filter((p) => p.folderId === openFolder._id)
    : tab === "projects" || normalizedQuery
      ? projects
      : projects.filter((p) => !inFolder(p));
  const visible = scoped.filter(matches);
  const scopedCount = scoped.filter((p) => p.status === status).length;

  const filtersActive = status !== "active" || mode !== "all" || normalizedQuery.length > 0;
  const initialLoading = loading && projects.length === 0 && folders.length === 0;
  // Chưa có dự án lẫn thư mục ⇒ tạo dự án ngay trên trang
  const showOnboarding = !initialLoading && !error && projects.length === 0 && folders.length === 0;
  // Đo chiều cao thật của thanh tab dính ⇒ `--toolbar-h` để tiêu đề mục dính ngay bên dưới (ghi thẳng CSS, không re-render)
  useEffect(() => {
    const toolbar = toolbarRef.current;
    const scroller = scrollRef.current;
    if (!toolbar || !scroller) return;
    const sync = () => scroller.style.setProperty("--toolbar-h", `${toolbar.offsetHeight}px`);
    sync();
    if (typeof ResizeObserver === "undefined") return; // jsdom/trình duyệt cũ: đo một lần là đủ
    const observer = new ResizeObserver(sync);
    observer.observe(toolbar);
    return () => observer.disconnect();
  }, [showOnboarding]);
  const showFolders = !openFolder && tab !== "projects";
  // Tab Thư mục mà có từ khoá ⇒ hiện luôn dự án khớp (kể cả trong thư mục)
  const showProjects = openFolder !== null || tab !== "folders" || normalizedQuery.length > 0;
  const visibleFolders = normalizedQuery ? folders.filter((f) => f.name.toLocaleLowerCase("vi").includes(normalizedQuery)) : folders;
  // Tab Dự án hiện cả dự án trong thư mục ⇒ ghi tên thư mục trên card
  const folderNameOf = (p: Project) => (p.folderId ? folderById.get(p.folderId)?.name ?? null : null);

  const clearFilters = () => {
    setStatus("active");
    setMode("all");
    setQuery("");
  };

  const handleCreated = async (project: Project) => {
    await reload();
    router.push(getProjectStartRoute(project._id, project.sourceMode));
  };

  const handleDropProject = async (folder: Folder, projectId: string) => {
    if (projects.find((p) => p._id === projectId)?.folderId === folder._id) return;
    setDropError(null);
    try {
      await moveProjectToFolder(projectId, folder._id);
      await reload();
    } catch (err) {
      setDropError(err instanceof Error ? err.message : "Không thể chuyển dự án vào thư mục");
    }
  };

  const openAction = (action: ProjectActionTarget["action"]) => (project: Project) => setActionTarget({ action, project });
  const gridProps = {
    progressById,
    onRename: openAction("rename"),
    onDelete: openAction("archive"),
    onHardDelete: openAction("delete"),
    onMoveToFolder: (project: Project) => setFolderTarget({ kind: "move", project }),
  };

  const projectsBody = initialLoading ? (
    <ProjectGridSkeleton />
  ) : visible.length > 0 ? (
    tab === "projects" && !openFolder ? (
      <ProjectTimeline projects={visible} sortBy={sortBy} folderNameOf={folderNameOf} {...gridProps} />
    ) : (
      <ProjectGrid projects={visible} draggable={!openFolder && folders.length > 0} folderNameOf={normalizedQuery ? folderNameOf : undefined} {...gridProps} />
    )
  ) : error ? null : filtersActive ? (
    <EmptyState
      icon="search"
      title="Không có dự án khớp bộ lọc"
      description="Thử đổi trạng thái, nguồn hoặc từ khoá tìm kiếm."
      action={
        <Button variant="secondary" size="sm" onClick={clearFilters}>
          Xoá bộ lọc
        </Button>
      }
    />
  ) : (
    // Rỗng mà không lọc gì ⇒ hiện sẵn form tạo dự án (chọn cách bắt đầu + tên) ngay tại chỗ, không bắt user tự tìm nút "Dự án mới"
    <div className="flex flex-col gap-5">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h3 className="text-[15px] font-extrabold text-on-surface">
            {openFolder
              ? "Thư mục này chưa có dự án"
              : tab === "all" && projects.some((p) => inFolder(p) && p.status === status)
                ? "Mọi dự án đều đã nằm trong thư mục"
                : "Chưa có dự án đang làm"}
          </h3>
          <p className="text-[12.5px] text-on-surface-muted leading-[1.55]">
            {openFolder
              ? "Chọn cách bắt đầu để tạo dự án mới ngay trong thư mục, hoặc thêm dự án có sẵn."
              : "Chọn cách bắt đầu để tạo dự án mới, hoặc mở lại các dự án đã lưu trữ."}
          </p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          className="self-start shrink-0"
          onClick={() => (openFolder ? setAddTarget(openFolder) : setStatus("archived"))}
        >
          {openFolder ? "Thêm dự án có sẵn" : "Xem lưu trữ"}
        </Button>
      </div>
      <CreateProjectForm variant="inline" onCreated={handleCreated} folderId={openFolder?._id} />
    </div>
  );

  return (
    <>
      <TopBar
        trail={openFolder ? ["Dự án", openFolder.name] : ["Dự án"]}
        search={<SearchInput value={query} onChange={setQuery} label="Tìm dự án theo tên" placeholder="Tìm dự án…" />}
        actions={
          <Button size="sm" icon="plus" onClick={() => setCreateOpen(true)}>
            <span className="hidden sm:inline">Dự án mới</span>
            <span className="sm:hidden">Mới</span>
          </Button>
        }
      />

      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto overflow-x-hidden flex flex-col gap-4 px-4 sm:px-6 lg:px-8 pb-8 bg-surface-container-lowest"
      >
        {showOnboarding ? (
          <section aria-labelledby="onboarding-title" className="w-full max-w-[920px] mx-auto flex flex-col gap-6 pt-6 pb-2 sm:pt-12 sm:pb-6">
            <div className="flex flex-col gap-2">
              <h1 id="onboarding-title" className="text-[22px] sm:text-[26px] font-extrabold text-on-surface tracking-tight">
                Bắt đầu dự án SRS đầu tiên
              </h1>
              <p className="text-[13.5px] text-on-surface-muted leading-[1.6] max-w-[560px]">
                Chọn nơi bạn bắt đầu — FlintFlow sẽ dẫn bạn qua đúng quy trình cho trường hợp đó.
              </p>
            </div>
            <CreateProjectForm variant="inline" onCreated={handleCreated} />
          </section>
        ) : (
          <>
            {/* Thanh điều hướng (dính khi cuộn): tab ở gốc, hoặc quay lại + thêm dự án khi đang trong thư mục */}
            <div
              ref={toolbarRef}
              className={`sticky top-0 z-30 py-3 bg-surface-container-lowest flex flex-col lg:flex-row lg:items-center justify-between gap-3 ${STICKY_BLEED} ${STICKY_FADE}`}
            >
              {openFolder ? (
                <div className="flex items-center gap-3 min-w-0">
                  <button
                    type="button"
                    onClick={() => setOpenFolderId(null)}
                    className="inline-flex items-center gap-1.5 h-8 px-3 rounded-control text-[12.5px] font-semibold text-on-surface-variant hover:bg-surface-container-high cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    <Icon name="arrow-right" size={14} className="rotate-180" />
                    Tất cả dự án
                  </button>
                  <Button size="sm" variant="secondary" icon="plus" onClick={() => setAddTarget(openFolder)}>
                    Thêm dự án
                  </Button>
                </div>
              ) : (
                <Tabs
                  label="Xem theo"
                  idBase="dashboard"
                  value={tab}
                  onChange={setTab}
                  options={[
                    { value: "all", label: "Tất cả" },
                    { value: "folders", label: "Thư mục", count: folders.length },
                    { value: "projects", label: "Dự án", count: projects.filter((p) => p.status === "active").length },
                  ]}
                  className="self-start"
                />
              )}
              {showProjects && (
                <div className="flex flex-wrap items-center gap-2">
                  {tab === "projects" && !openFolder && (
                    <FilterSelect label="Sắp xếp" value={sortBy} options={SORT_OPTIONS} onChange={setSortBy} />
                  )}
                  <FilterSelect label="Trạng thái" value={status} options={STATUS_OPTIONS} onChange={setStatus} />
                  <FilterSelect label="Nguồn" value={mode} options={MODE_OPTIONS} onChange={setMode} />
                </div>
              )}
            </div>

            {(error || dropError) && (
              <div role="alert" className="flex items-center gap-3 bg-error-container border border-error-border text-on-error-container px-4 py-3 rounded-control text-[12.5px] font-medium">
                <Icon name="error-circle" size={18} />
                <span className="flex-1">{error ?? dropError}</span>
                <Button size="sm" variant="secondary" onClick={() => (error ? void reload() : setDropError(null))}>
                  {error ? "Thử lại" : "Đóng"}
                </Button>
              </div>
            )}

            <div
              role={openFolder ? undefined : "tabpanel"}
              id={openFolder ? undefined : "dashboard-panel"}
              aria-labelledby={openFolder ? undefined : `dashboard-tab-${tab}`}
              className="flex flex-col gap-8"
            >
              {showFolders && !initialLoading && (
                <section aria-labelledby="folders-title" className="flex flex-col gap-3">
                  <SectionTitle
                    id="folders-title"
                    title="Thư mục"
                    count={folders.length}
                    hint={folders.length > 0 && tab === "all" ? "Kéo thẻ dự án thả vào thư mục để sắp xếp." : undefined}
                  />
                  {foldersError && (
                    <p role="alert" className="text-[12.5px] text-on-error-container">
                      Không tải được thư mục: {foldersError}
                    </p>
                  )}
                  <div className={CARD_GRID}>
                    {/* Ô tạo mới đứng đầu: luôn ở cùng một chỗ, không bị đẩy xuống khi thư mục nhiều lên */}
                    <NewFolderTile onCreate={() => setFolderTarget({ kind: "create" })} />
                    {visibleFolders.map((folder) => (
                      <FolderCard
                        key={folder._id}
                        folder={folder}
                        onOpen={(f) => setOpenFolderId(f._id)}
                        onRename={(f) => setFolderTarget({ kind: "rename", folder: f })}
                        onDelete={(f) => setFolderTarget({ kind: "delete", folder: f })}
                        onDropProject={(f, id) => void handleDropProject(f, id)}
                      />
                    ))}
                  </div>
                </section>
              )}

              {showProjects && (
                <section aria-labelledby="projects-title" className="flex flex-col gap-4">
                  <SectionTitle
                    id="projects-title"
                    title={openFolder ? openFolder.name : tab === "all" && !normalizedQuery ? "Dự án ngoài thư mục" : "Dự án"}
                    count={initialLoading ? undefined : scopedCount}
                  />
                  {projectsBody}
                </section>
              )}
            </div>
          </>
        )}
      </div>

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title={openFolder ? `Dự án mới trong “${openFolder.name}”` : "Tạo dự án mới"} size="lg">
        <CreateProjectForm variant="dialog" onCreated={handleCreated} onCancel={() => setCreateOpen(false)} folderId={openFolder?._id} />
      </Modal>

      <AddToFolderDialog folder={addTarget} projects={projects} folderIds={new Set(folderById.keys())} onClose={() => setAddTarget(null)} onAdded={reload} onCreated={handleCreated} />
      <ProjectActionDialogs target={actionTarget} onClose={() => setActionTarget(null)} onDone={reload} />
      <FolderDialogs target={folderTarget} folders={folders} onClose={() => setFolderTarget(null)} onDone={reload} />
    </>
  );
}
