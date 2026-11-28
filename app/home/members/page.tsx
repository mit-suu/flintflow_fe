"use client";

import { useCallback, useEffect, useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import TopBar from "@/components/layout/TopBar";
import { Avatar, Badge, Button, DropdownMenu, FilterSelect, IconButton, Modal } from "@/components/ui";
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
  renameOrganization,
  revokeInvitation,
} from "@/lib/api/orgs";
import { refreshSession } from "@/lib/api/client";
import { decodeJwt, getAccessToken, getActiveOrgId } from "@/lib/api/token-store";
import type {
  CreatedInvitation,
  Invitation,
  InvitableRole,
  OrgMember,
  OrgRole,
  OrganizationDetail,
} from "@/types/organization";
import { ONBOARDING_PATH, ORGANIZATIONS_PATH } from "@/components/OrgGuard";
import { userErrorMessage } from "@/lib/api/error-messages";
import MembersShell, { InvitationsSkeleton, MembersListSkeleton } from "@/components/page-shells/MembersShell";
import { useActiveOrganizationState } from "@/lib/hooks/use-active-org";

const ROLES: OrgRole[] = ["lead", "analyst", "viewer"];
const INVITABLE: InvitableRole[] = ["analyst", "viewer"];
/** Như BE `ORG_NAME_MAX` (`organization.service.ts`) — ô nhập chặn sẵn, BE vẫn kiểm lại. */
const ORG_NAME_MAX = 80;

type Pending = { kind: "remove"; member: OrgMember } | { kind: "leave" } | { kind: "delete" } | null;

/** Key tĩnh để next-intl kiểm được lúc biên dịch — ghép chuỗi động thì mất kiểm tra đó. */
const STATE_KEYS = {
  pending: "invitations.states.pending",
  accepted: "invitations.states.accepted",
  revoked: "invitations.states.revoked",
  expired: "invitations.states.expired",
} as const;

/**
 * Thành viên của org đang mở — BPMN Flow 9: mời (UC-08, chỉ Lead), đổi vai trò / tự hạ vai trò khi có >= 2 Lead
 * (UC-14 / BR-02), xoá thành viên, tự rời tổ chức (UC-15), xoá tổ chức.
 */
