"use client";

import { useCallback, useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import Icon from "@/components/ui/Icon";
import { listAutoPassed, markAutoPassedSeen } from "@/lib/api/review-level";
import { tStep, type Locale } from "@/lib/i18n";
import type { AutoPassedItem } from "@/types/review-level";

interface AutoPassedChipProps {
  projectId: string;
  /** Đổi giá trị ⇒ tải lại (sau khi bước mới tự qua, sau khi mở lại trang). */
  refreshKey?: unknown;
}

/**
 * FLF-337 "Chưa xem": trước mỗi cổng cứng đưa tài liệu ra ngoài (gửi duyệt / ký baseline / gửi gói / phát hành) hiện số thay
 * đổi AI đã tự qua mà người dùng chưa mở xem; bấm mở danh sách, xem từng cái; **không bắt xem hết** — nút gửi vẫn bấm được.
 * Không có gì chưa xem ⇒ không hiện.
 */
export default function AutoPassedChip({ projectId, refreshKey }: AutoPassedChipProps) {
  const t = useTranslations("workspace.autoPassed");
  const locale = useLocale() as Locale;
  const [items, setItems] = useState<AutoPassedItem[]>([]);
  const [unseen, setUnseen] = useState(0);
  const [open, setOpen] = useState(false);

  const reload = useCallback(
    () =>
      listAutoPassed(projectId)
        .then((res) => {
          setItems(res.data?.items ?? []);
          setUnseen(res.data?.unseen ?? 0);
        })
        .catch(() => undefined),
    [projectId]
  );

  useEffect(() => {
    void reload();
  }, [reload, refreshKey]);

  const seen = async (ids?: string[]) => {
    const res = await markAutoPassedSeen(projectId, ids).catch(() => null);
    if (!res) return;
    setUnseen(res.data?.unseen ?? 0);
    setItems((prev) => prev.map((i) => (!ids || ids.includes(i.id) ? { ...i, seen: true } : i)));
  };

  if (unseen === 0 && !open) return null;

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="self-start inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-caption font-bold bg-accent-gold-soft text-accent-gold-text cursor-pointer"
      >
        <Icon name="sparkle" size={12} />
        {t("chip", { count: unseen })}
      </button>
      {open && (
        <div className="rounded-control border border-outline-variant bg-surface-container-lowest p-3 flex flex-col gap-2" aria-label={t("listAria")}>
          <p className="text-caption text-on-surface-muted">{t("note")}</p>
          <ul className="flex flex-col gap-1.5">
            {items.map((item) => (
              <li key={item.id} className={`flex items-start gap-2 text-body ${item.seen ? "text-on-surface-muted" : "text-on-surface"}`}>
                <span className="flex-1 min-w-0">
                  <span className="font-bold">{tStep(item.step_id, locale) || item.label_vi}</span>
                  <span className="block text-caption">{item.reason_vi}</span>
                </span>
                {!item.seen && (
                  <button type="button" onClick={() => void seen([item.id])} className="text-caption font-bold underline cursor-pointer whitespace-nowrap">
                    {t("markSeen")}
                  </button>
                )}
              </li>
            ))}
          </ul>
          {unseen > 0 && (
            <button type="button" onClick={() => void seen()} className="self-end text-caption font-bold underline cursor-pointer">
              {t("markAllSeen")}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
