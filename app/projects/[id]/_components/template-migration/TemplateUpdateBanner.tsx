"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import Button from "@/components/ui/Button";
import Icon from "@/components/ui/Icon";
import type { TemplateUpdate } from "@/types/template-migration";

interface TemplateUpdateBannerProps {
  projectId: string;
  update: TemplateUpdate | null | undefined;
  /** Chỉ Lead / Analyst thấy (BE cũng chỉ trả `template_update` cho hai vai trò này). */
  canEdit: boolean;
  onUpdate: (target: { templateId: string; version: number }) => void;
  className?: string;
}

const dismissKey = (projectId: string, update: TemplateUpdate) => `flintflow_template_update_dismissed:${projectId}:${update.template_id}:${update.latest_version}`;

const wasDismissed = (key: string): boolean => {
  try {
    return typeof window !== "undefined" && window.sessionStorage.getItem(key) === "1";
  } catch {
    return false;
  }
};

/**
 * Mẫu tổ chức của dự án có bản mới hơn: mời cập nhật. "Để sau" chỉ ẩn trong phiên trình duyệt này (sessionStorage) — không gọi BE,
 * nên dự án vẫn ở mẫu cũ và lần sau mở lại phiên mới sẽ báo lại.
 */
export default function TemplateUpdateBanner({ projectId, update, canEdit, onUpdate, className }: TemplateUpdateBannerProps) {
  const t = useTranslations("mode1.templateMigration.banner");
  const [dismissedKey, setDismissedKey] = useState<string | null>(null);
  if (!canEdit || !update) return null;
  const key = dismissKey(projectId, update);
  if (dismissedKey === key || wasDismissed(key)) return null;

  const later = () => {
    try {
      window.sessionStorage.setItem(key, "1");
    } catch {
      // sessionStorage bị chặn (chế độ riêng tư): vẫn ẩn trong vòng đời component
    }
    setDismissedKey(key);
  };

  return (
    <section aria-label={t("aria")} className={`rounded-card bg-info-soft p-3 flex flex-wrap items-center gap-3 ${className ?? ""}`}>
      <Icon name="info" size={16} className="text-info shrink-0" />
      <p className="flex-1 min-w-[180px] text-body font-semibold text-on-surface">
        {t("message", { name: update.name, version: update.latest_version, current: update.current_version })}
      </p>
      <Button size="sm" onClick={() => onUpdate({ templateId: update.template_id, version: update.latest_version })}>
        {t("update")}
      </Button>
      <Button size="sm" variant="ghost" onClick={later}>
        {t("later")}
      </Button>
    </section>
  );
}
