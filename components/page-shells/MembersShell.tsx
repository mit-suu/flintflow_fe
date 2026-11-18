"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Button, CountBadge, IconButton, Skeleton } from "@/components/ui";
import type { OrgRole } from "@/types/organization";

interface MembersShellProps {
  /** Vai trò trong tổ chức; `null` khi chưa biết (khung hẹp, chưa có nút của Lead). */
  role: OrgRole | null;
  /** Tên tổ chức cho dòng phụ đề; `null` khi đang tải ⇒ thanh giữ chỗ; `undefined` (tải lỗi) ⇒ không có dòng. */
  orgName?: string | null;
  /** Số thành viên; chưa biết ⇒ `undefined`. */
  count?: number;
  busy?: boolean;
  onRename: () => void;
  onInvite: () => void;
  alert?: ReactNode;
  /** Cột trái: danh sách thành viên (hoặc khối giữ chỗ). */
  list: ReactNode;
  /** Cột phải của Lead — lời mời: số lời mời và thân danh sách (hoặc khối giữ chỗ). */
  invitationsCount?: number;
  invitations: ReactNode;
  /** Vùng xoá tổ chức của Lead: chỉ bấm được khi là thành viên duy nhất. */
  aloneAsLead: boolean;
  onDeleteOrg: () => void;
  /** Hộp thoại của trang (portal ra body, đặt ở đây cho gọn). */
  children?: ReactNode;
}

/**
 * Khung trang Thành viên: vùng cuộn, tiêu đề + số người, dòng "Thành viên của …" (+ đổi tên), nút Mời, hai cột (danh sách |
 * lời mời + xoá tổ chức của Lead). Trang thật và khung chờ đăng nhập (`ShellSkeleton`) cùng dựng từ đây ⇒ lúc tải lại hình
 * trùng nhau; chỉ hai danh sách là khối giữ chỗ, nút và tiêu đề luôn vẽ thật.
 */
export default function MembersShell({
  role,
  orgName,
  count,
  busy = false,
  onRename,
  onInvite,
  alert,
  list,
  invitationsCount,
  invitations,
  aloneAsLead,
  onDeleteOrg,
  children,
}: MembersShellProps) {
  const t = useTranslations("app.org.members");
  const isLead = role === "lead";
  return (
    // AppShell khoá chiều cao (h-dvh, <main> overflow-hidden) ⇒ trang phải tự có vùng cuộn, giống billing/notifications
    <div className="flex-1 overflow-y-auto px-6 pt-6 sm:px-8 sm:pt-8 pb-scroll-end bg-surface-container-lowest">
      {/* Bề ngang theo nội dung thật: Lead có thêm cột phụ (lời mời, vùng xoá) nên cần rộng; người chỉ xem
          danh sách thì khung hẹp lại cho dễ đọc, không kéo một cột ra hết màn. */}
      <section className={`w-full mx-auto flex flex-col gap-6 ${isLead ? "max-w-[1200px]" : "max-w-[820px]"}`}>
        {/* Hành động chính của TRANG nằm cạnh tiêu đề trang, không phải ở thanh trên dùng chung mọi trang */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <h1 className="text-title font-bold text-on-surface tracking-tight">{t("title")}</h1>
              {count !== undefined && count > 0 && <CountBadge count={count} />}
            </div>
            {orgName ? (
              <div className="flex items-center gap-1">
                <p className="text-body text-on-surface-muted">{t("subtitle", { org: orgName })}</p>
                {isLead ? <IconButton icon="pencil" size="sm" label={t("rename.open")} disabled={busy} onClick={onRename} /> : null}
              </div>
            ) : orgName === null ? (
              <Skeleton className="h-4 w-64" />
            ) : null}
            {role && !isLead ? <p className="text-body text-on-surface-muted">{t("leadOnly")}</p> : null}
          </div>
          {isLead ? (
            <Button icon="plus" onClick={onInvite}>
              {t("invite.title")}
            </Button>
          ) : null}
        </div>

        {alert}

        {/* Hai cột từ `lg`: danh sách bên trái, việc phụ của Lead (lời mời, xoá tổ chức) dồn sang cột phải —
            xếp dọc một cột thì trang dài gấp đôi mà hai bên vẫn trống. Dưới `lg` tự xuống một cột. */}
        <div className={`grid gap-6 items-start ${isLead ? "lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]" : ""}`}>
          {list}

          {isLead ? (
            <aside className="flex flex-col gap-6">
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <h2 className="text-subtitle font-bold text-on-surface">{t("invitations.title")}</h2>
                  {invitationsCount !== undefined && invitationsCount > 0 && <CountBadge count={invitationsCount} />}
                </div>
                {invitations}
              </div>

              <div className="flex flex-col gap-3 rounded-card bg-error-container px-4 py-4">
                <h2 className="text-subtitle font-bold text-error">{t("danger.title")}</h2>
                <p className="text-body text-on-error-container leading-[1.6]">{t("danger.body")}</p>
                {aloneAsLead ? null : <p className="text-body text-on-error-container">{t("danger.onlyWhenAlone")}</p>}
                <Button variant="danger" className="self-start" disabled={busy || !aloneAsLead} onClick={onDeleteOrg}>
                  {t("danger.cta")}
                </Button>
              </div>
            </aside>
          ) : null}
        </div>

        {children}
      </section>
    </div>
  );
}

/** Danh sách thành viên đang tải: cùng khung với danh sách thật (mảng nền mờ, dòng không kẻ ngang): avatar, tên + email, vai trò. */
export function MembersListSkeleton() {
  const t = useTranslations("app.org.members");
  return (
    <div role="status" aria-busy="true" aria-label={t("loading")} className="flex flex-col gap-0.5 rounded-card bg-surface-container-low p-1.5">
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex items-center gap-3 px-3 py-2.5">
          <Skeleton className="size-10 rounded-full shrink-0" />
          <div className="flex-1 flex flex-col gap-2">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-64 max-w-full" />
          </div>
          <Skeleton className="h-7 w-20 shrink-0" />
        </div>
      ))}
    </div>
  );
}

/** Danh sách lời mời đang tải: email + dòng vai trò · trạng thái. */
export function InvitationsSkeleton() {
  return (
    <div aria-hidden className="flex flex-col gap-0.5 rounded-card bg-surface-container-low p-1.5">
      {[0, 1].map((i) => (
        <div key={i} className="flex flex-col gap-2 px-3 py-2.5">
          <Skeleton className="h-3.5 w-48 max-w-full" />
          <Skeleton className="h-3 w-28" />
        </div>
      ))}
    </div>
  );
}

const noop = () => undefined;

/** Trang Thành viên lúc đang tải lần đầu, dùng cho khung chờ đăng nhập (vai trò, tên tổ chức lấy từ bản nhớ). */
export function MembersLoading({ role, orgName }: { role: OrgRole | null; orgName: string | null }) {
  return (
    <MembersShell
      role={role}
      orgName={orgName}
      onRename={noop}
      onInvite={noop}
      list={<MembersListSkeleton />}
      invitations={<InvitationsSkeleton />}
      aloneAsLead={false}
      onDeleteOrg={noop}
    />
  );
}
