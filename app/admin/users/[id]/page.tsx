"use client";

import { useEffect, useState } from "react";
import BackLink from "@/components/ui/BackLink";
import { useParams } from "next/navigation";
import {
  fetchAdminUser,
  formatDateTime,
  formatNumber,
  setAdminUserStatus,
  type AdminUserDetail,
  type AdminUserStatus,
} from "@/lib/api/admin";
import type { CreditTransaction } from "@/lib/api/billing";
import {
  AdminTopBar,
  ErrorBanner,
  LoadingBlock,
  StatCard,
  tableCellClass,
  tableHeadClass,
} from "../../_components/AdminPage";
import { userErrorMessage } from "@/lib/api/error-messages";

const TX_LABELS: Record<CreditTransaction["type"], string> = {
  reserve: "Giữ credit",
  deduct: "Trừ credit",
  release: "Hoàn credit",
  purchase: "Nạp credit",
  monthly_reset: "Reset hằng tháng",
  refund: "Hoàn credit",
  admin_adjust: "Điều chỉnh credit",
};

/** Nhãn thay cho enum thô (FLF-247) — admin chỉ tiếng Việt. */
const USER_ROLE_LABELS: Record<string, string> = { admin: "Quản trị viên", user: "Người dùng" };
const ORG_ROLE_LABELS: Record<string, string> = { lead: "Lead", analyst: "Analyst", viewer: "Viewer" };
const TX_STATE_LABELS: Record<string, string> = { reserved: "đang giữ", deducted: "đã trừ", refunded: "đã hoàn", expired: "hết hạn" };

const REASON_MIN_LENGTH = 3;

