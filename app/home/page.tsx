"use client";

import { useState, useEffect, useCallback } from "react";
import ProjectCard from "../../components/ProjectCard";
import type { Project } from "@/types/project";
import Modal from "../../components/Modal";
import Logo from "../../components/Logo";
import { apiCall } from "../../lib/api";

interface User {
  id: string;
  email: string;
  balance?: number;
}

export default function HomePage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showHardDeleteConfirm, setShowHardDeleteConfirm] = useState(false);
  const [targetProject, setTargetProject] = useState<Project | null>(null);

  const [createName, setCreateName] = useState("");
  const [renameName, setRenameName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");

  // setState chỉ nằm trong callback của promise để effect gọi hàm này không set state đồng bộ
  const loadProjects = useCallback(
    () =>
      apiCall<Project[]>("/projects?status=active")
        .then((res) => setProjects(res.data ?? []))
        .catch((err: unknown) =>
          setError(err instanceof Error ? err.message : "Không thể tải danh sách dự án")
        )
        .finally(() => setLoading(false)),
    []
  );

  // Tải lại sau khi tạo/đổi tên/xoá: bật loading và xoá lỗi cũ trước khi gọi
  const fetchProjects = async () => {
    setLoading(true);
    setError(null);
    await loadProjects();
  };

  // Lần tải đầu: state khởi tạo sẵn loading=true, error=null
  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  const normalizedQuery = searchQuery.trim().toLocaleLowerCase("vi");
  const filteredProjects = normalizedQuery
    ? projects.filter((p) => p.name.toLocaleLowerCase("vi").includes(normalizedQuery))
    : projects;

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const res = await apiCall<User>("/users/me");
        setUser(res.data ?? null);
      } catch (err) {
        console.error("Failed to fetch user:", err);
      }
    };
    fetchUser();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createName.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      await apiCall("/projects", {
        method: "POST",
        body: JSON.stringify({ name: createName.trim() }),
      });
      setShowCreateModal(false);
      setCreateName("");
      await fetchProjects();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể tạo dự án");
    } finally {
      setSubmitting(false);
    }
  };

  const handleRename = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetProject || !renameName.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      await apiCall(`/projects/${targetProject._id}/name`, {
        method: "PATCH",
        body: JSON.stringify({ name: renameName.trim() }),
      });
      setShowRenameModal(false);
      await fetchProjects();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể đổi tên dự án");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!targetProject) return;
    setSubmitting(true);
    setError(null);
    try {
      await apiCall(`/projects/${targetProject._id}`, { method: "DELETE" });
      setShowDeleteConfirm(false);
      setTargetProject(null);
      await fetchProjects();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể lưu trữ dự án");
    } finally {
      setSubmitting(false);
    }
  };

  const handleHardDeleteConfirm = async () => {
    if (!targetProject) return;
    setSubmitting(true);
    setError(null);
    try {
      await apiCall(`/projects/${targetProject._id}?hard=true`, { method: "DELETE" });
      setShowHardDeleteConfirm(false);
      setTargetProject(null);
      await fetchProjects();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể xoá vĩnh viễn dự án");
    } finally {
      setSubmitting(false);
    }
  };

  const openRename = (p: Project) => {
    setTargetProject(p);
    setRenameName(p.name);
    setShowRenameModal(true);
  };

  const openDelete = (p: Project) => {
    setTargetProject(p);
    setShowDeleteConfirm(true);
  };

  return (
    <>
      {/* Top Header Bar (B1 Design) */}
      <div className="h-[58px] bg-white border-b border-[#E4E1DC] flex items-center px-6 gap-3.5 shrink-0 z-10">
        {/* Breadcrumb */}
        <div className="flex items-center gap-1.5 text-[13px] text-[#8A867E]">
          <span>Dự án của tôi</span>
          <span className="text-[#D6D2CB]">/</span>
          <span className="text-[#191817] font-bold">Tất cả dự án</span>
        </div>

        {/* Right actions */}
        <div className="ml-auto flex items-center gap-2.5">
          {/* Notification Bell */}
          <div className="relative w-[30px] h-[30px] rounded-[9px] bg-[#F5F3F0] border border-[#E4E1DC] flex items-center justify-center text-[13px] cursor-pointer hover:bg-[#FAF9F7] transition-colors">
            🔔
            <div className="absolute -top-1 -right-1 min-w-[15px] h-[15px] rounded-full bg-[#B03030] text-white text-[9px] font-extrabold flex items-center justify-center px-1">
              3
            </div>
          </div>

          {/* Credits chip */}
          <div className="flex items-center gap-2 bg-[#F0EEEA] rounded-full px-3.5 py-1.5 text-[12px] font-semibold text-[#191817]">
            <span className="w-2 h-2 rounded-full bg-[#4F46E5] shrink-0" />
            {user?.balance ?? 0} credits · Free
          </div>

          {/* New Project button */}
          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 rounded-full btn-gradient-primary text-white text-[12.5px] font-bold flex items-center gap-1 cursor-pointer"
          >
            + Dự án mới
          </button>
        </div>
      </div>

      {/* Main scroll area */}
      <div className="flex-1 overflow-y-auto flex flex-col gap-6 p-6 sm:p-8 bg-[#F5F3F0]">
        
        {/* Search & Filter Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <h1 className="text-[24px] font-extrabold text-[#191817] tracking-tight">
              Dự án của tôi
            </h1>
            <span className="px-2.5 py-0.5 rounded-full bg-[#E4E1DC] text-[11.5px] font-bold text-[#6B6862]">
              {projects.length}
            </span>
          </div>

          {/* Search input & filters */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 bg-white border border-[#E4E1DC] rounded-full px-3.5 py-1.5 text-[12.5px] text-[#A8A49C] w-full sm:w-[240px]">
              <span>🔍</span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm kiếm dự án…"
                aria-label="Tìm kiếm dự án theo tên"
                className="w-full bg-transparent outline-none text-[#191817] text-[12px] placeholder:text-[#A8A49C]"
              />
            </div>
          </div>
        </div>

        {/* Error banner */}
        {error && (
          <div className="flex items-center gap-3 bg-[#FDEDED] border border-[#F2CACA] text-[#8A4141] px-4 py-3 rounded-[12px] text-xs font-medium">
            <span className="material-symbols-outlined text-lg">error</span>
            <span className="flex-1">{error}</span>
            <button
              type="button"
              onClick={() => setError(null)}
              className="text-[#8A4141] font-bold hover:opacity-75"
            >
              ✕
            </button>
          </div>
        )}

        {/* Projects Section */}
        {loading ? (
          <div className="flex items-center justify-center py-20 text-[#A8A49C] gap-3">
            <span className="w-6 h-6 rounded-full border-2 border-[#E4E1DC] border-t-[#4F46E5] ff-spinner shrink-0" />
            <span className="text-[13px] font-medium">Đang tải danh sách dự án…</span>
          </div>
        ) : projects.length === 0 ? (
          /* Empty / Onboarding State (B1 Design) */
          <div className="flex-1 flex items-center justify-center relative py-12">
            <div className="w-full max-w-[560px] bg-white border border-[#ECEAE5] rounded-[24px] p-8 sm:p-10 custom-shadow-card flex flex-col items-center gap-4 text-center">
              <Logo sizeClassName="w-14 h-14" theme="light" showText={false} />
              <h2 className="text-[20px] font-extrabold text-[#191817]">
                Bắt đầu dự án đầu tiên của bạn
              </h2>
              <p className="text-[13.5px] text-[#8A867E] max-w-[380px] leading-[1.6]">
                Tạo tài liệu SRS hoàn chỉnh chuẩn IEEE/FPT chỉ trong vài phút thông qua hội thoại tương tác cùng AI.
              </p>
              <button
                type="button"
                onClick={() => setShowCreateModal(true)}
                className="mt-2 px-6 py-3 rounded-full btn-gradient-primary text-white text-[13.5px] font-bold cursor-pointer"
              >
                + Tạo dự án mới
              </button>
            </div>
          </div>
        ) : filteredProjects.length === 0 ? (
          <div className="py-16 text-center text-[13px] text-[#8A867E]">
            Không tìm thấy dự án nào khớp “{searchQuery.trim()}”.
          </div>
        ) : (
          /* Populated Grid */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredProjects.map((p) => (
              <ProjectCard
                key={p._id}
                project={p}
                onRename={openRename}
                onDelete={openDelete}
                onHardDelete={(project) => {
                  setTargetProject(project);
                  setShowHardDeleteConfirm(true);
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Create Modal */}
      <Modal
        open={showCreateModal}
        onClose={() => {
          setShowCreateModal(false);
          setCreateName("");
        }}
        title="Tạo dự án mới"
      >
        <form onSubmit={handleCreate} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-[12.5px] font-bold text-[#4B4842]">Tên dự án</label>
            <input
              autoFocus
              type="text"
              required
              value={createName}
              onChange={(e) => setCreateName(e.target.value)}
              placeholder="Ví dụ: App Đặt Xe Online, E-Learning Platform…"
              className="w-full px-3.5 py-2.5 rounded-[10px] border-[1.5px] border-[#E4E1DC] focus:border-[#4F46E5] focus:ring-1 focus:ring-[#4F46E5] outline-none text-[13.5px] text-[#191817] bg-[#FAF9F7] transition-all"
            />
          </div>
          <button
            type="submit"
            disabled={submitting || !createName.trim()}
            className="w-full mt-2 py-3 rounded-[10px] btn-gradient-primary text-white text-[13.5px] font-bold transition disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
          >
            {submitting ? (
              <>
                <span className="w-3.5 h-3.5 rounded-full border-2 border-white/40 border-t-white ff-spinner shrink-0" />
                Đang tạo dự án…
              </>
            ) : (
              "Tạo dự án →"
            )}
          </button>
        </form>
      </Modal>

      {/* Delete / Archive Modal */}
      <Modal
        open={showDeleteConfirm}
        onClose={() => {
          if (!submitting) {
            setShowDeleteConfirm(false);
            setTargetProject(null);
          }
        }}
        title="Lưu trữ dự án"
      >
        <div className="flex flex-col gap-4">
          <div className="flex items-start gap-3 bg-[#FDEDED] border border-[#F2CACA] rounded-[12px] p-4 text-[#8A4141]">
            <span className="material-symbols-outlined text-[20px] mt-0.5 shrink-0">warning</span>
            <div>
              <p className="text-[13.5px] font-bold text-[#191817]">
                Lưu trữ &ldquo;{targetProject?.name}&rdquo;?
              </p>
              <p className="text-[12.5px] text-[#8A4141] mt-1 leading-[1.55]">
                Dự án sẽ bị ẩn khỏi dashboard chính và có thể khôi phục lại sau.
              </p>
            </div>
          </div>
          <div className="flex gap-2.5 justify-end pt-2">
            <button
              type="button"
              disabled={submitting}
              onClick={() => {
                setShowDeleteConfirm(false);
                setTargetProject(null);
              }}
              className="px-4 py-2 rounded-[8px] border-[1.5px] border-[#E4E1DC] bg-white text-[13px] font-semibold text-[#4B4842] hover:bg-[#FAF9F7] transition-colors disabled:opacity-50"
            >
              Huỷ
            </button>
            <button
              type="button"
              disabled={submitting}
              onClick={handleDeleteConfirm}
              className="px-4 py-2 rounded-[8px] bg-[#B03030] text-white text-[13px] font-bold hover:brightness-90 transition disabled:opacity-50 flex items-center gap-2"
            >
              {submitting ? "Đang lưu trữ…" : "Lưu trữ"}
            </button>
          </div>
        </div>
      </Modal>

      {/* Permanent Delete Modal */}
      <Modal
        open={showHardDeleteConfirm}
        onClose={() => {
          if (!submitting) {
            setShowHardDeleteConfirm(false);
            setTargetProject(null);
          }
        }}
        title="Xoá vĩnh viễn dự án"
      >
        <div className="flex flex-col gap-4">
          <div className="flex items-start gap-3 bg-[#FDEDED] border border-[#F2CACA] rounded-[12px] p-4 text-[#8A4141]">
            <span className="material-symbols-outlined text-[20px] mt-0.5 shrink-0">delete_forever</span>
            <div>
              <p className="text-[13.5px] font-bold text-[#191817]">
                Xoá vĩnh viễn &ldquo;{targetProject?.name}&rdquo;?
              </p>
              <p className="text-[12.5px] text-[#8A4141] mt-1 leading-[1.55]">
                Toàn bộ hội thoại, tài liệu SRS và dữ liệu đính kèm sẽ bị xoá hoàn toàn. Hành động này **không thể hoàn tác**.
              </p>
            </div>
          </div>
          <div className="flex gap-2.5 justify-end pt-2">
            <button
              type="button"
              disabled={submitting}
              onClick={() => {
                setShowHardDeleteConfirm(false);
                setTargetProject(null);
              }}
              className="px-4 py-2 rounded-[8px] border-[1.5px] border-[#E4E1DC] bg-white text-[13px] font-semibold text-[#4B4842] hover:bg-[#FAF9F7] transition-colors disabled:opacity-50"
            >
              Huỷ
            </button>
            <button
              type="button"
              disabled={submitting}
              onClick={handleHardDeleteConfirm}
              className="px-4 py-2 rounded-[8px] bg-[#B03030] text-white text-[13px] font-bold hover:brightness-90 transition disabled:opacity-50 flex items-center gap-2"
            >
              {submitting ? "Đang xoá…" : "Xoá vĩnh viễn"}
            </button>
          </div>
        </div>
      </Modal>

      {/* Rename Modal */}
      <Modal
        open={showRenameModal}
        onClose={() => setShowRenameModal(false)}
        title="Đổi tên dự án"
      >
        <form onSubmit={handleRename} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-[12.5px] font-bold text-[#4B4842]">Tên dự án mới</label>
            <input
              autoFocus
              type="text"
              required
              value={renameName}
              onChange={(e) => setRenameName(e.target.value)}
              placeholder="Nhập tên mới…"
              className="w-full px-3.5 py-2.5 rounded-[10px] border-[1.5px] border-[#E4E1DC] focus:border-[#4F46E5] focus:ring-1 focus:ring-[#4F46E5] outline-none text-[13.5px] text-[#191817] bg-[#FAF9F7] transition-all"
            />
          </div>
          <button
            type="submit"
            disabled={submitting || !renameName.trim()}
            className="w-full mt-2 py-3 rounded-[10px] btn-gradient-primary text-white text-[13.5px] font-bold transition disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
          >
            {submitting ? (
              <>
                <span className="w-3.5 h-3.5 rounded-full border-2 border-white/40 border-t-white ff-spinner shrink-0" />
                Đang lưu…
              </>
            ) : (
              "Lưu thay đổi"
            )}
          </button>
        </form>
      </Modal>
    </>
  );
}
