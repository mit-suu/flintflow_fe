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
import { Badge } from "@/components/shadcn/badge";
import { Button } from "@/components/shadcn/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/shadcn/card";
import { Label } from "@/components/shadcn/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/shadcn/table";
import { Textarea } from "@/components/shadcn/textarea";
import AdminHeader from "../../_components/AdminHeader";
import { AdminMain, AdminScroll, ErrorBanner, LoadingBlock, StatCard } from "../../_components/AdminPage";
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
const TX_STATE_LABELS: Record<string, string> = {
  reserved: "đang giữ",
  deducted: "đã trừ",
  refunded: "đã hoàn",
  expired: "hết hạn",
};

const REASON_MIN_LENGTH = 3;

/** UC-60 khoá / UC-61 mở khoá tài khoản — cả hai bắt buộc lý do. */
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
      const status = await setAdminUserStatus(user._id, { isActive: !user.isActive, reason: reason.trim() });
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
    <Card className="gap-3">
      <CardHeader>
        <CardTitle className="text-heading">Trạng thái tài khoản</CardTitle>
        <CardDescription className={user.isActive ? undefined : "text-on-error-container"}>
          {user.isActive ? (
            "Khoá tài khoản sẽ đăng xuất người này khỏi mọi thiết bị và chặn đăng nhập cho tới khi được mở khoá."
          ) : (
            <>
              Đã khoá lúc {formatDateTime(user.suspendedAt)}
              {user.suspendReason && <> · Lý do: {user.suspendReason}</>}
            </>
          )}
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-3">
        {error && <ErrorBanner message={error} onClose={() => setError(null)} />}

        {!confirming ? (
          <Button
            variant="outline"
            onClick={() => setConfirming(true)}
            className={user.isActive ? "text-destructive hover:bg-error-container" : "text-success hover:bg-success-soft"}
          >
            {user.isActive ? "Khoá tài khoản" : "Mở khoá tài khoản"}
          </Button>
        ) : (
          <div className="flex max-w-[520px] flex-col gap-3">
            {!user.isActive && <p className="text-body">Mở khoá để người này đăng nhập lại được?</p>}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="status-reason">
                {user.isActive ? "Lý do khoá (bắt buộc)" : "Lý do mở khoá (bắt buộc)"}
              </Label>
              <Textarea
                id="status-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                maxLength={500}
                rows={3}
                autoFocus
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant={user.isActive ? "destructive" : "default"}
                onClick={() => void submit()}
                disabled={saving || reasonTooShort}
              >
                {saving ? "Đang lưu…" : user.isActive ? "Xác nhận khoá" : "Xác nhận mở khoá"}
              </Button>
              <Button variant="outline" onClick={cancel} disabled={saving}>
                Huỷ
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
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
      <AdminHeader />
      <AdminMain>
        <BackLink href="/admin/users">Danh sách người dùng</BackLink>

        {error && <ErrorBanner message={error} />}

        <AdminScroll>
        {loading ? (
          <LoadingBlock label="Đang tải người dùng…" variant="page" />
        ) : (
          user && (
            <>
              <Card>
                <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center">
                  <div className="min-w-0 flex-1">
                    <h1 className="truncate text-subtitle font-extrabold">{user.email}</h1>
                    <div className="text-muted-foreground mt-0.5 text-body">
                      {user.name || "Chưa đặt tên"} · {user.authProvider} ·{" "}
                      {user.emailVerified ? "đã xác minh email" : "chưa xác minh email"}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant="outline"
                      className={user.role === "admin" ? "border-primary/40 text-primary" : "text-muted-foreground"}
                    >
                      {USER_ROLE_LABELS[user.role] ?? user.role}
                    </Badge>
                    <Badge
                      variant="outline"
                      className={
                        user.isActive ? "border-success-border text-success" : "border-error-border text-destructive"
                      }
                    >
                      {user.isActive ? "Hoạt động" : "Đã khoá"}
                    </Badge>
                  </div>
                </CardContent>
              </Card>

              <AccountStatusCard user={user} onChanged={(status) => setUser({ ...user, ...status })} />

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard label="Tổ chức" value={formatNumber(user.organizations.length)} />
                <StatCard label="Dự án" value={formatNumber(user.projectsCount)} />
                <StatCard
                  label="Đăng nhập gần nhất"
                  value={<span className="text-heading">{formatDateTime(user.lastLoginAt)}</span>}
                />
                <StatCard
                  label="Ngày tạo"
                  value={<span className="text-heading">{formatDateTime(user.createdAt)}</span>}
                />
              </div>

              <Card className="gap-0 overflow-hidden pb-0">
                <CardHeader>
                  <CardTitle className="text-heading">Tổ chức tham gia</CardTitle>
                </CardHeader>
                <Table className="mt-4">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tổ chức</TableHead>
                      <TableHead>Vai trò</TableHead>
                      <TableHead>Tham gia</TableHead>
                      <TableHead className="text-end">Số dư ví</TableHead>
                      <TableHead className="text-end">Đang giữ</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {user.organizations.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-muted-foreground h-24 text-center">
                          Chưa tham gia tổ chức nào
                        </TableCell>
                      </TableRow>
                    ) : (
                      user.organizations.map((org) => (
                        <TableRow key={org.id}>
                          <TableCell className="font-semibold">{org.name}</TableCell>
                          <TableCell>{ORG_ROLE_LABELS[org.role] ?? org.role}</TableCell>
                          <TableCell>{formatDateTime(org.joinedAt)}</TableCell>
                          <TableCell className="text-end">
                            {org.wallet ? formatNumber(org.wallet.balance) : "Chưa có ví"}
                          </TableCell>
                          <TableCell className="text-end">
                            {org.wallet ? formatNumber(org.wallet.reserved) : "—"}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </Card>

              <Card className="gap-0 overflow-hidden pb-0">
                <CardHeader>
                  <CardTitle className="text-heading">20 giao dịch credit gần nhất</CardTitle>
                </CardHeader>
                <Table className="mt-4">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Thời gian</TableHead>
                      <TableHead>Loại</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead className="text-end">Số credit</TableHead>
                      <TableHead className="text-end">Số dư sau</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {user.recentTransactions.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-muted-foreground h-24 text-center">
                          Chưa có giao dịch
                        </TableCell>
                      </TableRow>
                    ) : (
                      user.recentTransactions.map((tx) => (
                        <TableRow key={tx._id}>
                          <TableCell>{formatDateTime(tx.createdAt)}</TableCell>
                          <TableCell>
                            {TX_LABELS[tx.type] ?? "Giao dịch credit"}
                            {tx.state && (
                              <span className="text-muted-foreground text-caption">
                                {" "}
                                · {TX_STATE_LABELS[tx.state] ?? tx.state}
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="font-mono text-caption">{tx.actionType}</TableCell>
                          <TableCell className="text-end">{formatNumber(tx.amount)}</TableCell>
                          <TableCell className="text-end">{formatNumber(tx.balanceAfter)}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </Card>
            </>
          )
        )}
        </AdminScroll>
      </AdminMain>
    </>
  );
}