/** UC-66 khoá (bắt buộc lý do) / UC-67 mở khoá tài khoản. */
function AccountStatusCard({ user, onChanged }: { user: AdminUserDetail; onChanged: (status: AdminUserStatus) => void }) {
  const [confirming, setConfirming] = useState(false);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reasonTooShort = reason.trim().length < REASON_MIN_LENGTH;

  const submit = async () => {
    setSaving(true);
    setError(null);
    try {
      const status = await setAdminUserStatus(
        user._id,
        user.isActive ? { isActive: false, reason: reason.trim() } : { isActive: true }
      );
      onChanged(status);
      setConfirming(false);
      setReason("");
    } catch (err) {
      setError(userErrorMessage(err, "Không thể cập nhật trạng thái tài khoản"));
    } finally {
      setSaving(false);
    }
  };

  const cancel = () => {
    setConfirming(false);
    setReason("");
    setError(null);
  };

  return (
    <div className="bg-white border border-[#ECEAE5] rounded-[16px] px-6 py-5 flex flex-col gap-3">
      <div>
        <h2 className="text-[14px] font-bold text-[#191817]">Trạng thái tài khoản</h2>
        {user.isActive ? (
          <p className="text-[12.5px] text-[#8A867E] mt-1">
            Khoá tài khoản sẽ đăng xuất người này khỏi mọi thiết bị và chặn đăng nhập cho tới khi được mở khoá.
          </p>
        ) : (
          <p className="text-[12.5px] text-[#8A4141] mt-1">
            Đã khoá lúc {formatDateTime(user.suspendedAt)}
            {user.suspendReason && <> · Lý do: {user.suspendReason}</>}
          </p>
        )}
      </div>

      {error && <ErrorBanner message={error} onClose={() => setError(null)} />}

      {!confirming ? (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className={`self-start h-9 px-4 rounded-[10px] text-[12.5px] font-bold transition-colors ${
            user.isActive
              ? "border border-[#F2CACA] text-[#B03030] bg-white hover:bg-[#FDEDED]"
              : "border border-[#C2E5CF] text-[#1F7A45] bg-white hover:bg-[#EAF6EE]"
          }`}
        >
          {user.isActive ? "Khoá tài khoản" : "Mở khoá tài khoản"}
        </button>
      ) : (
        <div className="flex flex-col gap-3 max-w-[520px]">
          {user.isActive ? (
            <label className="flex flex-col gap-1.5">
              <span className="text-[12px] font-bold text-[#6B6862]">Lý do khoá (bắt buộc)</span>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                maxLength={500}
                rows={3}
                autoFocus
                className="px-3 py-2 rounded-[10px] border border-[#E4E1DC] bg-white text-[12.5px] text-[#191817] focus:outline-none focus:border-[#6A62C4]"
              />
            </label>
          ) : (
            <p className="text-[12.5px] text-[#33312D]">Mở khoá để người này đăng nhập lại được?</p>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void submit()}
              disabled={saving || (user.isActive && reasonTooShort)}
              className={`h-9 px-4 rounded-[10px] text-white text-[12.5px] font-bold disabled:opacity-60 ${
                user.isActive ? "bg-[#B03030] hover:bg-[#962828]" : "bg-[#2F7A4F] hover:bg-[#276742]"
              }`}
            >
              {saving ? "Đang lưu…" : user.isActive ? "Xác nhận khoá" : "Xác nhận mở khoá"}
            </button>
            <button
              type="button"
              onClick={cancel}
              disabled={saving}
              className="h-9 px-4 rounded-[10px] border border-[#E4E1DC] text-[12.5px] font-bold text-[#6B6862] bg-[#FAF9F7] hover:bg-[#F0EEEA] disabled:opacity-60"
            >
              Huỷ
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

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
        if (!cancelled) setError(userErrorMessage(err, "Không thể tải người dùng"));
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
        <BackLink href="/admin/users">Danh sách người dùng</BackLink>

        {error && <ErrorBanner message={error} />}

        {loading ? (
          <LoadingBlock label="Đang tải người dùng…" variant="page" />
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
                    {USER_ROLE_LABELS[user.role] ?? user.role}
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

              <AccountStatusCard user={user} onChanged={(status) => setUser({ ...user, ...status })} />

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard label="Tổ chức" value={formatNumber(user.organizations.length)} />
                <StatCard label="Dự án" value={formatNumber(user.projectsCount)} />
                <StatCard label="Đăng nhập gần nhất" value={<span className="text-[15px]">{formatDateTime(user.lastLoginAt)}</span>} />
                <StatCard label="Ngày tạo" value={<span className="text-[15px]">{formatDateTime(user.createdAt)}</span>} />
              </div>

              <div className="bg-white border border-[#ECEAE5] rounded-[16px] overflow-hidden">
                <h2 className="px-5 py-3.5 border-b border-[#F3F1EE] text-[14px] font-bold text-[#191817]">
                  Tổ chức tham gia
                </h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-[#FAF9F7]">
                      <tr>
                        <th className={tableHeadClass}>Tổ chức</th>
                        <th className={tableHeadClass}>Vai trò</th>
                        <th className={tableHeadClass}>Tham gia</th>
                        <th className={`${tableHeadClass} text-right`}>Số dư ví</th>
                        <th className={`${tableHeadClass} text-right`}>Đang giữ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#F3F1EE]">
                      {user.organizations.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-10 text-center text-[13px] text-[#A8A49C]">
                            Chưa tham gia tổ chức nào
                          </td>
                        </tr>
                      ) : (
                        user.organizations.map((org) => (
                          <tr key={org.id}>
                            <td className={`${tableCellClass} font-semibold`}>{org.name}</td>
                            <td className={tableCellClass}>{ORG_ROLE_LABELS[org.role] ?? org.role}</td>
                            <td className={tableCellClass}>{formatDateTime(org.joinedAt)}</td>
                            <td className={`${tableCellClass} text-right`}>
                              {org.wallet ? formatNumber(org.wallet.balance) : "Chưa có ví"}
                            </td>
                            <td className={`${tableCellClass} text-right`}>
                              {org.wallet ? formatNumber(org.wallet.reserved) : "—"}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
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
                              {TX_LABELS[tx.type] ?? "Giao dịch credit"}
                              {tx.state && <span className="text-[11px] text-[#8A867E]"> · {TX_STATE_LABELS[tx.state] ?? tx.state}</span>}
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
