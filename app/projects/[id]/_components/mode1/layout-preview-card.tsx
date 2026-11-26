"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import Button from "@/components/ui/Button";
import Icon from "@/components/ui/Icon";
import { confirmLayoutPreview, getLayoutPreview } from "@/lib/api/import";
import type { LayoutPreview } from "@/types/import";

/**
 * Business-flow bước 2.9a (chế độ 4): xem trước bố cục mới của tài liệu, người dùng xác nhận rồi bản in mới áp. Chỉ hiện khi dự án
 * là chế độ 4 đang soạn và chưa xác nhận; chế độ khác / đã xác nhận / không đọc được ⇒ không hiện gì.
 */
export default function LayoutPreviewCard({ projectId, canEdit = true, className = "" }: { projectId: string; canEdit?: boolean; className?: string }) {
  const t = useTranslations("workspace.layoutPreview");
  const [preview, setPreview] = useState<LayoutPreview | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getLayoutPreview(projectId)
      .then((res) => !cancelled && setPreview(res.data ?? null))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  if (done) {
    return (
      <div role="status" className={`${className} flex items-center gap-2 rounded-card bg-surface-container px-3 py-2.5 text-body text-on-surface`}>
        <Icon name="check" size={16} className="shrink-0 text-primary" />
        {t("confirmed")}
      </div>
    );
  }
  if (!preview?.applicable || preview.confirmed_at) return null;

  const confirm = async () => {
    setBusy(true);
    setFailed(false);
    try {
      await confirmLayoutPreview(projectId);
      setDone(true);
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section aria-label={t("title")} className={`${className} flex flex-col gap-2 rounded-card bg-surface-container px-3 py-2.5`}>
      <div className="flex items-start gap-3">
        <Icon name="layers" size={16} className="mt-0.5 shrink-0 text-primary" />
        <div className="flex-1 min-w-0 flex flex-col gap-0.5">
          <h3 className="text-body font-semibold text-on-surface">{t("title")}</h3>
          <p className="text-body text-on-surface-variant">{t("intro")}</p>
        </div>
      </div>
      <ol className="max-h-56 overflow-y-auto ff-scroll flex flex-col gap-0.5 text-body text-on-surface">
        {preview.sections.map((s) => (
          <li key={s.section_id} style={{ paddingLeft: `${(Math.max(1, s.level) - 1) * 12}px` }} className="flex items-baseline gap-2">
            <span className={s.origin === "out_of_scope" ? "text-on-surface-variant" : ""}>{s.title}</span>
            {s.origin === "added" && <span className="text-caption font-medium text-primary-hover">{t("originAdded")}</span>}
            {s.origin === "out_of_scope" && <span className="text-caption font-medium text-accent-gold-text">{t("originOutOfScope")}</span>}
          </li>
        ))}
      </ol>
      <div className="flex items-center gap-3">
        <Button size="sm" loading={busy} disabled={!canEdit} onClick={confirm}>
          {busy ? t("confirming") : t("confirm")}
        </Button>
        {failed && <span role="alert" className="text-caption text-error">{t("failed")}</span>}
      </div>
    </section>
  );
}
