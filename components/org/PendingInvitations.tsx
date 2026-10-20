"use client";

import { useEffect, useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { Button, Card } from "@/components/ui";
import { acceptMyInvitation, declineMyInvitation, fetchMyInvitations } from "@/lib/api/orgs";
import { userErrorMessage } from "@/lib/api/error-messages";
import type { MyInvitation } from "@/types/organization";

/**
 * Vào org xong phải TẢI LẠI HẲN trang (cùng lý do với onboarding): layout `/home` đang giữ dự án, ví của org cũ —
 * hoặc lỗi "chưa có org" — trong bộ nhớ, điều hướng phía client không dựng lại.
 */
const enterApp = () => window.location.assign("/home");

/**
 * Lời mời đang chờ của chính người đăng nhập — chấp nhận / từ chối ngay, không phải gõ mã (như lời mời collaborator
 * của GitHub). Dùng ở onboarding (chưa thuộc org nào) và trang Tổ chức (đã có org). Không có lời mời thì không hiện
 * gì: đây là lối tắt, trang vẫn đủ nghĩa khi thiếu nó.
 */
export default function PendingInvitations() {
  const t = useTranslations("app.org.pendingInvites");
  const tRoles = useTranslations("app.org.roles");
  const format = useFormatter();
  const [invitations, setInvitations] = useState<MyInvitation[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    fetchMyInvitations()
      .then((list) => mounted && setInvitations(list))
      // Không tải được thì thôi không hiện — người dùng vẫn nhập mã từ email được
      .catch(() => undefined);
    return () => {
      mounted = false;
    };
  }, []);

  const act = async (invitation: MyInvitation, action: "accept" | "decline") => {
    setBusyId(invitation.id);
    setError(null);
    try {
      if (action === "accept") {
        await acceptMyInvitation(invitation.id);
        enterApp();
        return;
      }
      await declineMyInvitation(invitation.id);
      setInvitations((list) => list.filter((inv) => inv.id !== invitation.id));
    } catch (err) {
      setError(userErrorMessage(err));
    }
    setBusyId(null);
  };

  if (invitations.length === 0) return null;

  const date = (iso: string) => format.dateTime(new Date(iso), { dateStyle: "medium" });

  return (
    <section aria-labelledby="pending-invites-title" className="flex flex-col gap-2">
      <h2 id="pending-invites-title" className="text-heading font-semibold text-on-surface">
        {t("title")}
      </h2>
      {error ? (
        <p role="alert" className="rounded-control bg-error-container px-3 py-2 text-body text-on-error-container">
          {error}
        </p>
      ) : null}
      <div role="list" className="flex flex-col gap-2">
        {invitations.map((inv) => (
          <Card key={inv.id} role="listitem" className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
            <div className="min-w-0">
              <p className="text-heading font-semibold text-on-surface truncate">{inv.organizationName}</p>
              <p className="text-body text-on-surface-muted">
                {t("line", { inviter: inv.inviterName, role: tRoles(inv.role), date: date(inv.expiresAt) })}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="secondary"
                disabled={busyId !== null}
                onClick={() => void act(inv, "decline")}
              >
                {t("decline")}
              </Button>
              <Button
                size="sm"
                loading={busyId === inv.id}
                disabled={busyId !== null}
                onClick={() => void act(inv, "accept")}
              >
                {t("accept")}
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </section>
  );
}
