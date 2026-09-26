"use client";

import { useCallback, useEffect, useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import {
  changeMemberRole,
  createInvitation,
  deleteOrganization,
  fetchInvitations,
  fetchMembers,
  fetchMyOrganizations,
  fetchOrganization,
  leaveOrganization,
  removeMember,
  revokeInvitation,
  switchOrganization,
} from "@/lib/api/orgs";
import { decodeJwt, getActiveOrgId, getStoredAuthToken } from "@/lib/api/token-store";
import type {
  CreatedInvitation,
  Invitation,
  InvitableRole,
  OrgMember,
  OrgRole,
  OrganizationDetail,
} from "@/types/organization";
import { ONBOARDING_PATH } from "@/components/OrgGuard";

const ROLES: OrgRole[] = ["lead", "analyst", "viewer"];
const INVITABLE: InvitableRole[] = ["analyst", "viewer"];

type Pending = { kind: "remove"; member: OrgMember } | { kind: "leave" } | { kind: "delete" } | null;

/** Key tĩnh để next-intl kiểm được lúc biên dịch — ghép chuỗi động thì mất kiểm tra đó. */
const STATE_KEYS = {
  pending: "invitations.states.pending",
  accepted: "invitations.states.accepted",
  revoked: "invitations.states.revoked",
  expired: "invitations.states.expired",
} as const;

/**
 * Thành viên của org đang mở — BPMN Flow 9: mời (9.1–9.2), đổi vai trò (9.5), xoá (9.6), rời (9.7).
 * BR-02 (org phải còn ít nhất một Lead) do BE giữ; FE chỉ hiện lỗi LAST_LEAD khi BE từ chối.
 */
export default function MembersPage() {
  const t = useTranslations("app.org.members");
  const tRoles = useTranslations("app.org.roles");
  const format = useFormatter();
  const orgId = getActiveOrgId();
  const token = getStoredAuthToken();
  const myUserId = token ? (decodeJwt(token)?.userId ?? null) : null;

  const [org, setOrg] = useState<OrganizationDetail | null>(null);
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<Pending>(null);

  const [inviteRole, setInviteRole] = useState<InvitableRole>("analyst");
  const [inviteEmail, setInviteEmail] = useState("");
  const [createdCode, setCreatedCode] = useState<CreatedInvitation | null>(null);
  const [confirmText, setConfirmText] = useState("");

  const isLead = org?.role === "lead";

  /** Chỉ đọc dữ liệu, không đụng state — để effect bên dưới tự quyết khi nào gán. */
  const fetchAll = useCallback(async () => {
    if (!orgId) return null;
    const detail = await fetchOrganization(orgId);
    const [list, invites] = await Promise.all([
      fetchMembers(orgId),
      detail.role === "lead" ? fetchInvitations(orgId) : Promise.resolve<Invitation[]>([]),
    ]);
    return { detail, list, invites };
  }, [orgId]);

  // Setter của useState luôn ổn định ⇒ deps rỗng là đúng.
  const apply = useCallback((data: Awaited<ReturnType<typeof fetchAll>>) => {
    if (!data) return;
    setOrg(data.detail);
    setMembers(data.list);
    setInvitations(data.invites);
  }, []);

  useEffect(() => {
    let mounted = true;
    fetchAll()
      .then((data) => {
        if (mounted) apply(data);
      })
      .catch(() => mounted && setError(t("loadError")));
    return () => {
      mounted = false;
    };
  }, [fetchAll, apply, t]);

  /** Tải lại sau mỗi thao tác; lỗi để `run` bắt và hiện. */
  const load = async () => apply(await fetchAll());

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (err) {
      // ApiClientError đã dịch sẵn theo mã lỗi (vd LAST_LEAD, PLAN_LIMIT_MEMBERS)
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const handleRoleChange = (member: OrgMember, role: OrgRole) => {
    if (!orgId || role === member.role) return;
    void run(async () => {
      await changeMemberRole(orgId, member.userId, role);
      await load();
    });
  };

  const handleInvite = (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgId) return;
    void run(async () => {
      const created = await createInvitation(orgId, inviteRole, inviteEmail.trim() || undefined);
      setCreatedCode(created);
      setInviteEmail("");
      await load();
    });
  };

  const handleRevoke = (invitation: Invitation) => {
    if (!orgId) return;
    void run(async () => {
      await revokeInvitation(orgId, invitation.id);
      await load();
    });
  };

  /** Sau khi rời hoặc xoá org: token còn trỏ vào org cũ ⇒ mở org khác nếu còn, không thì về onboarding (Flow 8). */
  const goToNextOrg = async () => {
    const remaining = await fetchMyOrganizations();
    if (remaining.length > 0) {
      await switchOrganization(remaining[0].id);
      window.location.assign("/home");
    } else {
      window.location.assign(ONBOARDING_PATH);
    }
  };

  const closePending = () => {
    setPending(null);
    setConfirmText("");
  };

  const confirmPending = () => {
    if (!orgId || !pending) return;
    const action = pending;
    void run(async () => {
      if (action.kind === "remove") {
        await removeMember(orgId, action.member.userId);
        closePending();
        await load();
        return;
      }
      if (action.kind === "delete") {
        await deleteOrganization(orgId, confirmText.trim());
      } else {
        await leaveOrganization(orgId);
      }
      closePending();
      await goToNextOrg();
    });
  };

  const aloneAsLead = isLead && members.length === 1;
  const deleteConfirmed = org !== null && confirmText.trim() === org.name;

  const displayName = (m: OrgMember) => m.name || m.email;
  const date = (iso: string) => format.dateTime(new Date(iso), { dateStyle: "medium" });

  return (
    <section className="w-full max-w-[820px] mx-auto flex flex-col gap-8 pt-8 pb-12 px-4 sm:px-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-[22px] font-extrabold text-on-surface tracking-tight">{t("title")}</h1>
        {org ? <p className="text-[13.5px] text-on-surface-muted">{t("subtitle", { org: org.name })}</p> : null}
        {org && !isLead ? <p className="text-[12.5px] text-on-surface-muted">{t("leadOnly")}</p> : null}
      </div>

      {error ? (
        <p role="alert" className="rounded-lg bg-error-container px-3 py-2 text-[13px] text-on-error-container">
          {error}
        </p>
      ) : null}

      <ul className="flex flex-col gap-2">
        {members.map((m) => {
          const isSelf = m.userId === myUserId;
          return (
            <li
              key={m.userId}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-outline bg-surface-container-lowest px-4 py-3"
            >
              <div className="min-w-0">
                <p className="text-[14px] font-semibold text-on-surface truncate">
                  {displayName(m)}
                  {isSelf ? <span className="ml-2 text-[12px] font-medium text-primary">{t("you")}</span> : null}
                </p>
                <p className="text-[12px] text-on-surface-muted">{t("joined", { date: date(m.joinedAt) })}</p>
              </div>
              <div className="flex items-center gap-2">
                {isLead && !isSelf ? (
                  <select
                    aria-label={t("roleLabel", { name: displayName(m) })}
                    value={m.role}
                    disabled={busy}
                    onChange={(e) => handleRoleChange(m, e.target.value as OrgRole)}
                    className="rounded-lg border border-outline bg-surface px-2 py-1.5 text-[13px] text-on-surface"
                  >
                    {ROLES.map((role) => (
                      <option key={role} value={role}>
                        {tRoles(role)}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className="text-[13px] font-medium text-on-surface-variant">{tRoles(m.role)}</span>
                )}
                {isLead && !isSelf ? (
                  <Button size="sm" variant="ghost" disabled={busy} onClick={() => setPending({ kind: "remove", member: m })}>
                    {t("remove")}
                  </Button>
                ) : null}
                {isSelf ? (
                  <Button size="sm" variant="ghost" disabled={busy} onClick={() => setPending({ kind: "leave" })}>
                    {t("leave")}
                  </Button>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>

      {isLead ? (
        <div className="flex flex-col gap-4">
          <h2 className="text-[16px] font-bold text-on-surface">{t("invite.title")}</h2>
          <form onSubmit={handleInvite} className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1 text-[12.5px] font-semibold text-on-surface">
              {t("invite.roleLabel")}
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as InvitableRole)}
                className="rounded-lg border border-outline bg-surface px-2 py-2 text-[13px] font-normal"
              >
                {INVITABLE.map((role) => (
                  <option key={role} value={role}>
                    {tRoles(role)}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-1 min-w-[220px] flex-col gap-1 text-[12.5px] font-semibold text-on-surface">
              {t("invite.emailLabel")}
              <input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder={t("invite.emailPlaceholder")}
                className="rounded-lg border border-outline bg-surface px-3 py-2 text-[13px] font-normal"
              />
            </label>
            <Button type="submit" disabled={busy}>
              {busy ? t("invite.creating") : t("invite.cta")}
            </Button>
          </form>

          {createdCode ? (
            <div className="rounded-xl border border-primary/40 bg-primary-fixed/40 px-4 py-3">
              <p className="text-[13px] font-semibold text-on-surface">{t("invite.codeTitle")}</p>
              <p className="my-1 font-mono text-[20px] font-bold tracking-[0.2em] text-primary" data-testid="invite-code">
                {createdCode.code}
              </p>
              <p className="text-[12px] text-on-surface-muted">{t("invite.codeBody")}</p>
            </div>
          ) : null}

          <div className="flex flex-col gap-2">
            <h3 className="text-[14px] font-semibold text-on-surface">{t("invitations.title")}</h3>
            {invitations.length === 0 ? (
              <p className="text-[12.5px] text-on-surface-muted">{t("invitations.empty")}</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {invitations.map((inv) => (
                  <li
                    key={inv.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-outline px-3 py-2"
                  >
                    <div className="min-w-0 text-[13px]">
                      <span className="font-medium text-on-surface">{inv.email ?? t("invitations.noEmail")}</span>
                      <span className="ml-2 text-on-surface-muted">
                        {tRoles(inv.role)} · {t(STATE_KEYS[inv.state])}
                        {inv.state === "pending" ? " · " + t("invitations.expires", { date: date(inv.expiresAt) }) : ""}
                      </span>
                    </div>
                    {inv.state === "pending" ? (
                      <Button size="sm" variant="ghost" disabled={busy} onClick={() => handleRevoke(inv)}>
                        {t("invitations.revoke")}
                      </Button>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ) : null}

      {isLead ? (
        <div className="flex flex-col gap-3 rounded-xl border border-error/40 px-4 py-4">
          <h2 className="text-[16px] font-bold text-error">{t("danger.title")}</h2>
          <p className="text-[13px] text-on-surface-muted leading-[1.6]">{t("danger.body")}</p>
          {aloneAsLead ? null : <p className="text-[12.5px] text-on-surface-muted">{t("danger.onlyWhenAlone")}</p>}
          <Button
            variant="danger"
            className="self-start"
            disabled={busy || !aloneAsLead}
            onClick={() => setPending({ kind: "delete" })}
          >
            {t("danger.cta")}
          </Button>
        </div>
      ) : null}

      <Modal
        open={pending !== null}
        onClose={closePending}
        title={
          pending?.kind === "remove"
            ? t("removeTitle")
            : pending?.kind === "delete"
              ? t("danger.dialogTitle")
              : t("leaveTitle")
        }
      >
        <div className="flex flex-col gap-4">
          <p className="text-[13.5px] text-on-surface-muted leading-[1.6]">
            {pending?.kind === "remove"
              ? t("removeBody", { name: displayName(pending.member) })
              : pending?.kind === "delete"
                ? t("danger.dialogBody", { org: org?.name ?? "" })
                : t("leaveBody", { org: org?.name ?? "" })}
          </p>
          {pending?.kind === "delete" ? (
            <label className="flex flex-col gap-1 text-[12.5px] font-semibold text-on-surface">
              {t("danger.confirmLabel", { org: org?.name ?? "" })}
              <input
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                autoComplete="off"
                className="rounded-lg border border-outline bg-surface px-3 py-2 text-[13px] font-normal"
              />
            </label>
          ) : null}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={closePending} disabled={busy}>
              {t("cancel")}
            </Button>
            <Button
              variant="danger"
              onClick={confirmPending}
              loading={busy}
              disabled={pending?.kind === "delete" && !deleteConfirmed}
            >
              {pending?.kind === "delete" ? t("danger.confirmCta") : t("confirm")}
            </Button>
          </div>
        </div>
      </Modal>
    </section>
  );
}
