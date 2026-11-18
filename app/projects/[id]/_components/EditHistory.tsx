"use client";

import { useEffect } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { Locale } from "@/lib/i18n";
import type { Change } from "@/types/spine";
import { describeChange } from "./describe-change";
import { workspaceStepLabel } from "./phase-labels";

interface EditHistoryProps {
  history: Change[];
  loading: boolean;
  /** Tải 20 thay đổi gần nhất (`GET /changes`). */
  onLoad: () => void;
}

const timeOf = (iso: string, locale: Locale): string => {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleString(locale === "en" ? "en-US" : "vi-VN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" });
};

/** Lịch sử sửa gần đây, viết thành câu dễ đọc (mới nhất trước) — thay cho danh sách op thô của Change panel cũ. */
export default function EditHistory({ history, loading, onLoad }: EditHistoryProps) {
  const t = useTranslations("workspace.editHistory");
  const locale = useLocale();
  useEffect(() => {
    onLoad();
  }, [onLoad]);

  if (loading) return <p className="text-body text-on-surface-subtle italic">{t("loading")}</p>;
  if (history.length === 0) return <p className="text-body text-on-surface-subtle italic">{t("empty")}</p>;

  return (
    <ul className="flex flex-col gap-1">
      {[...history].reverse().map((change) => (
        <li key={`${change.txn}:${change.seq}`} className="rounded-inner bg-surface-container-lowest px-2.5 py-1.5 flex flex-col gap-0.5">
          <span className="text-body text-on-surface leading-relaxed break-words">{describeChange(change, locale)}</span>
          <span className="text-caption text-on-surface-subtle">
            {timeOf(change.at, locale)} · {change.step_id ? t("byStep", { label: workspaceStepLabel(change.step_id, locale) }) : t("byCommand")}
          </span>
        </li>
      ))}
    </ul>
  );
}
