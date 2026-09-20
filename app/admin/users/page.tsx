"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  fetchAdminUsers,
  formatDateTime,
  formatNumber,
  type AdminUser,
  type AdminUserRole,
  type FetchUsersParams,
  type PageMeta,
} from "@/lib/api/admin";
import {
  AdminTopBar,
  ErrorBanner,
  LoadingBlock,
  inputClass,
  tableCellClass,
  tableHeadClass,
} from "../_components/AdminPage";

const PAGE_SIZE = 20;

export default function AdminUsersPage() {
  const [search, setSearch] = useState("");
  const [params, setParams] = useState<FetchUsersParams>({ page: 1, limit: PAGE_SIZE });
  const [items, setItems] = useState<AdminUser[]>([]);
  const [meta, setMeta] = useState<PageMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetchAdminUsers(params);
        if (cancelled) return;
        setItems(res.items);
        setMeta(res.meta);
        setError(null);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Không thể tải danh sách người dùng");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [params]);

  const update = (patch: FetchUsersParams) => {
    setLoading(true);
    setParams((prev) => ({ ...prev, page: 1, ...patch }));
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    update({ q: search.trim() || undefined });
  };

  const page = meta?.page ?? 1;
  const totalPages = meta?.totalPages ?? 1;

  return (
    <>
      <AdminTopBar trail={["Người dùng"]} />
      <div className="flex-1 overflow-y-auto flex flex-col gap-5 p-6 sm:p-8">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <h1 className="text-[24px] font-extrabold text-[#191817] tracking-tight">Người dùng</h1>
            {meta && (
              <span className="px-2.5 py-0.5 rounded-full bg-[#EFEEF9] text-[11.5px] font-bold text-[#554DB0]">
                {formatNumber(meta.total)}
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <form onSubmit={handleSearch} className="flex items-center gap-2">
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Tìm theo email hoặc tên"
                className={`${inputClass} w-[220px]`}
              />
              <button
                type="submit"
                className="h-9 px-4 rounded-[10px] bg-[#191817] text-white text-[12.5px] font-semibold hover:opacity-90 cursor-pointer"
              >
                Tìm
              </button>
            </form>
            <select
              value={params.role ?? ""}
              onChange={(e) => update({ role: (e.target.value || undefined) as AdminUserRole | undefined })}
              className={inputClass}
            >
              <option value="">Mọi vai trò</option>
              <option value="user">User</option>
              <option value="admin">Admin</option>
            </select>
            <select
              value={params.isActive === undefined ? "" : String(params.isActive)}
              onChange={(e) => update({ isActive: e.target.value === "" ? undefined : e.target.value === "true" })}
              className={inputClass}
            >
              <option value="">Mọi trạng thái</option>
              <option value="true">Đang hoạt động</option>
              <option value="false">Đã khoá</option>
            </select>
          </div>
        </div>

        {error && <ErrorBanner message={error} onClose={() => setError(null)} />}

        <div className="bg-white border border-[#ECEAE5] rounded-[16px] overflow-hidden">
          {loading ? (
            <LoadingBlock label="Đang tải người dùng…" bare />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-[#FAF9F7]">
                  <tr>
                    <th className={tableHeadClass}>Email</th>
                    <th className={tableHeadClass}>Vai trò</th>
                    <th className={tableHeadClass}>Trạng thái</th>
                    <th className={`${tableHeadClass} text-right`}>Credit</th>
                    <th className={`${tableHeadClass} text-right`}>Dự án</th>
                    <th className={tableHeadClass}>Đăng nhập gần nhất</th>
                    <th className={tableHeadClass}>Ngày tạo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F3F1EE]">
                  {items.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-[13px] text-[#A8A49C]">
                        Không có người dùng phù hợp
                      </td>
                    </tr>
                  ) : (
                    items.map((u) => (
                      <tr key={u._id} className="hover:bg-[#FAF9F7]">
                        <td className={tableCellClass}>
                          <Link href={`/admin/users/${u._id}`} className="font-semibold text-[#554DB0] hover:underline">
                            {u.email}
                          </Link>
                          {u.name && <div className="text-[11px] text-[#8A867E]">{u.name}</div>}
                        </td>
                        <td className={tableCellClass}>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                              u.role === "admin" ? "bg-[#EFEEF9] text-[#554DB0]" : "bg-[#F0EEEA] text-[#6B6862]"
                            }`}
                          >
                            {u.role}
                          </span>
                        </td>
                        <td className={tableCellClass}>
                          {u.isActive ? (
                            <span className="text-[#2F7A4F] font-semibold">Hoạt động</span>
                          ) : (
                            <span className="text-[#B03030] font-semibold">Đã khoá</span>
                          )}
                        </td>
                        <td className={`${tableCellClass} text-right`}>{formatNumber(u.walletBalance)}</td>
                        <td className={`${tableCellClass} text-right`}>{formatNumber(u.projectsCount)}</td>
                        <td className={tableCellClass}>{formatDateTime(u.lastLoginAt)}</td>
                        <td className={tableCellClass}>{formatDateTime(u.createdAt)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {meta && totalPages > 1 && (
          <div className="flex items-center justify-center gap-3 text-[12.5px] text-[#6B6862]">
            <button
              type="button"
              disabled={page <= 1 || loading}
              onClick={() => {
                setLoading(true);
                setParams((prev) => ({ ...prev, page: page - 1 }));
              }}
              className="px-4 py-1.5 rounded-full border border-[#E4E1DC] bg-white font-semibold hover:bg-[#FAF9F7] disabled:opacity-50 cursor-pointer"
            >
              ← Trước
            </button>
            <span>
              Trang {page}/{totalPages}
            </span>
            <button
              type="button"
              disabled={page >= totalPages || loading}
              onClick={() => {
                setLoading(true);
                setParams((prev) => ({ ...prev, page: page + 1 }));
              }}
              className="px-4 py-1.5 rounded-full border border-[#E4E1DC] bg-white font-semibold hover:bg-[#FAF9F7] disabled:opacity-50 cursor-pointer"
            >
              Sau →
            </button>
          </div>
        )}
      </div>
    </>
  );
}
