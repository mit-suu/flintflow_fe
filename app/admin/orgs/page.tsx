"use client";

import { useEffect, useState } from "react";
import {
  fetchAdminOrgs,
  formatDateTime,
  formatNumber,
  type AdjustOrgCreditsResult,
  type AdminOrg,
  type AdminOrgPlan,
  type FetchOrgsParams,
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
import AdjustCreditsDialog from "./_components/AdjustCreditsDialog";
import { userErrorMessage } from "@/lib/api/error-messages";

const PAGE_SIZE = 20;

/** UC-90 — danh sách tổ chức; mở một org để điều chỉnh credit (UC-68). */
export default function AdminOrgsPage() {
  const [search, setSearch] = useState("");
  const [params, setParams] = useState<FetchOrgsParams>({ page: 1, limit: PAGE_SIZE });
  const [items, setItems] = useState<AdminOrg[]>([]);
  const [meta, setMeta] = useState<PageMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [adjusting, setAdjusting] = useState<AdminOrg | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetchAdminOrgs(params);
        if (cancelled) return;
        setItems(res.items);
        setMeta(res.meta);
        setError(null);
      } catch (err) {
        if (!cancelled) setError(userErrorMessage(err, "Không thể tải danh sách tổ chức"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [params]);

  const update = (patch: FetchOrgsParams) => {
    setLoading(true);
    setParams((prev) => ({ ...prev, page: 1, ...patch }));
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    update({ q: search.trim() || undefined });
  };

  const handleAdjusted = (result: AdjustOrgCreditsResult) => {
    setItems((prev) =>
      prev.map((o) =>
        o.id === result.organizationId
          ? {
              ...o,
              wallet: { balance: result.balance, reserved: result.reserved, available: result.balance - result.reserved },
            }
          : o
      )
    );
    const sign = result.amount > 0 ? "+" : "";
    setNotice(`${sign}${formatNumber(result.amount)} credit cho ${result.organizationName}. Số dư mới: ${formatNumber(result.balance)}.`);
  };

  const page = meta?.page ?? 1;
  const totalPages = meta?.totalPages ?? 1;

  return (
    <>
      <AdminTopBar trail={["Tổ chức"]} />
      <div className="flex-1 overflow-y-auto flex flex-col gap-5 p-6 sm:p-8">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <h1 className="text-[24px] font-extrabold text-[#191817] tracking-tight">Tổ chức</h1>
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
                placeholder="Tìm theo tên hoặc email người tạo"
                aria-label="Tìm tổ chức"
                className={`${inputClass} w-[260px]`}
              />
              <button
                type="submit"
                className="h-9 px-4 rounded-[10px] bg-[#191817] text-white text-[12.5px] font-semibold hover:opacity-90 cursor-pointer"
              >
                Tìm
              </button>
            </form>
            <select
              value={params.plan ?? ""}
              onChange={(e) => update({ plan: (e.target.value || undefined) as AdminOrgPlan | undefined })}
              aria-label="Lọc theo gói"
              className={inputClass}
            >
              <option value="">Mọi gói</option>
              <option value="free">Free</option>
              <option value="pro">Pro</option>
            </select>
          </div>
        </div>

        {error && <ErrorBanner message={error} onClose={() => setError(null)} />}
        {notice && (
          <div
            role="status"
            className="flex items-center gap-3 bg-[#EAF6EE] border border-[#C2E5CF] text-[#1F7A45] px-4 py-3 rounded-[12px] text-xs font-medium"
          >
            <span className="flex-1">{notice}</span>
            <button type="button" onClick={() => setNotice(null)} className="font-bold hover:opacity-75">
              ✕
            </button>
          </div>
        )}

        <div className="bg-white border border-[#ECEAE5] rounded-[16px] overflow-hidden">
          {loading ? (
            <LoadingBlock label="Đang tải tổ chức…" bare />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-[#FAF9F7]">
                  <tr>
                    <th className={tableHeadClass}>Tổ chức</th>
                    <th className={tableHeadClass}>Gói</th>
                    <th className={`${tableHeadClass} text-right`}>Số dư ví</th>
                    <th className={`${tableHeadClass} text-right`}>Thành viên</th>
                    <th className={`${tableHeadClass} text-right`}>Dự án</th>
                    <th className={tableHeadClass}>Ngày tạo</th>
                    <th className={tableHeadClass}>
                      <span className="sr-only">Thao tác</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F3F1EE]">
                  {items.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-[13px] text-[#A8A49C]">
                        Không có tổ chức phù hợp
                      </td>
                    </tr>
                  ) : (
                    items.map((o) => (
                      <tr key={o.id} className="hover:bg-[#FAF9F7]">
                        <td className={tableCellClass}>
                          <div className="font-semibold text-[#191817]">{o.name}</div>
                          <div className="text-[11px] text-[#8A867E]">{o.owner?.email ?? "Người tạo đã xoá"}</div>
                        </td>
                        <td className={tableCellClass}>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                              o.plan === "pro" ? "bg-[#EFEEF9] text-[#554DB0]" : "bg-[#F0EEEA] text-[#6B6862]"
                            }`}
                          >
                            {o.planLabel}
                          </span>
                        </td>
                        <td className={`${tableCellClass} text-right`}>
                          {o.wallet ? (
                            <>
                              <div className="font-semibold">{formatNumber(o.wallet.balance)}</div>
                              {o.wallet.reserved > 0 && (
                                <div className="text-[11px] text-[#8A867E]">đang giữ {formatNumber(o.wallet.reserved)}</div>
                              )}
                            </>
                          ) : (
                            <span className="text-[#A8A49C]">Chưa có ví</span>
                          )}
                        </td>
                        <td className={`${tableCellClass} text-right`}>{formatNumber(o.membersCount)}</td>
                        <td className={`${tableCellClass} text-right`}>{formatNumber(o.projectsCount)}</td>
                        <td className={tableCellClass}>{formatDateTime(o.createdAt)}</td>
                        <td className={`${tableCellClass} text-right`}>
                          <button
                            type="button"
                            onClick={() => {
                              setNotice(null);
                              setAdjusting(o);
                            }}
                            aria-label={`Điều chỉnh credit của ${o.name}`}
                            className="h-8 px-3 rounded-[10px] border border-[#E4E1DC] bg-white text-[12px] font-bold text-[#554DB0] hover:bg-[#F2F1FB] whitespace-nowrap cursor-pointer"
                          >
                            Điều chỉnh credit
                          </button>
                        </td>
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

      <AdjustCreditsDialog org={adjusting} onClose={() => setAdjusting(null)} onAdjusted={handleAdjusted} />
    </>
  );
}
