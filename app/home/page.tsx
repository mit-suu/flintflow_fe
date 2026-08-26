"use client";

import { useState, useEffect, useCallback } from "react";
import ProjectCard, { type Project } from "../../components/ProjectCard";
import Modal from "../../components/Modal";
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
  const [showDeactivateConfirm, setShowDeactivateConfirm] = useState(false);
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);
  const [targetProject, setTargetProject] = useState<Project | null>(null);

  const [createName, setCreateName] = useState("");
  const [renameName, setRenameName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fetchProjects = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiCall<Project[]>("/projects?status=active");
      setProjects(res.data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể tải danh sách dự án");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

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

  const handleDeactivateConfirm = async () => {
    if (!targetProject) return;
    setSubmitting(true);
    setError(null);
    try {
      await apiCall(`/projects/${targetProject._id}?status=inactive`, { method: "DELETE" });
      setShowDeactivateConfirm(false);
      setTargetProject(null);
      await fetchProjects();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể chuyển dự án sang inactive");
    } finally {
      setSubmitting(false);
    }
  };

  const handleArchiveConfirm = async () => {
    if (!targetProject) return;
    setSubmitting(true);
    setError(null);
    try {
      await apiCall(`/projects/${targetProject._id}?status=archived`, { method: "DELETE" });
      setShowArchiveConfirm(false);
      setTargetProject(null);
      await fetchProjects();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể lưu trữ dự án");
    } finally {
      setSubmitting(false);
    }
  };

  const openRename = (p: Project) => {
    setTargetProject(p);
    setRenameName(p.name);
    setShowRenameModal(true);
  };

  const openDeactivate = (p: Project) => {
    setTargetProject(p);
    setShowDeactivateConfirm(true);
  };

  const openArchive = (p: Project) => {
    setTargetProject(p);
    setShowArchiveConfirm(true);
  };

  return (
    <>
      {/* Top bar */}
      <div
        className="h-[74px] bg-white border-b border-[#ECEAE5] flex items-center gap-4 flex-shrink-0"
        style={{ padding: "0 32px" }}
      >
        {/* Search pill */}
        <div className="flex items-center gap-3 bg-[#FAF9F7] border-[1.5px] border-[#ECEAE5] rounded-full text-[#A8A49C] text-[14px] w-[340px]" style={{ padding: "11px 18px" }}>
          <span>⌕</span>
          <span>Search…</span>
          <span
            className="ml-auto text-[11px] bg-white border border-[#E4E1DC] rounded-[6px]"
            style={{ fontFamily: "'JetBrains Mono', monospace", padding: "2px 7px" }}
          >
            ⌘ K
          </span>
        </div>

        <div className="ml-auto flex items-center gap-3">
          {/* Credits chip */}
          <div
            className="flex items-center gap-2 bg-[#F0EEEA] rounded-full text-[13px] font-semibold text-[#191817]"
            style={{ padding: "9px 16px" }}
          >
            <span className="w-2 h-2 rounded-full bg-[#4F46E5] flex-shrink-0" />
            {user?.balance ?? 0} credits · Free
          </div>

          {/* New Project button */}
          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="rounded-full text-white text-[14px] font-bold transition hover:brightness-90 active:scale-[0.97]"
            style={{
              padding: "12px 24px",
              background: "linear-gradient(135deg,#7C74F0,#4F46E5 60%,#3B34B0)",
              boxShadow: "0 8px 22px rgba(79,70,229,0.3)",
            }}
          >
            + New Project
          </button>
        </div>
      </div>

      {/* Main scroll area */}
      <div className="flex-1 overflow-y-auto flex flex-col gap-6" style={{ padding: "30px 32px" }}>
        {/* Header row */}
        <div className="flex items-center justify-between">
          <h1
            className="text-[32px] font-[800] text-[#191817]"
            style={{ letterSpacing: "-0.015em" }}
          >
            My Projects
          </h1>
          <div className="flex gap-2">
            {["Status: All ▾", "Domain: Any ▾", "Date: Any ▾"].map((label) => (
              <div
                key={label}
                className="flex items-center gap-[6px] bg-white border-[1.5px] border-[#E4E1DC] rounded-full text-[13px] font-semibold text-[#4B4842] cursor-default"
                style={{ padding: "9px 16px" }}
              >
                {label}
              </div>
            ))}
          </div>
        </div>

        {/* Error banner */}
        {error && (
          <div className="flex items-center gap-3 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
            <span className="material-symbols-outlined text-lg">error</span>
            <span className="flex-1">{error}</span>
            <button
              type="button"
              onClick={() => setError(null)}
              className="text-red-500 font-bold hover:text-red-700"
            >
              ✕
            </button>
          </div>
        )}

        {/* Projects section */}
        <div className="flex flex-col gap-[14px]">
          <div className="flex items-center gap-[10px]">
            <span className="text-[17px] font-[800] text-[#191817]">Projects</span>
            <span
              className="rounded-full bg-[#EDEBE7] text-[12px] font-[700] text-[#6B6862]"
              style={{ padding: "3px 11px" }}
            >
              {projects.length}
            </span>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16 text-[#A8A49C] gap-3">
              <span className="material-symbols-outlined text-2xl ff-spinner">
                progress_activity
              </span>
              <span className="text-[14px]">Đang tải dự án…</span>
            </div>
          ) : projects.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-5">
              <span className="material-symbols-outlined text-[#D6D2CB]" style={{ fontSize: 64 }}>
                folder_open
              </span>
              <div className="text-center">
                <p className="text-[17px] font-[700] text-[#191817]">Chưa có dự án nào</p>
                <p className="text-[14px] text-[#8A867E] mt-1">
                  Tạo dự án đầu tiên để bắt đầu
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(true)}
                className="rounded-full text-white text-[14px] font-bold transition hover:brightness-90 active:scale-[0.97]"
                style={{
                  padding: "12px 24px",
                  background: "linear-gradient(135deg,#7C74F0,#4F46E5 60%,#3B34B0)",
                  boxShadow: "0 8px 22px rgba(79,70,229,0.3)",
                }}
              >
                + Tạo dự án mới
              </button>
            </div>
          ) : (
            <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))" }}>
              {projects.map((p) => (
                <ProjectCard
                  key={p._id}
                  project={p}
                  onRename={openRename}
                  onDelete={openDeactivate}
                  onArchive={openArchive}
                />
              ))}
            </div>
          )}
        </div>

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
          <div className="flex flex-col gap-2">
            <label className="text-[14px] font-[600] text-[#191817]">Tên dự án</label>
            <input
              autoFocus
              type="text"
              required
              value={createName}
              onChange={(e) => setCreateName(e.target.value)}
              placeholder="Ví dụ: Booking App, SaaS Dashboard…"
              className="w-full px-4 py-3 rounded-[12px] border border-[#E4E1DC] focus:border-[#4F46E5] focus:ring-1 focus:ring-[#4F46E5] outline-none text-[14px] text-[#191817] bg-white transition-all"
            />
          </div>
          <button
            type="submit"
            disabled={submitting || !createName.trim()}
            className="w-full py-3 rounded-[12px] text-white text-[14px] font-[700] transition hover:brightness-90 disabled:opacity-50 flex items-center justify-center gap-2"
            style={{
              background: "linear-gradient(135deg,#7C74F0,#4F46E5 60%,#3B34B0)",
              boxShadow: "0 4px 14px rgba(79,70,229,0.25)",
            }}
          >
            {submitting && (
              <span className="material-symbols-outlined text-[16px] ff-spinner">
                progress_activity
              </span>
            )}
            Tạo dự án
          </button>
        </form>
      </Modal>

      {/* Deactivate Modal */}
      <Modal
        open={showDeactivateConfirm}
        onClose={() => {
          if (!submitting) {
            setShowDeactivateConfirm(false);
            setTargetProject(null);
          }
        }}
        title="Xoá dự án"
      >
        <div className="flex flex-col gap-4">
          <div className="flex items-start gap-3 bg-red-50 border border-red-100 rounded-[12px] p-4">
            <span className="material-symbols-outlined text-red-500 text-[20px] mt-0.5 flex-shrink-0">warning</span>
            <div>
              <p className="text-[14px] font-[600] text-[#191817]">
                Bạn có muốn xoá dự án &ldquo;{targetProject?.name}&rdquo;?
              </p>
              <p className="text-[13px] text-[#6B6862] mt-1 leading-[1.55]">
                Dự án sẽ bị xoá vĩnh viễn.  
              </p>
            </div>
          </div>
          <div className="flex gap-[10px] justify-end">
            <button
              type="button"
              disabled={submitting}
              onClick={() => {
                setShowDeactivateConfirm(false);
                setTargetProject(null);
              }}
              className="rounded-full border-[1.5px] border-[#E4E1DC] bg-white text-[13.5px] font-[600] text-[#4B4842] hover:bg-[#F5F3F0] transition-colors disabled:opacity-50"
              style={{ padding: "10px 20px" }}
            >
              Huỷ
            </button>
            <button
              type="button"
              disabled={submitting}
              onClick={handleDeactivateConfirm}
              className="rounded-full bg-[#C73E3E] text-white text-[13.5px] font-[700] hover:brightness-90 transition disabled:opacity-50 flex items-center gap-2"
              style={{ padding: "10px 20px" }}
            >
              {submitting && (
                <span className="material-symbols-outlined text-[16px] ff-spinner">
                  progress_activity
                </span>
              )}
              Xoá dự án
            </button>
          </div>
        </div>
      </Modal>

      {/* Archive Modal */}
      <Modal
        open={showArchiveConfirm}
        onClose={() => {
          if (!submitting) {
            setShowArchiveConfirm(false);
            setTargetProject(null);
          }
        }}
        title="Lưu trữ dự án"
      >
        <div className="flex flex-col gap-4">
          <div className="flex items-start gap-3 bg-amber-50 border border-amber-100 rounded-[12px] p-4">
            <span className="material-symbols-outlined text-amber-600 text-[20px] mt-0.5 flex-shrink-0">archive</span>
            <div>
              <p className="text-[14px] font-[600] text-[#191817]">
                Lưu trữ &ldquo;{targetProject?.name}&rdquo;?
              </p>
              <p className="text-[13px] text-[#6B6862] mt-1 leading-[1.55]">
                Project sẽ được đánh dấu là archived và tách riêng khỏi danh sách active.
              </p>
            </div>
          </div>
          <div className="flex gap-[10px] justify-end">
            <button
              type="button"
              disabled={submitting}
              onClick={() => {
                setShowArchiveConfirm(false);
                setTargetProject(null);
              }}
              className="rounded-full border-[1.5px] border-[#E4E1DC] bg-white text-[13.5px] font-[600] text-[#4B4842] hover:bg-[#F5F3F0] transition-colors disabled:opacity-50"
              style={{ padding: "10px 20px" }}
            >
              Huỷ
            </button>
            <button
              type="button"
              disabled={submitting}
              onClick={handleArchiveConfirm}
              className="rounded-full bg-[#C27A1A] text-white text-[13.5px] font-[700] hover:brightness-90 transition disabled:opacity-50 flex items-center gap-2"
              style={{ padding: "10px 20px" }}
            >
              {submitting && (
                <span className="material-symbols-outlined text-[16px] ff-spinner">
                  progress_activity
                </span>
              )}
              Lưu trữ
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
          <div className="flex flex-col gap-2">
            <label className="text-[14px] font-[600] text-[#191817]">Tên dự án</label>
            <input
              autoFocus
              type="text"
              required
              value={renameName}
              onChange={(e) => setRenameName(e.target.value)}
              placeholder="Tên dự án mới…"
              className="w-full px-4 py-3 rounded-[12px] border border-[#E4E1DC] focus:border-[#4F46E5] focus:ring-1 focus:ring-[#4F46E5] outline-none text-[14px] text-[#191817] bg-white transition-all"
            />
          </div>
          <button
            type="submit"
            disabled={submitting || !renameName.trim()}
            className="w-full py-3 rounded-[12px] text-white text-[14px] font-[700] transition hover:brightness-90 disabled:opacity-50 flex items-center justify-center gap-2"
            style={{
              background: "linear-gradient(135deg,#7C74F0,#4F46E5 60%,#3B34B0)",
              boxShadow: "0 4px 14px rgba(79,70,229,0.25)",
            }}
          >
            {submitting && (
              <span className="material-symbols-outlined text-[16px] ff-spinner">
                progress_activity
              </span>
            )}
            Lưu thay đổi
          </button>
        </form>
      </Modal>
    </>
  );
}
