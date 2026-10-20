"use client";

import { useCallback, useEffect, useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import TopBar from "@/components/layout/TopBar";
import { Avatar, Badge, Button, CountBadge, DropdownMenu, IconButton, Modal } from "@/components/ui";
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
import { userErrorMessage } from "@/lib/api/error-messages";

const ROLES: OrgRole[] = ["lead", "analyst", "viewer"];
const INVITABLE: InvitableRole[] = ["analyst", "viewer"];

type Pending = { kind: "remove"; member: OrgMember } | { kind: "leave" } | { kind: "delete" } | null;

/** Key tĩnh để next-intl kiểm được lúc biên dịch — ghép chuỗi động thì mất kiểm tra đó. */
const STATE_KEYS = {
  pending: "invitations.states.pending",
  accepted: "invitations.states.accepted",
  declined: "invitations.states.declined",
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
  const tc = useTranslations("app.common");
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

  const [inviteOpen, setInviteOpen] = useState(false);
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

  /** Đóng hộp thoại mời: xoá luôn mã vừa tạo — mã thô chỉ xem được một lần, giữ lại chỉ làm người sau tưởng còn dùng. */
  const closeInvite = () => {
    setInviteOpen(false);
    setCreatedCode(null);
    setInviteEmail("");
    setError(null);
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
  // BR-02: Lead duy nhất không rời được — khoá nút ngay từ đầu thay vì để bấm rồi mới báo lỗi.
  const soleLead = isLead && members.filter((m) => m.role === "lead").length === 1;
  const deleteConfirmed = org !== null && confirmText.trim() === org.name;

  const displayName = (m: OrgMember) => m.name || m.email;
  const date = (iso: string) => format.dateTime(new Date(iso), { dateStyle: "medium" });

  return (
    <>
      <TopBar trail={[tc("account"), t("title")]} />

      {/* AppShell khoá chiều cao (h-dvh, <main> overflow-hidden) ⇒ trang phải tự có vùng cuộn, giống billing/notifications */}
      <div className="flex-1 overflow-y-auto px-6 pt-6 sm:px-8 sm:pt-8 pb-scroll-end bg-surface-container-lowest">
        {/* Bề ngang theo nội dung thật: Lead có thêm cột phụ (lời mời, vùng xoá) nên cần rộng; người chỉ xem
            danh sách thì khung hẹp lại cho dễ đọc, không kéo một cột ra hết màn. */}
        <section className={`w-full mx-auto flex flex-col gap-6 ${isLead ? "max-w-[1200px]" : "max-w-[820px]"}`}>
          {/* Hành động chính của TRANG nằm cạnh tiêu đề trang, không phải ở thanh trên dùng chung mọi trang */}
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <h1 className="text-title font-bold text-on-surface tracking-tight">{t("title")}</h1>
                {members.length > 0 && <CountBadge count={members.length} />}
              </div>
              {org ? <p className="text-body text-on-surface-muted">{t("subtitle", { org: org.name })}</p> : null}
              {org && !isLead ? <p className="text-body text-on-surface-muted">{t("leadOnly")}</p> : null}
            </div>
            {isLead ? (
              <Button icon="plus" onClick={() => setInviteOpen(true)}>
                {t("invite.title")}
              </Button>
            ) : null}
          </div>

          {/* Đang mở hộp thoại thì lỗi hiện TRONG hộp thoại — ở đây sẽ nằm sau lớp mờ, người dùng không đọc được */}
          {error && pending === null && !inviteOpen ? (
            <p role="alert" className="rounded-control bg-error-container px-3 py-2 text-body text-on-error-container">
              {error}
            </p>
          ) : null}

          {/* Hai cột từ `lg`: danh sách bên trái, việc phụ của Lead (lời mời, xoá tổ chức) dồn sang cột phải —
              xếp dọc một cột thì trang dài gấp đôi mà hai bên vẫn trống. Dưới `lg` tự xuống một cột. */}
          <div className={`grid gap-6 items-start ${isLead ? "lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]" : ""}`}>
            {/* Phân tách bằng NỀN và khoảng cách, không bằng nét: một mảng nền mờ gom cả danh sách, mỗi dòng
                nổi lên nền trắng khi rê chuột. Không viền ngoài, không kẻ ngang.
                Tổ chức đông người thì danh sách tự cuộn trong khung, không kéo dài
                cả trang — tiêu đề và cột bên phải luôn nằm trong tầm mắt. */}
            <div
              role="list"
              className="flex flex-col gap-0.5 rounded-card bg-surface-container-low p-1.5 max-h-[60dvh] overflow-y-auto"
            >
            {members.map((m) => {
              const isSelf = m.userId === myUserId;
              const canManage = isLead && !isSelf;
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

                  {canManage ? (
                    <select
                      aria-label={t("roleLabel", { name: displayName(m) })}
                      value={m.role}
                      disabled={busy}
                      onChange={(e) => handleRoleChange(m, e.target.value as OrgRole)}
                      className="shrink-0 rounded-control bg-surface-container-high px-2 py-1.5 text-body text-on-surface cursor-pointer hover:bg-surface-container-highest transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    >
                      {ROLES.map((role) => (
                        <option key={role} value={role}>
                          {tRoles(role)}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <Badge tone={m.role === "lead" ? "primary" : "neutral"}>{tRoles(m.role)}</Badge>
                  )}

                  {/* Hành động phá huỷ nằm trong menu ⋮: để "Xoá khỏi tổ chức" lặp trên mọi dòng vừa nặng mắt
                      vừa dễ bấm nhầm. Dòng của chính mình thì hành động là "Rời tổ chức". */}
                  {canManage || isSelf ? (
                    <DropdownMenu
                      className="shrink-0"
                      items={[
                        canManage
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

            {isLead ? (
              <aside className="flex flex-col gap-6">
                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-2">
                    <h2 className="text-subtitle font-bold text-on-surface">{t("invitations.title")}</h2>
                    {invitations.length > 0 && <CountBadge count={invitations.length} />}
                  </div>
                  {invitations.length === 0 ? (
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
                  )}
                </div>

                <div className="flex flex-col gap-3 rounded-card bg-error-container px-4 py-4">
                  <h2 className="text-subtitle font-bold text-error">{t("danger.title")}</h2>
                  <p className="text-body text-on-error-container leading-[1.6]">{t("danger.body")}</p>
                  {aloneAsLead ? null : (
                    <p className="text-body text-on-error-container">{t("danger.onlyWhenAlone")}</p>
                  )}
                  <Button
                    variant="danger"
                    className="self-start"
                    disabled={busy || !aloneAsLead}
                    onClick={() => setPending({ kind: "delete" })}
                  >
                    {t("danger.cta")}
                  </Button>
                </div>
              </aside>
            ) : null}
          </div>

          <Modal open={inviteOpen} onClose={closeInvite} title={t("invite.title")}>
            <form onSubmit={handleInvite} className="flex flex-col gap-4">
              <label className="flex flex-col gap-1 text-body font-semibold text-on-surface">
                {t("invite.roleLabel")}
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as InvitableRole)}
                  className="rounded-control bg-surface-container px-2 py-2 text-body font-normal cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  {INVITABLE.map((role) => (
                    <option key={role} value={role}>
                      {tRoles(role)}
                    </option>
                  ))}
                </select>
              </label>
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
        </section>
      </div>
    </>
  );
}