export default function MembersPage() {
  const t = useTranslations("app.org.members");
  const tRoles = useTranslations("app.org.roles");
  const tc = useTranslations("app.common");
  const format = useFormatter();
  const orgId = getActiveOrgId();
  const token = getAccessToken();
  const myUserId = token ? (decodeJwt(token)?.userId ?? null) : null;

  const [org, setOrg] = useState<OrganizationDetail | null>(null);
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<Pending>(null);

  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteRole, setInviteRole] = useState<InvitableRole>("analyst");
  const [inviteEmail, setInviteEmail] = useState("");
  const [createdCode, setCreatedCode] = useState<CreatedInvitation | null>(null);
  const [confirmText, setConfirmText] = useState("");
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameValue, setRenameValue] = useState("");

  // Vai trò và tên lấy từ chi tiết org; lúc trang chưa tải xong thì dùng tổ chức đang mở trong store chung (đã có bản
  // nhớ / thanh bên đã đọc) ⇒ tiêu đề, nút Mời, cột phải của Lead vẽ đúng ngay, chỉ hai danh sách là khối giữ chỗ
  const { org: activeOrg } = useActiveOrganizationState();
  const role = org?.role ?? activeOrg?.role ?? null;
  const orgName = org?.name ?? activeOrg?.name ?? null;
  const isLead = role === "lead";

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
      setError(userErrorMessage(err));
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
    // Email bắt buộc (góp ý mentor): mã được gửi tới email này, mời mà không biết gửi cho ai là trái lẽ thường.
    if (!inviteEmail.trim()) {
      setError(t("invite.emailRequired"));
      return;
    }
    void run(async () => {
      const created = await createInvitation(orgId, inviteRole, inviteEmail.trim());
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

  /** Sau khi rời hoặc xoá org: cưỡng bức làm mới phiên để bỏ `orgId` cũ, rồi về chọn org hoặc onboarding (Flow 8). */
  const goToNextOrg = async () => {
    await refreshSession({ force: true });
    const remaining = await fetchMyOrganizations();
    window.location.assign(remaining.length > 0 ? ORGANIZATIONS_PATH : ONBOARDING_PATH);
  };

  /** Đóng hộp thoại mời: xoá luôn mã vừa tạo — mã thô chỉ xem được một lần, giữ lại chỉ làm người sau tưởng còn dùng. */
  const closeInvite = () => {
    setInviteOpen(false);
    setCreatedCode(null);
    setInviteEmail("");
    setError(null);
  };

  const openRename = () => {
    setRenameValue(orgName ?? "");
    setError(null);
    setRenameOpen(true);
  };

  const closeRename = () => {
    setRenameOpen(false);
    setError(null);
  };

  const renameTrimmed = renameValue.trim();
  const renameValid = renameTrimmed.length > 0 && renameTrimmed.length <= ORG_NAME_MAX && renameTrimmed !== orgName;

  /** UC-80. `renameOrganization` phát sự kiện đổi tổ chức ⇒ thanh bên tự đọc lại tên. */
  const handleRename = (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgId || !renameValid) return;
    void run(async () => {
      const renamed = await renameOrganization(orgId, renameTrimmed);
      setOrg((current) => (current ? { ...current, name: renamed.name } : current));
      setRenameOpen(false);
    });
  };

  const closePending = () => {
    setPending(null);
    setConfirmText("");
    setError(null);
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
  // BR-02: Lead duy nhất không rời hay tự hạ vai trò được — khoá nút ngay từ đầu thay vì để bấm rồi mới báo lỗi.
  const leadCount = members.filter((m) => m.role === "lead").length;
  const soleLead = isLead && leadCount === 1;
  const deleteConfirmed = org !== null && confirmText.trim() === org.name;

  // Lần tải đầu chưa xong (chưa có org, chưa lỗi) ⇒ chỉ vùng dữ liệu giữ chỗ; tiêu đề trang vẽ ngay
  const loading = org === null && error === null;
  const roleOptions = ROLES.map((role) => ({ value: role, label: tRoles(role) }));
  const inviteRoleOptions = INVITABLE.map((role) => ({ value: role, label: tRoles(role) }));
  const displayName = (m: OrgMember) => m.name || m.email;
  const date = (iso: string) => format.dateTime(new Date(iso), { dateStyle: "medium" });

  return (
    <>
      <TopBar trail={[tc("account"), t("title")]} />

      <MembersShell
        role={role}
        orgName={orgName ?? (loading ? null : undefined)}
        count={members.length}
        busy={busy}
        onRename={openRename}
        onInvite={() => setInviteOpen(true)}
        alert={
          error && pending === null && !inviteOpen && !renameOpen ? (
            <p role="alert" className="rounded-control bg-error-container px-3 py-2 text-body text-on-error-container">
              {error}
            </p>
          ) : null
        }
        list={
          loading ? (
            <MembersListSkeleton />
          ) : (
            <div
              role="list"
              className="flex flex-col gap-0.5 rounded-card bg-surface-container-low p-1.5 max-h-[60dvh] overflow-y-auto"
            >
            {members.map((m) => {
              const isSelf = m.userId === myUserId;
              const canChangeRole = isLead && (!isSelf || !soleLead);
              const canRemoveMember = isLead && !isSelf;
              return (
                <div
                  key={m.userId}
                  role="listitem"
                  className="flex flex-wrap items-center gap-3 rounded-control px-3 py-2.5 transition-colors hover:bg-surface-container-lowest"
                >
                  <Avatar name={m.name} email={m.email} size="md" />
                  <div className="min-w-0 flex-1">
                    <p className="text-heading font-semibold text-on-surface truncate">
                      {displayName(m)}
                      {isSelf ? <span className="ml-2 text-body font-medium text-primary">{t("you")}</span> : null}
                    </p>
                    {/* Email lấp đúng khoảng trống giữa tên và nút bằng thông tin phân biệt được người, thay vì để trắng */}
                    <p className="text-body text-on-surface-muted truncate">
                      {m.name ? <span className="mr-1">{m.email} ·</span> : null}
                      <span className="tabular-nums">{t("joined", { date: date(m.joinedAt) })}</span>
                    </p>
                    {isSelf && soleLead ? (
                      <p id="sole-lead-hint" className="mt-1 text-body text-on-surface-muted">
                        {aloneAsLead ? t("soleLeadAloneHint") : t("soleLeadHint")}
                      </p>
                    ) : null}
                  </div>

                  {canChangeRole ? (
                    // Danh sách nằm trong khung tự cuộn ⇒ `portal` để menu vai trò ở dòng cuối không bị khung cắt
                    <FilterSelect
                      className="shrink-0"
                      label={t("roleLabel", { name: displayName(m) })}
                      labelMode="value"
                      portal
                      value={m.role}
                      disabled={busy}
                      options={roleOptions}
                      onChange={(role) => handleRoleChange(m, role)}
                    />
                  ) : (
                    <Badge tone={m.role === "lead" ? "primary" : "neutral"}>{tRoles(m.role)}</Badge>
                  )}

                  {/* Hành động phá huỷ nằm trong menu ⋮: để "Xoá khỏi tổ chức" lặp trên mọi dòng vừa nặng mắt
                      vừa dễ bấm nhầm. Dòng của chính mình thì hành động luôn là "Rời tổ chức". */}
                  {canRemoveMember || isSelf ? (
                    <DropdownMenu
                      className="shrink-0"
                      floating
                      items={[
                        canRemoveMember
                          ? {
                              label: t("remove"),
                              icon: "trash",
                              tone: "danger",
                              disabled: busy,
                              onSelect: () => setPending({ kind: "remove", member: m }),
                            }
                          : {
                              label: t("leave"),
                              icon: "logout",
                              tone: "danger",
                              // BR-02: Lead duy nhất không rời được — khoá sẵn, kèm lời giải thích ngay trên dòng
                              disabled: busy || soleLead,
                              onSelect: () => setPending({ kind: "leave" }),
                            },
                      ]}
                      trigger={(props) => (
                        <IconButton
                          {...props}
                          icon="more"
                          size="sm"
                          label={t("rowActions", { name: displayName(m) })}
                          aria-describedby={isSelf && soleLead ? "sole-lead-hint" : undefined}
                        />
                      )}
                    />
                  ) : null}
                </div>
              );
            })}
            </div>
        )
        }
        invitationsCount={invitations.length}
        invitations={
          loading ? (
            <InvitationsSkeleton />
          ) : invitations.length === 0 ? (
            <p className="text-body text-on-surface-muted">{t("invitations.empty")}</p>
          ) : (
            <div
              role="list"
              className="flex flex-col gap-0.5 rounded-card bg-surface-container-low p-1.5 max-h-[40dvh] overflow-y-auto"
            >
              {invitations.map((inv) => (
                <div
                  key={inv.id}
                  role="listitem"
                  className="flex flex-wrap items-center gap-2 rounded-control px-3 py-2 transition-colors hover:bg-surface-container-lowest"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-body font-medium text-on-surface truncate">
                      {inv.email ?? t("invitations.noEmail")}
                    </p>
                    <p className="text-caption text-on-surface-muted">
                      {tRoles(inv.role)} · {t(STATE_KEYS[inv.state])}
                      {inv.state === "pending"
                        ? " · " + t("invitations.expires", { date: date(inv.expiresAt) })
                        : ""}
                    </p>
                  </div>
                  {inv.state === "pending" ? (
                    <Button size="sm" variant="ghost" disabled={busy} onClick={() => handleRevoke(inv)}>
                      {t("invitations.revoke")}
                    </Button>
                  ) : null}
                </div>
              ))}
            </div>
          )
        }
        aloneAsLead={aloneAsLead}
        onDeleteOrg={() => setPending({ kind: "delete" })}
      >

        <Modal open={inviteOpen} onClose={closeInvite} title={t("invite.title")}>
          <form onSubmit={handleInvite} className="flex flex-col gap-4">
            {/* Nhãn hiện phía trên là chữ thường, không phải <label for>: combobox tự mang tên qua aria-label */}
            <div className="flex flex-col gap-1">
              <span aria-hidden className="text-body font-semibold text-on-surface">
                {t("invite.roleLabel")}
              </span>
              <FilterSelect
                label={t("invite.roleLabel")}
                labelMode="value"
                fullWidth
                portal
                align="start"
                value={inviteRole}
                options={inviteRoleOptions}
                onChange={setInviteRole}
              />
            </div>
            <label className="flex flex-col gap-1 text-body font-semibold text-on-surface">
              {t("invite.emailLabel")}
              <input
                type="email"
                required
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder={t("invite.emailPlaceholder")}
                className="rounded-control bg-surface-container px-3 py-2 text-body font-normal outline-none focus:ring-2 focus:ring-primary"
              />
            </label>

            {error ? (
              <p role="alert" className="rounded-control bg-error-container px-3 py-2 text-body text-on-error-container">
                {error}
              </p>
            ) : null}

            {/* Mã thô chỉ trả về đúng lượt tạo ⇒ hiện ngay trong hộp thoại và giữ đó cho tới khi người dùng đóng */}
            {createdCode ? (
              <div className="rounded-card bg-primary-soft px-4 py-3">
                <p className="text-body font-semibold text-on-surface">{t("invite.codeTitle")}</p>
                <p className="my-1 font-mono text-title font-bold tracking-[0.2em] text-primary" data-testid="invite-code">
                  {createdCode.code}
                </p>
                <p className="text-body text-on-surface-muted">
                  {createdCode.email ? t("invite.codeSent", { email: createdCode.email }) : t("invite.codeBody")}
                </p>
              </div>
            ) : null}

            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={closeInvite} disabled={busy}>
                {createdCode ? tc("close") : t("cancel")}
              </Button>
              <Button type="submit" loading={busy}>
                {busy ? t("invite.creating") : t("invite.cta")}
              </Button>
            </div>
          </form>
        </Modal>

        {/* Đang gửi PATCH thì không đóng được (như nút Huỷ) — đóng giữa chừng sẽ mất lỗi BE trả về */}
        <Modal open={renameOpen} onClose={busy ? () => undefined : closeRename} title={t("rename.title")}>
          <form onSubmit={handleRename} className="flex flex-col gap-4">
            <label className="flex flex-col gap-1 text-body font-semibold text-on-surface">
              {t("rename.label")}
              <input
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                maxLength={ORG_NAME_MAX}
                autoComplete="off"
                className="rounded-control bg-surface-container px-3 py-2 text-body font-normal outline-none focus:ring-2 focus:ring-primary"
              />
              <span className="text-caption font-normal text-on-surface-muted">{t("rename.hint", { max: ORG_NAME_MAX })}</span>
            </label>
            {error ? (
              <p role="alert" className="rounded-control bg-error-container px-3 py-2 text-body text-on-error-container">
                {error}
              </p>
            ) : null}
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={closeRename} disabled={busy}>
                {t("cancel")}
              </Button>
              <Button type="submit" loading={busy} disabled={!renameValid}>
                {busy ? t("rename.saving") : t("rename.save")}
              </Button>
            </div>
          </form>
        </Modal>

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
            <p className="text-body text-on-surface-muted leading-[1.6]">
              {pending?.kind === "remove"
                ? t("removeBody", { name: displayName(pending.member) })
                : pending?.kind === "delete"
                  ? t("danger.dialogBody", { org: org?.name ?? "" })
                  : t("leaveBody", { org: org?.name ?? "" })}
            </p>
            {error ? (
              <p role="alert" className="rounded-control bg-error-container px-3 py-2 text-body text-on-error-container">
                {error}
              </p>
            ) : null}
            {pending?.kind === "delete" ? (
              <label className="flex flex-col gap-1 text-body font-semibold text-on-surface">
                {t("danger.confirmLabel", { org: org?.name ?? "" })}
                <input
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  autoComplete="off"
                  className="rounded-control bg-surface-container px-3 py-2 text-body font-normal outline-none focus:ring-2 focus:ring-primary"
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
      </MembersShell>
    </>
  );
}
