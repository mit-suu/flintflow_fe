"use client";

import { useTranslations } from "next-intl";
import { NewFolderTile } from "@/components/project/FolderCard";
import { CARD_GRID, ProjectGridSkeleton } from "@/components/project/ProjectGrid";
import type { ProjectSort } from "@/components/project/ProjectTimeline";
import { Button, CountBadge, FilterSelect, SearchInput, STICKY_BLEED, STICKY_FADE, Tabs } from "@/components/ui";
import { SOURCE_MODE_OPTIONS } from "@/lib/project-source-mode";
import type { ProjectMode, ProjectStatus } from "@/types/project";

/**
 * Các mảnh của trang Dự án (`app/home/page.tsx`) dùng chung với khung chờ đăng nhập (`ShellSkeleton`): ô tìm + nút "Dự án
 * mới" trên thanh trên, thanh tab + bộ lọc, tiêu đề mục. Lúc tải lại, khung chờ dựng đúng trang Dự án đang tải bằng chính
 * các mảnh này ⇒ chỉ một nấc: tab, nút, bộ lọc vẽ thật từ đầu, chỉ lưới dự án là khối giữ chỗ.
 */

export type ModeFilter = ProjectMode | "all";
export type DashboardTab = "all" | "folders" | "projects";

const STATUS_VALUES: readonly ProjectStatus[] = ["active", "archived"];
const SORT_VALUES: readonly ProjectSort[] = ["updated", "opened"];

/** Vùng cuộn của trang. `pb-scroll-end`: chừa khoảng thở ở đáy, cuộn hết trang thì dòng cuối không dính sát mép dưới. */
export const PROJECTS_SCROLL_CLASS =
  "flex-1 overflow-y-auto overflow-x-hidden flex flex-col gap-4 px-4 sm:px-6 lg:px-8 pb-scroll-end bg-surface-container-lowest";
/** Thanh điều hướng dính khi cuộn: tab ở gốc, hoặc quay lại + thêm dự án khi đang trong thư mục. */
export const PROJECTS_TOOLBAR_CLASS = `sticky top-0 z-30 py-3 bg-surface-container-lowest flex flex-col lg:flex-row lg:items-center justify-between gap-3 ${STICKY_BLEED} ${STICKY_FADE}`;

