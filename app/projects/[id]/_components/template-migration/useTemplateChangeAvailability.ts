"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { listBaselines } from "@/lib/api/export";
import { getReviewPackage } from "@/lib/api/versions";
import type { OrgRole } from "@/types/organization";
import { useTemplateMigration } from "../../hooks/useTemplateMigration";

/**
 * Đổi mẫu có mở được không và vì sao (dùng chung cho mục "Đổi mẫu" ở menu ⋯ của header và thẻ trạng thái đổi mẫu trong
 * panel): chỉ Lead / Analyst; chặn kèm lý do khi chưa có baseline, bản nháp đang chờ Lead duyệt, hoặc lần đổi mẫu đang áp dụng.
 *
 * `enabled = false` (dự án chưa đổi mẫu được, vd AI soạn chưa có baseline) ⇒ không gọi BE. `checkPackage`: chỉ dự án nhập SRS có
 * gói thay đổi (`GET /review-package` chỉ phục vụ mode 1) ⇒ dự án AI soạn không hỏi.
 */
export function useTemplateChangeAvailability(
  projectId: string,
  orgRole: OrgRole | null,
  refreshToken = 0,
  { enabled = true, checkPackage = true }: { enabled?: boolean; checkPackage?: boolean } = {}
) {
  const t = useTranslations("mode1.templateMigration.entry");
  const allowed = (orgRole === "lead" || orgRole === "analyst") && enabled;
  const migration = useTemplateMigration(projectId, { enabled: allowed, fallbackError: t("loadFailed") });
  const [hasBaseline, setHasBaseline] = useState<boolean | null>(null);
  const [draftLocked, setDraftLocked] = useState(false);
  const { reload } = migration;

  useEffect(() => {
    if (!allowed) return;
    let cancelled = false;
    void Promise.all([
      listBaselines(projectId).then((r) => (r.data ?? []).length > 0),
      checkPackage ? getReviewPackage(projectId).then((r) => r.data?.status === "pending") : Promise.resolve(false),
    ])
      .then(([baseline, locked]) => {
        if (cancelled) return;
        setHasBaseline(baseline);
        setDraftLocked(locked);
      })
      // Không đọc được điều kiện ⇒ không tự chặn: BE kiểm lại và trả đúng mã lỗi khi bắt đầu
      .catch(() => !cancelled && setHasBaseline(true));
    return () => {
      cancelled = true;
    };
  }, [projectId, refreshToken, allowed, checkPackage]);

  // Hook đổi mẫu đã tải lần đầu; chỉ đọc lại khi token đổi sau đó
  const lastToken = useRef(refreshToken);
  useEffect(() => {
    if (lastToken.current === refreshToken) return;
    lastToken.current = refreshToken;
    if (allowed) void reload();
  }, [refreshToken, reload, allowed]);

  const running = migration.open?.state === "applying" || migration.open?.state === "reverting";
  const reason = hasBaseline === false ? t("noBaseline") : draftLocked ? t("draftLocked") : running ? t("applying") : null;

  return { allowed, reason, migration };
}

export type TemplateChangeAvailability = ReturnType<typeof useTemplateChangeAvailability>;
