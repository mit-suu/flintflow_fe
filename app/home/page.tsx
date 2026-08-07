"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiCall, setAccessToken } from "../../lib/api";

interface Project {
  _id: string;
  name: string;
  domain?: string;
  status: string;
  currentStep: string;
  progressPercent: number;
  createdAt: string;
}

interface User {
  id: string;
  email: string;
  balance?: number;
}

export default function HomePage() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // New Project Form
  const [showModal, setShowModal] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [projectDomain, setProjectDomain] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    const init = async () => {
      const token = localStorage.getItem("accessToken");
      if (!token) {
        router.push("/login");
        return;
      }
      setAccessToken(token);

      try {
        // Fetch User and Projects
        const [userRes, projectsRes] = await Promise.all([
          apiCall<User>("/users/me"),
          apiCall<Project[]>("/projects")
        ]);

        if (userRes.data) setUser(userRes.data);
        if (projectsRes.data) setProjects(projectsRes.data);
      } catch (err: any) {
        console.error("Dashboard loading failed:", err);
        setError(err.message || "Không thể tải dữ liệu.");
        if (err.status === 401) {
          localStorage.removeItem("accessToken");
          router.push("/login");
        }
      } finally {
        setLoading(false);
      }
    };

    init();
  }, [router]);

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectName.trim()) return;

    setCreating(true);
    try {
      const res = await apiCall<Project>("/projects", {
        method: "POST",
        body: JSON.stringify({
          name: projectName.trim(),
          domain: projectDomain.trim() || undefined
        })
      });

      if (res.data) {
        setProjects((prev) => [res.data!, ...prev]);
        setShowModal(false);
        setProjectName("");
        setProjectDomain("");
        // Redirect directly to the workspace of the new project
        router.push(`/projects/${res.data._id}`);
      }
    } catch (err: any) {
      alert(err.message || "Tạo dự án thất bại");
    } finally {
      setCreating(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("accessToken");
    setAccessToken(null);
    router.push("/login");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <svg className="w-10 h-10 animate-spin text-indigo-600" fill="none" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeDasharray="31.4" strokeDashoffset="10.4" strokeLinecap="round" strokeWidth="4"></circle>
          </svg>
          <span className="text-slate-500 font-medium text-sm">Đang tải danh sách dự án...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans">
      {/* Top Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between shadow-sm sticky top-0 z-10 h-[64px]">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-md bg-indigo-600 text-white flex items-center justify-center font-bold text-sm">F</div>
          <span className="font-bold text-lg text-slate-900">FlintFlow Workspace</span>
        </div>
        <div className="flex items-center gap-4">
          {user && (
            <>
              <div className="flex items-center px-3 py-1.5 rounded-full bg-indigo-50 text-indigo-600 text-sm font-semibold gap-1.5 cursor-pointer">
                <span className="w-2 h-2 rounded-full bg-indigo-600 animate-pulse"></span>
                {user.balance ?? 0} credits
              </div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-purple-200 border-2 border-white shadow-sm flex items-center justify-center font-bold text-xs text-purple-700">
                  {user.email.substring(0, 2).toUpperCase()}
                </div>
                <button
                  onClick={handleLogout}
                  className="text-xs text-slate-500 hover:text-red-600 font-medium"
                >
                  Đăng xuất
                </button>
              </div>
            </>
          )}
        </div>
      </header>

      {/* Main Body */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-6 md:p-8 space-y-8">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm font-medium">
            {error}
          </div>
        )}

        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-black text-slate-900">Dự án của bạn</h1>
            <p className="text-slate-500 text-sm mt-1">Quản lý đặc tả và làm rõ yêu cầu sản phẩm của bạn.</p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="px-5 py-2.5 bg-indigo-600 text-white font-bold rounded-xl shadow-lg shadow-indigo-600/10 hover:bg-indigo-500 hover:shadow-indigo-600/25 transition-all text-sm flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-lg">add</span>
            Dự án mới
          </button>
        </div>

        {/* Project List Grid */}
        {projects.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center flex flex-col items-center justify-center space-y-4 shadow-sm">
            <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
              <span className="material-symbols-outlined text-3xl">folder_open</span>
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-lg">Chưa có dự án nào</h3>
              <p className="text-slate-500 text-sm mt-1">Hãy bắt đầu tạo dự án đầu tiên để phân tích đặc tả bằng AI.</p>
            </div>
            <button
              onClick={() => setShowModal(true)}
              className="px-4 py-2 border border-indigo-600 text-indigo-600 hover:bg-indigo-50 text-sm font-bold rounded-xl transition-all"
            >
              Tạo dự án mới
            </button>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((project) => (
              <div
                key={project._id}
                className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex justify-between items-start gap-2">
                    <h3 className="font-bold text-slate-900 text-lg line-clamp-1">{project.name}</h3>
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 capitalize shrink-0">
                      {project.status}
                    </span>
                  </div>
                  {project.domain && (
                    <p className="text-xs text-indigo-600 font-medium mt-1 truncate">
                      Domain: {project.domain}
                    </p>
                  )}
                  <p className="text-xs text-slate-400 mt-2">
                    Tạo ngày: {new Date(project.createdAt).toLocaleDateString("vi-VN")}
                  </p>

                  <div className="mt-5 space-y-2">
                    <div className="flex justify-between text-xs font-semibold text-slate-500">
                      <span>Tiến độ phân tích</span>
                      <span>{project.progressPercent}%</span>
                    </div>
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-indigo-600 h-full rounded-full transition-all"
                        style={{ width: `${project.progressPercent}%` }}
                      ></div>
                    </div>
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-500 flex items-center gap-1">
                    <span className="material-symbols-outlined text-sm">wysiwyg</span>
                    {project.currentStep === "vision_problem"
                      ? "Vision & Problem"
                      : project.currentStep === "target_users"
                      ? "Target Users"
                      : project.currentStep === "value_proposition"
                      ? "Value Proposition"
                      : "MVP Scope"}
                  </span>
                  <Link
                    href={`/projects/${project._id}`}
                    className="text-xs font-bold text-indigo-600 hover:text-indigo-500 flex items-center gap-0.5"
                  >
                    Vào Workspace
                    <span className="material-symbols-outlined text-xs">arrow_forward</span>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Create Project Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 transform transition-all">
            <div className="flex justify-between items-center pb-4 border-b border-slate-100">
              <h2 className="text-lg font-bold text-slate-950">Tạo dự án mới</h2>
              <button
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleCreateProject} className="space-y-4 pt-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700">Tên dự án *</label>
                <input
                  type="text"
                  required
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  placeholder="Lumen — SaaS quản lý khoá học"
                  className="w-full h-10 px-3 border border-slate-200 rounded-xl bg-white text-slate-900 placeholder:text-slate-400 outline-none text-xs focus:ring-2 focus:ring-indigo-600/10 focus:border-indigo-600"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700">Domain hoặc Ngành học (Tùy chọn)</label>
                <input
                  type="text"
                  value={projectDomain}
                  onChange={(e) => setProjectDomain(e.target.value)}
                  placeholder="E-learning, Logistics, FinTech..."
                  className="w-full h-10 px-3 border border-slate-200 rounded-xl bg-white text-slate-900 placeholder:text-slate-400 outline-none text-xs focus:ring-2 focus:ring-indigo-600/10 focus:border-indigo-600"
                />
              </div>

              <div className="flex gap-3 justify-end pt-4 border-t border-slate-100 mt-6">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-500 hover:bg-slate-50 rounded-xl transition-all"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="px-4 py-2 bg-indigo-600 text-white text-xs font-bold rounded-xl hover:bg-indigo-500 transition-all flex items-center gap-1.5 disabled:opacity-50"
                >
                  {creating ? "Đang tạo..." : "Tạo dự án"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