/** Ô tìm dự án trên thanh trên. */
export function ProjectsSearch({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const t = useTranslations("app.home");
  return <SearchInput value={value} onChange={onChange} label={t("searchLabel")} placeholder={t("searchPlaceholder")} />;
}

/** Nút "Dự án mới" trên thanh trên (không có với Viewer). */
export function NewProjectButton({ onClick }: { onClick: () => void }) {
  const t = useTranslations("app.home");
  return (
    <Button size="sm" icon="plus" onClick={onClick}>
      <span className="hidden sm:inline">{t("newProject")}</span>
      <span className="sm:hidden">{t("newProjectShort")}</span>
    </Button>
  );
}

/**
 * Tiêu đề mục dính ngay dưới thanh tab khi cuộn, và nhả ra khi cuộn hết mục (sticky trong `<section>` cha).
 * `--toolbar-h` do trang đo từ thanh tab thật (xuống dòng trên mobile ⇒ cao hơn). z trên nút ⋮ của card (z-20).
 * Chỉ âm margin phía trên: đệm dưới 8px + gap của mục chứa trọn dải mờ `STICKY_FADE`, nên lúc chưa dính dải mờ
 * không phủ lên nội dung. Gợi ý (`hint`) nằm cùng hàng tiêu đề vì lý do đó.
 */
export function ProjectsSectionTitle({ id, title, count, hint }: { id: string; title: string; count?: number; hint?: string }) {
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

/** Tab Tất cả / Thư mục / Dự án. Số đếm chưa biết (đang tải) ⇒ `undefined`, không hiện số sai. */
export function ProjectsTabs({
  value,
  onChange,
  folderCount,
  projectCount,
}: {
  value: DashboardTab;
  onChange: (tab: DashboardTab) => void;
  folderCount?: number;
  projectCount?: number;
}) {
  const t = useTranslations("app.home");
  return (
    <Tabs
      label={t("tabsLabel")}
      idBase="dashboard"
      value={value}
      onChange={onChange}
      options={[
        { value: "all", label: t("tabAll") },
        { value: "folders", label: t("tabFolders"), count: folderCount },
        { value: "projects", label: t("tabProjects"), count: projectCount },
      ]}
      className="self-start"
    />
  );
}

/** Nút "Chọn" + bộ lọc (sắp xếp ở tab Dự án, trạng thái, nguồn). */
export function ProjectsFilters({
  select,
  sort,
  status,
  onStatusChange,
  mode,
  onModeChange,
}: {
  /** Nút "Chọn" nhiều dự án; `null` ⇒ không có (Viewer / không có dự án). */
  select: { disabled: boolean; onClick: () => void } | null;
  /** Bộ lọc sắp xếp, chỉ ở tab Dự án ngoài thư mục; `null` ⇒ không có. */
  sort: { value: ProjectSort; onChange: (value: ProjectSort) => void } | null;
  status: ProjectStatus;
  onStatusChange: (value: ProjectStatus) => void;
  mode: ModeFilter;
  onModeChange: (value: ModeFilter) => void;
}) {
  const t = useTranslations("app.home");
  const tMode = useTranslations("app.sourceMode");
  const statusOptions = STATUS_VALUES.map((value) => ({ value, label: t(value === "active" ? "statusActive" : "statusArchived") }));
  const sortOptions = SORT_VALUES.map((value) => ({ value, label: t(value === "updated" ? "sortUpdated" : "sortOpened") }));
  const modeOptions: readonly { value: ModeFilter; label: string }[] = [
    { value: "all", label: t("modeAll") },
    ...SOURCE_MODE_OPTIONS.map((o) => ({ value: o.value as ModeFilter, label: tMode(`${o.key}.shortLabel`) })),
  ];
  return (
    <div className="flex flex-wrap items-center gap-2">
      {select && (
        <Button size="sm" variant="secondary" icon="check" disabled={select.disabled} onClick={select.onClick}>
          {t("select")}
        </Button>
      )}
      {sort && <FilterSelect label={t("sortLabel")} value={sort.value} options={sortOptions} onChange={sort.onChange} />}
      <FilterSelect label={t("statusLabel")} value={status} options={statusOptions} onChange={onStatusChange} />
      <FilterSelect label={t("modeLabel")} value={mode} options={modeOptions} onChange={onModeChange} />
    </div>
  );
}

const noop = () => undefined;

/**
 * Trang Dự án lúc đang tải lần đầu (tab Tất cả, bộ lọc mặc định), dùng cho khung chờ đăng nhập. Giống hệt nhánh
 * `initialLoading` của trang: mục Thư mục (tiêu đề + ô "Thư mục mới") và mục Dự án ngoài thư mục với lưới giữ chỗ.
 */
export function ProjectsLoading({ canAuthor }: { canAuthor: boolean }) {
  const t = useTranslations("app.home");
  return (
    <div className={PROJECTS_SCROLL_CLASS}>
      <div className={PROJECTS_TOOLBAR_CLASS}>
        <ProjectsTabs value="all" onChange={noop} />
        <ProjectsFilters
          select={canAuthor ? { disabled: true, onClick: noop } : null}
          sort={null}
          status="active"
          onStatusChange={noop}
          mode="all"
          onModeChange={noop}
        />
      </div>
      <div role="tabpanel" id="dashboard-panel" aria-labelledby="dashboard-tab-all" className="flex flex-col gap-8">
        {canAuthor && (
          <section aria-labelledby="folders-title" className="flex flex-col gap-3">
            <ProjectsSectionTitle id="folders-title" title={t("foldersTitle")} />
            <div className={CARD_GRID}>
              <NewFolderTile onCreate={noop} />
            </div>
          </section>
        )}
        <section aria-labelledby="projects-title" className="flex flex-col gap-4">
          <ProjectsSectionTitle id="projects-title" title={t("looseProjectsTitle")} />
          <ProjectGridSkeleton />
        </section>
      </div>
    </div>
  );
}
