"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
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

/**
 * Nhãn thay cho enum thô (FLF-247), dịch qua `admin.userDetail.*`. Giá trị lạ (BE thêm loại mới): loại giao dịch
 * hiện câu chung, còn lại hiện nguyên văn.
 */
const TX_TYPES = ["reserve", "deduct", "release", "purchase", "monthly_reset", "refund", "admin_adjust"] as const;
const TX_STATES = ["reserved", "deducted", "refunded", "expired"] as const;
const ORG_ROLES = ["lead", "analyst", "viewer"] as const;
const USER_ROLES = ["admin", "user"] as const;
const isOneOf = <T extends string>(list: readonly T[], value: string | null | undefined): value is T =>
  (list as readonly string[]).includes(value ?? "");

const REASON_MIN_LENGTH = 3;

/** UC-60 khoá / UC-61 mở khoá tài khoản — cả hai bắt buộc lý do. */
function AccountStatusCard({ user, onChanged }: { user: AdminUserDetail; onChanged: (status: AdminUserStatus) => void }) {
  const t = useTranslations("admin");
  const locale = useLocale();
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
      setError(userErrorMessage(err, t("userDetail.status.failed")));
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
        <CardTitle className="text-heading">{t("userDetail.status.title")}</CardTitle>
        <CardDescription className={user.isActive ? undefined : "text-on-error-container"}>
          {user.isActive ? (
            t("userDetail.status.activeHint")
          ) : (
            <>
              {t("userDetail.status.suspendedAt", { time: formatDateTime(user.suspendedAt, locale) })}
              {user.suspendReason && <> · {t("userDetail.status.reason", { reason: user.suspendReason })}</>}
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
            {user.isActive ? t("userDetail.status.suspend") : t("userDetail.status.unsuspend")}
          </Button>
        ) : (
          <div className="flex max-w-[520px] flex-col gap-3">
            {!user.isActive && <p className="text-body">{t("userDetail.status.unsuspendPrompt")}</p>}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="status-reason">
                {user.isActive ? t("userDetail.status.suspendReason") : t("userDetail.status.unsuspendReason")}
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
                {saving ? t("common.saving") : user.isActive ? t("userDetail.status.confirmSuspend") : t("userDetail.status.confirmUnsuspend")}
              </Button>
              <Button variant="outline" onClick={cancel} disabled={saving}>
                {t("common.cancel")}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function AdminUserDetailPage() {
  const t = useTranslations("admin");
  const locale = useLocale();
  const num = (value: number) => formatNumber(value, locale);
  const dateTime = (value: string | null) => formatDateTime(value, locale);
  const { id } = useParams<{ id: string }>();
  const [user, setUser] = useState<AdminUserDetail | null>(null);
  const [loading, setLoading] = useState(true);
  /** Lỗi tải gần nhất: giữ nguyên lỗi, dịch lúc render — đổi ngôn ngữ không phải tải lại. */
  const [error, setError] = useState<{ cause: unknown } | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const next = await fetchAdminUser(id);
        if (!cancelled) setUser(next);
      } catch (err) {
        if (!cancelled) setError({ cause: err });
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
        <BackLink href="/admin/users">{t("userDetail.back")}</BackLink>

        {error && <ErrorBanner message={userErrorMessage(error.cause, t("userDetail.loadFailed"))} />}

        <AdminScroll>
        {loading ? (
          <LoadingBlock label={t("userDetail.loading")} variant="page" />
        ) : (
          user && (
            <>
              <Card>
                <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center">
                  <div className="min-w-0 flex-1">
                    <h1 className="truncate text-subtitle font-extrabold">{user.email}</h1>
                    <div className="text-muted-foreground mt-0.5 text-body">
                      {user.name || t("userDetail.unnamed")} · {user.authProvider} ·{" "}
                      {user.emailVerified ? t("userDetail.emailVerified") : t("userDetail.emailUnverified")}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant="outline"
                      className={user.role === "admin" ? "border-primary/40 text-primary" : "text-muted-foreground"}
                    >
                      {isOneOf(USER_ROLES, user.role) ? t(`common.userRoles.${user.role}`) : user.role}
                    </Badge>
                    <Badge
                      variant="outline"
                      className={
                        user.isActive ? "border-success-border text-success" : "border-error-border text-destructive"
                      }
                    >
                      {user.isActive ? t("common.active") : t("common.suspended")}
                    </Badge>
                  </div>
                </CardContent>
              </Card>

              <AccountStatusCard user={user} onChanged={(status) => setUser({ ...user, ...status })} />

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard label={t("userDetail.organizations")} value={num(user.organizations.length)} />
                <StatCard label={t("common.projects")} value={num(user.projectsCount)} />
                <StatCard
                  label={t("common.lastLogin")}
                  value={<span className="text-heading">{dateTime(user.lastLoginAt)}</span>}
                />
                <StatCard
                  label={t("common.createdAt")}
                  value={<span className="text-heading">{dateTime(user.createdAt)}</span>}
                />
              </div>

              <Card className="gap-0 overflow-hidden pb-0">
                <CardHeader>
                  <CardTitle className="text-heading">{t("userDetail.orgsTitle")}</CardTitle>
                </CardHeader>
                <Table className="mt-4">
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("common.organization")}</TableHead>
                      <TableHead>{t("common.role")}</TableHead>
                      <TableHead>{t("userDetail.joined")}</TableHead>
                      <TableHead className="text-end">{t("common.walletBalance")}</TableHead>
                      <TableHead className="text-end">{t("userDetail.reserved")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {user.organizations.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-muted-foreground h-24 text-center">
                          {t("userDetail.noOrgs")}
                        </TableCell>
                      </TableRow>
                    ) : (
                      user.organizations.map((org) => (
                        <TableRow key={org.id}>
                          <TableCell className="font-semibold">{org.name}</TableCell>
                          <TableCell>{isOneOf(ORG_ROLES, org.role) ? t(`userDetail.orgRoles.${org.role}`) : org.role}</TableCell>
                          <TableCell>{dateTime(org.joinedAt)}</TableCell>
                          <TableCell className="text-end">
                            {org.wallet ? num(org.wallet.balance) : t("common.noWallet")}
                          </TableCell>
                          <TableCell className="text-end">
                            {org.wallet ? num(org.wallet.reserved) : "—"}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </Card>

              <Card className="gap-0 overflow-hidden pb-0">
                <CardHeader>
                  <CardTitle className="text-heading">{t("userDetail.txTitle")}</CardTitle>
                </CardHeader>
                <Table className="mt-4">
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("userDetail.time")}</TableHead>
                      <TableHead>{t("userDetail.type")}</TableHead>
                      <TableHead>{t("userDetail.action")}</TableHead>
                      <TableHead className="text-end">{t("userDetail.amount")}</TableHead>
                      <TableHead className="text-end">{t("userDetail.balanceAfter")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {user.recentTransactions.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-muted-foreground h-24 text-center">
                          {t("userDetail.noTx")}
                        </TableCell>
                      </TableRow>
                    ) : (
                      user.recentTransactions.map((tx) => (
                        <TableRow key={tx._id}>
                          <TableCell>{dateTime(tx.createdAt)}</TableCell>
                          <TableCell>
                            {isOneOf(TX_TYPES, tx.type) ? t(`userDetail.txTypes.${tx.type}`) : t("userDetail.txFallback")}
                            {tx.state && (
                              <span className="text-muted-foreground text-caption">
                                {" "}
                                · {isOneOf(TX_STATES, tx.state) ? t(`userDetail.txStates.${tx.state}`) : tx.state}
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="font-mono text-caption">{tx.actionType}</TableCell>
                          <TableCell className="text-end">{num(tx.amount)}</TableCell>
                          <TableCell className="text-end">{num(tx.balanceAfter)}</TableCell>
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
