"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import Button from "@/components/ui/Button";
import type { RevertBlockReason } from "@/types/template-migration";

interface RevertMigrationButtonProps {
  busy: boolean;
  /** BE đã từ chối (409 `TEMPLATE_MIGRATION_REVERT_BLOCKED`): đã có thay đổi ghi sau lần đổi mẫu ⇒ chỉ còn đổi mẫu ngược. */
  blocked: boolean;
  /** BE báo hoàn tác được không (`revertable`); `null` / thiếu = chưa biết (tin vào 409 khi bấm). */
  revertable?: boolean | null;
  reason?: RevertBlockReason | null;
  onRevert: () => void;
}

/**
 * "Hoàn tác lần đổi mẫu": chỉ có nghĩa khi chưa có change request nào ghi sau lần đổi. BE không báo trước điều kiện này nên nút hiện
 * cho lần đổi mẫu mới nhất đã áp dụng; bị từ chối thì thay bằng lời chỉ sang đổi mẫu ngược (giữ mọi change request đã ghi).
 */
export default function RevertMigrationButton({ busy, blocked, revertable = null, reason = null, onRevert }: RevertMigrationButtonProps) {
  const t = useTranslations("mode1.templateMigration.revert");
  const [asking, setAsking] = useState(false);

  const reasonKey: RevertBlockReason = reason ?? "has_later_changes";
  if (blocked || revertable === false) {
    return (
      <p role="status" className="rounded-card bg-accent-gold-soft p-3 text-body text-accent-gold-text">
        {t(`reason.${reasonKey}`)}
      </p>
    );
  }
  if (!asking) {
    return (
      <Button size="sm" variant="secondary" disabled={busy} onClick={() => setAsking(true)}>
        {t("action")}
      </Button>
    );
  }
  return (
    <div className="rounded-card bg-surface-container-low p-3 flex flex-col gap-2">
      <p className="text-body text-on-surface-variant">{t("confirmQuestion")}</p>
      <div className="flex gap-2">
        <Button size="sm" variant="secondary" disabled={busy} onClick={() => setAsking(false)}>
          {t("keep")}
        </Button>
        <Button size="sm" variant="danger" loading={busy} onClick={onRevert}>
          {t("confirm")}
        </Button>
      </div>
    </div>
  );
}
