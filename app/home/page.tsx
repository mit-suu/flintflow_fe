"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import TopBar from "@/components/layout/TopBar";
import CreateProjectForm from "@/components/project/CreateProjectForm";
import ProjectActionDialogs, { type ProjectActionTarget } from "@/components/project/ProjectActionDialogs";
import ProjectGrid, { ProjectGridSkeleton } from "@/components/project/ProjectGrid";
import { Button, CountBadge, EmptyState, FilterSelect, Icon, Modal, SearchInput } from "@/components/ui";
import { getProgress } from "@/lib/api/pipeline";
import { useProjects } from "@/lib/hooks/use-projects";
import { SOURCE_MODE_OPTIONS, getProjectStartRoute } from "@/lib/project-source-mode";
import type { ProgressResponse } from "@/types/pipeline";
import type { Project, ProjectSourceMode, ProjectStatus } from "@/types/project";

type ModeFilter = ProjectSourceMode | "all";

const STATUS_OPTIONS = [
  { value: "active", label: "Đang làm" },
  { value: "archived", label: "Lưu trữ" },
] as const satisfies readonly { value: ProjectStatus; label: string }[];

const MODE_OPTIONS: readonly { value: ModeFilter; label: string }[] = [
  { value: "all", label: "Tất cả" },
  ...SOURCE_MODE_OPTIONS.map((o) => ({ value: o.value, label: o.shortLabel })),
];

/** Project Dashboard (UC-13/14/15/16/19/75): 3 trạng thái — đang tải, chưa có dự án, lưới dự án. */
export default function HomePage() {
  const router = useRouter();
  const { projects, loading, error, reload } = useProjects();

  const [status, setStatus] = useState<ProjectStatus>("active");
  const [mode, setMode] = useState<ModeFilter>("all");
  const [query, setQuery] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [actionTarget, setActionTarget] = useState<ProjectActionTarget | null>(null);
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

  const normalizedQuery = query.trim().toLocaleLowerCase("vi");
  const inStatus = useMemo(() => projects.filter((p) => p.status === status), [projects, status]);
  const visible = inStatus.filter(
    (p) => (mode === "all" || p.sourceMode === mode) && (!normalizedQuery || p.name.toLocaleLowerCase("vi").includes(normalizedQuery))
  );
  const filtersActive = status !== "active" || mode !== "all" || normalizedQuery.length > 0;
  const initialLoading = loading && projects.length === 0;
  // Chưa có dự án nào (kể cả lưu trữ) ⇒ tạo dự án ngay trên trang. Còn dự án lưu trữ thì giữ bộ lọc để
  // user vẫn mở được chúng.
  const showOnboarding = !initialLoading && !error && projects.length === 0;

  const clearFilters = () => {
    setStatus("active");
    setMode("all");
    setQuery("");
  };

  const handleCreated = async (project: Project) => {
    await reload();
    router.push(getProjectStartRoute(project._id, project.sourceMode));
  };

  const openAction = (action: ProjectActionTarget["action"]) => (project: Project) => setActionTarget({ action, project });

  return (
    <>
      <TopBar
        trail={["Dự án"]}
        search={<SearchInput value={query} onChange={setQuery} label="Tìm dự án theo tên" placeholder="Tìm dự án…" />}
        actions={
          <Button size="sm" icon="plus" onClick={() => setCreateOpen(true)}>
            <span className="hidden sm:inline">Dự án mới</span>
            <span className="sm:hidden">Mới</span>
          </Button>
        }
      />

      <div className="flex-1 overflow-y-auto overflow-x-hidden flex flex-col gap-5 p-4 sm:p-6 lg:p-8 bg-background">
        {showOnboarding ? (
          <section aria-labelledby="onboarding-title" className="w-full max-w-[920px] mx-auto flex flex-col gap-6 py-2 sm:py-6">
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
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <h1 className="text-[22px] sm:text-[24px] font-extrabold text-on-surface tracking-tight">Dự án</h1>
                {!initialLoading && <CountBadge count={inStatus.length} max={999} />}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <FilterSelect label="Trạng thái" value={status} options={STATUS_OPTIONS} onChange={setStatus} />
                <FilterSelect label="Nguồn" value={mode} options={MODE_OPTIONS} onChange={setMode} />
              </div>
            </div>

            {error && (
              <div role="alert" className="flex items-center gap-3 bg-error-container border border-error-border text-on-error-container px-4 py-3 rounded-[12px] text-[12.5px] font-medium">
                <Icon name="error-circle" size={18} />
                <span className="flex-1">{error}</span>
                <Button size="sm" variant="secondary" onClick={() => void reload()}>
                  Thử lại
                </Button>
              </div>
            )}

            {initialLoading ? (
              <ProjectGridSkeleton />
            ) : visible.length > 0 ? (
              <ProjectGrid
                projects={visible}
                progressById={progressById}
                onRename={openAction("rename")}
                onDelete={openAction("archive")}
                onHardDelete={openAction("delete")}
              />
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
              <EmptyState
                icon="folder"
                title="Chưa có dự án đang làm"
                description="Tạo dự án mới, hoặc mở lại các dự án đã lưu trữ."
                action={
                  <div className="flex flex-wrap justify-center gap-2">
                    <Button size="sm" icon="plus" onClick={() => setCreateOpen(true)}>
                      Dự án mới
                    </Button>
                    <Button variant="secondary" size="sm" onClick={() => setStatus("archived")}>
                      Xem lưu trữ
                    </Button>
                  </div>
                }
              />
            )}
          </>
        )}
      </div>

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Tạo dự án mới" size="lg">
        <CreateProjectForm variant="dialog" onCreated={handleCreated} onCancel={() => setCreateOpen(false)} />
      </Modal>

      <ProjectActionDialogs target={actionTarget} onClose={() => setActionTarget(null)} onDone={reload} />
    </>
  );
}
