"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import Button from "@/components/ui/Button";
import Icon from "@/components/ui/Icon";
import { userErrorMessage } from "@/lib/api/error-messages";
import type { ScreenMockupRunView } from "@/types/project";

interface ScreenMockupRunCardProps {
  run: ScreenMockupRunView;
  /** Tên màn để báo kết quả; thiếu ⇒ mã màn. */
  nameOf: (screenId: string) => string;
  onCancel: () => Promise<void>;
  onDismiss: () => void;
  /** Thử lại các màn lỗi (một lượt mới). */
  onRetry: (screenIds: string[]) => Promise<void>;
  /** Áp màu ảnh gốc gợi ý cho cả dự án. */
  onApplyColor: (color: string) => Promise<void>;
}

/** Xong gọn (không lỗi, không gợi ý màu) ⇒ chip tự ẩn sau chừng này. */
const AUTO_DISMISS_MS = 8000;

/**
 * Lượt "Vẽ lại bằng mockup" chạy nền (FLF-410) dưới dạng **pill nhỏ góc dưới trái khung tài liệu** — không chiếm header. Pill:
 * "Mockup 3/17" khi chạy, "Đã vẽ 3 màn" / "2 màn lỗi" khi xong. Bấm mở popover chi tiết (mở lên trên): tiến độ + Dừng, màn lỗi +
 * Thử lại, gợi ý màu ảnh gốc. Nền phẳng, không viền.
 */
export default function ScreenMockupRunCard({ run, nameOf, onCancel, onDismiss, onRetry, onApplyColor }: ScreenMockupRunCardProps) {
  const t = useTranslations("workspace.screenMockupRun");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const names = (ids: readonly string[]) => ids.map(nameOf).join(", ");

  const running = run.status === "running";
  const failedIds = run.failed.map((f) => f.screen_id);
  const needsAttention = failedIds.length > 0 || Boolean(run.suggested_color) || run.status === "interrupted" || run.fell_back_to_system.length > 0;

  // Xong gọn ⇒ tự ẩn (popover đang mở thì chờ người dùng đóng)
  useEffect(() => {
    if (running || needsAttention || open) return;
    const timer = setTimeout(onDismiss, AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [running, needsAttention, open, onDismiss]);

  // Bấm ra ngoài / Esc ⇒ đóng popover
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const act = async (action: () => Promise<void>, failed: string) => {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(userErrorMessage(err, failed));
    } finally {
      setBusy(false);
    }
  };

  const chipLabel = running
    ? t("chipRunning", { done: run.completed, total: run.total })
    : failedIds.length > 0
      ? t("chipFailed", { count: failedIds.length })
      : run.total === 0 && run.done.length === 0
        ? t("chipNothing")
        : t("chipDone", { count: run.done.length });
  const chipTone = running ? "bg-surface-container-lowest text-primary" : failedIds.length > 0 || run.status === "interrupted" ? "bg-error-container text-error" : "bg-surface-container-lowest text-success";
  const title = running
    ? run.stopping
      ? t("stopping", { done: run.completed, total: run.total })
      : t("running", { done: run.completed, total: run.total })
    : run.total === 0
      ? run.done.length > 0
        ? t("reenabled", { count: run.done.length })
        : t("nothingToDo")
      : run.done.length === 0 && failedIds.length > 0
        ? t("allFailed", { count: failedIds.length })
        : run.status === "done"
        ? t("finished", { count: run.done.length })
        : run.status === "interrupted"
          ? t("interrupted")
          : t("stopped", { count: run.done.length });

  return (
    <div ref={boxRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="dialog"
        title={title}
        className={`h-8 px-3 flex items-center gap-1.5 whitespace-nowrap rounded-full text-caption font-bold cursor-pointer transition-colors hover:opacity-90 shadow-[0_6px_20px_rgba(0,0,0,0.18)] ${chipTone}`}
      >
        <Icon name={running ? "spinner" : failedIds.length > 0 ? "warning" : "check-circle"} size={14} className={running ? "animate-spin" : ""} />
        {chipLabel}
      </button>

      {open && (
        <div role="dialog" aria-label={title} className="absolute left-0 bottom-full mb-2 z-40 w-[320px] max-w-[calc(100vw-2rem)] rounded-card bg-surface-container-lowest shadow-lg px-4 py-3 flex flex-col gap-2.5">
          <div className="flex items-start gap-2">
            <p className="text-body font-bold text-on-surface flex-1 leading-[1.4]">{title}</p>
            {!running && (
              <button type="button" onClick={onDismiss} aria-label={t("dismiss")} title={t("dismiss")} className="size-7 -mr-1 -mt-0.5 inline-flex items-center justify-center rounded-control text-on-surface-variant hover:bg-surface-container-high cursor-pointer">
                <Icon name="close" size={14} />
              </button>
            )}
          </div>
          {running && (
            <>
              <div className="h-1.5 rounded-full bg-surface-container-high overflow-hidden" aria-hidden>
                <div className="h-full bg-primary transition-[width] duration-500" style={{ width: `${run.total ? (run.completed / run.total) * 100 : 0}%` }} />
              </div>
              <p className="text-caption text-on-surface-variant">{t("runningNote")}</p>
              {!run.stopping && (
                <div className="flex justify-end">
                  <Button size="sm" variant="secondary" disabled={busy} onClick={() => void act(onCancel, t("cancelFailed"))}>
                    {t("stop")}
                  </Button>
                </div>
              )}
            </>
          )}
          {!running && run.fell_back_to_system.length > 0 && <p className="text-body text-on-surface-variant">{t("fellBack", { names: names(run.fell_back_to_system) })}</p>}
          {!running && failedIds.length > 0 && (
            <div className="flex flex-col gap-2 bg-error-container rounded-control px-3 py-2">
              <p className="text-body text-on-error-container">{t("failed", { names: names(failedIds) })}</p>
              <Button size="sm" variant="secondary" disabled={busy} onClick={() => void act(() => onRetry(failedIds), t("retryFailed"))}>
                {t("retry")}
              </Button>
            </div>
          )}
          {!running && run.suggested_color && (
            <div className="flex items-center gap-2">
              <span aria-hidden className="size-5 rounded-full shrink-0" style={{ backgroundColor: run.suggested_color }} />
              <span className="text-body text-on-surface flex-1">{t("suggestedColor", { color: run.suggested_color })}</span>
              <Button size="sm" disabled={busy} onClick={() => void act(() => onApplyColor(run.suggested_color!), t("applyColorFailed"))}>
                {t("applyColor")}
              </Button>
            </div>
          )}
          {error && (
            <p role="alert" className="text-caption text-error">
              {error}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
