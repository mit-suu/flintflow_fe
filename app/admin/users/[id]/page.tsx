"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { fetchAdminUser, formatDateTime, formatNumber, type AdminUserDetail } from "@/lib/api/admin";
import type { CreditTransaction } from "@/lib/api/billing";
import {
  AdminTopBar,
  ErrorBanner,
  LoadingBlock,
  StatCard,
  tableCellClass,
  tableHeadClass,
} from "../../_components/AdminPage";

const TX_LABELS: Record<CreditTransaction["type"], string> = {
  reserve: "Giữ credit",
  deduct: "Trừ credit",
  release: "Hoàn credit",
  purchase: "Nạp credit",
  monthly_reset: "Reset hằng tháng",
};

export default function AdminUserDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [user, setUser] = useState<AdminUserDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const next = await fetchAdminUser(id);
        if (!cancelled) setUser(next);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Không thể tải người dùng");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [id]);

  return (
    <>
      <AdminTopBar trail={["Người dùng", user?.email ?? "Chi tiết"]} />
      <div className="flex-1 overflow-y-auto flex flex-col gap-5 p-6 sm:p-8">
        <Link href="/admin/users" className="text-[12px] font-semibold text-[#6B6862] hover:text-[#191817] self-start">
          ← Danh sách người dùng
        </Link>

        {error && <ErrorBanner message={error} />}

        {loading ? (
          <LoadingBlock label="Đang tải người dùng…" />
        ) : (
          user && (
            <>
              <div className="bg-white border border-[#ECEAE5] rounded-[16px] px-6 py-5 flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="min-w-0 flex-1">
                  <h1 className="text-[20px] font-extrabold text-[#191817] truncate">{user.email}</h1>
                  <div className="text-[12.5px] text-[#8A867E] mt-0.5">
                    {user.name || "Chưa đặt tên"} · {user.authProvider} ·{" "}
                    {user.emailVerified ? "đã xác minh email" : "chưa xác minh email"}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`px-2.5 py-1 rounded-full text-[11.5px] font-bold ${
                      user.role === "admin" ? "bg-[#EFEEF9] text-[#554DB0]" : "bg-[#F0EEEA] text-[#6B6862]"
                    }`}
                  >
                    {user.role}
                  </span>
                  <span
                    className={`px-2.5 py-1 rounded-full text-[11.5px] font-bold ${
                      user.isActive ? "bg-[#E6F4EC] text-[#2F7A4F]" : "bg-[#FDEDED] text-[#B03030]"
                    }`}
                  >
                    {user.isActive ? "Hoạt động" : "Đã khoá"}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                  label="Số dư credit"
                  value={formatNumber(user.wallet?.balance ?? 0)}
                  hint={user.wallet ? `Đang giữ ${formatNumber(user.wallet.reserved)}` : "Chưa có ví"}
                />
                <StatCard label="Dự án" value={formatNumber(user.projectsCount)} />
                <StatCard label="Đăng nhập gần nhất" value={<span className="text-[15px]">{formatDateTime(user.lastLoginAt)}</span>} />
                <StatCard label="Ngày tạo" value={<span className="text-[15px]">{formatDateTime(user.createdAt)}</span>} />
              </div>

              <div className="bg-white border border-[#ECEAE5] rounded-[16px] overflow-hidden">
                <h2 className="px-5 py-3.5 border-b border-[#F3F1EE] text-[14px] font-bold text-[#191817]">
                  20 giao dịch credit gần nhất
                </h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-[#FAF9F7]">
                      <tr>
                        <th className={tableHeadClass}>Thời gian</th>
                        <th className={tableHeadClass}>Loại</th>
                        <th className={tableHeadClass}>Action</th>
                        <th className={`${tableHeadClass} text-right`}>Số credit</th>
                        <th className={`${tableHeadClass} text-right`}>Số dư sau</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#F3F1EE]">
                      {user.recentTransactions.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-10 text-center text-[13px] text-[#A8A49C]">
                            Chưa có giao dịch
                          </td>
                        </tr>
                      ) : (
                        user.recentTransactions.map((tx) => (
                          <tr key={tx._id}>
                            <td className={tableCellClass}>{formatDateTime(tx.createdAt)}</td>
                            <td className={tableCellClass}>
                              {TX_LABELS[tx.type] ?? tx.type}
                              {tx.state && <span className="text-[11px] text-[#8A867E]"> · {tx.state}</span>}
                            </td>
                            <td className={`${tableCellClass} font-mono text-[11.5px]`}>{tx.actionType}</td>
                            <td className={`${tableCellClass} text-right`}>{formatNumber(tx.amount)}</td>
                            <td className={`${tableCellClass} text-right`}>{formatNumber(tx.balanceAfter)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )
        )}
      </div>
    </>
  );
}
