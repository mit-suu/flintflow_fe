"use client";

import { useTranslations } from "next-intl";
import Icon from "@/components/ui/Icon";
import type { ExtractionSection, ImportedDocument, ImportStatus } from "@/types/import";
import PausedBanner from "../mode1/PausedBanner";

interface ImportProgressProps {
  doc: ImportedDocument;
  /** Tiến độ đọc nội dung theo mục (BE `extraction.sections`). */
  sections: ExtractionSection[];
  busy?: boolean;
  onResume: () => void;
}

const PHASES = ["read", "build", "check"] as const;
type Phase = (typeof PHASES)[number];

/** Pha hiện tại theo trạng thái import do BE trả — FE không tự suy tiến độ. */
const phaseOf = (status: ImportStatus): Phase => (status === "checking" ? "check" : status === "baselining" ? "build" : "read");

/**
 * Tiến độ đọc file trong workspace: ba pha chữ thường — Đọc nội dung (x/y mục) → Dựng tài liệu → Kiểm tra. Chạy nền trên BE,
 * người dùng rời trang được. Dừng (hết credit / AI lỗi) ⇒ banner Tiếp tục; AI quá tải ⇒ dòng "đang đọc lại".
 */
export default function ImportProgress({ doc, sections, busy = false, onResume }: ImportProgressProps) {
  const t = useTranslations("workspace.import.progress");
  const current = phaseOf(doc.status);
  const currentIndex = PHASES.indexOf(current);
  const done = sections.filter((s) => s.status === "done").length;
  const total = sections.length;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h2 className="text-heading font-bold text-on-surface">{t("title")}</h2>
        <p className="text-body text-on-surface-variant">{t("canLeave")}</p>
      </header>

      {doc.paused && (
        <PausedBanner
          paused={doc.paused}
          what={t(`paused.${current}`)}
          {...(doc.status === "baselining" ? { interrupted: t("interrupted") } : {})}
          busy={busy}
          onResume={onResume}
        />
      )}

      <p className="sr-only" aria-live="polite">
        {t(`phase.${current}`)}
      </p>

      <ol aria-label={t("phasesLabel")} className="flex flex-col gap-1 rounded-card bg-surface-container p-2">
        {PHASES.map((phase, i) => {
          const state = i < currentIndex ? "done" : i === currentIndex ? "active" : "todo";
          return (
            <li
              key={phase}
              aria-current={state === "active" ? "step" : undefined}
              className={`flex items-center gap-3 rounded-control px-3 py-2.5 ${state === "active" ? "bg-surface-container-lowest" : ""}`}
            >
              <span className="w-6 h-6 shrink-0 flex items-center justify-center">
                {state === "done" ? (
                  <Icon name="check-circle" size={18} className="text-success" />
                ) : state === "active" && !doc.paused ? (
                  <Icon name="spinner" size={18} className="text-primary animate-spin" />
                ) : (
                  <span className={`w-2 h-2 rounded-full ${state === "active" ? "bg-primary" : "bg-on-surface-subtle"}`} />
                )}
              </span>
              <span className={`flex-1 text-body ${state === "todo" ? "text-on-surface-muted" : "text-on-surface font-semibold"}`}>
                {t(`phase.${phase}`)}
                {phase === "read" && total > 0 && <span className="ml-2 text-caption font-normal text-on-surface-muted tabular-nums">{t("sections", { done, total })}</span>}
              </span>
              <span className="sr-only">{t(`state.${state}`)}</span>
            </li>
          );
        })}
      </ol>

      {doc.reread && (
        <p role="status" aria-live="polite" className="flex items-center gap-2 text-caption text-on-surface-muted">
          <Icon name="refresh" size={14} />
          {t(doc.reread.kind === "images" ? "reread.images" : "reread.text", { done: doc.reread.done, total: doc.reread.total })}
        </p>
      )}
    </div>
  );
}
