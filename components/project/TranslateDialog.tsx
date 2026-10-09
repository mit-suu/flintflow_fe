"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef, useState, type ReactNode } from "react";
import Button from "@/components/ui/Button";
import Icon from "@/components/ui/Icon";
import Modal from "@/components/ui/Modal";
import { ApiClientError } from "@/lib/api/client";
import { userErrorMessage } from "@/lib/api/error-messages";
import { getTranslationStatus, runTranslation } from "@/lib/api/translations";
import type { TranslationRunResult, TranslationStatus } from "@/types/document";

/**
 * Số lô mỗi lượt `POST /translations/run` (BE nhận 1–10, bỏ trống ⇒ 5). Ít lô một lượt ⇒ thanh tiến độ nhích đều,
 * request ngắn, bấm "Dừng" / đóng hộp có hiệu lực sớm (vòng dừng sau lượt đang chạy). Hai lô chứ không phải một: lô AI
 * trả sai định dạng bị BE bỏ qua để chạy lô kia, thay vì làm cả lượt thành 422.
 */
export const BATCHES_PER_REQUEST = 2;

/** Kết quả một vòng dịch — tính trên mọi lượt `run` từ lúc bấm "Dịch". */
export interface TranslateResult {
  translated: number;
  /** Số mục còn in chữ gốc theo lượt gọi cuối. */
  remaining: number;
  creditsUsed: number;
}

interface TranslateDialogProps {
  projectId: string;
  open: boolean;
  onClose: () => void;
  /**
   * Vòng dịch kết thúc (xong, dừng, hết credit, lỗi giữa chừng) mà đã dịch được hoặc đã trừ credit. Bản dịch không làm đổi
   * `spine_version` nên không sự kiện nào khác báo — nơi gọi tải lại tài liệu và số dư credit ở đây. Vẫn gọi khi hộp đã
   * đóng giữa chừng (lượt đang chạy vẫn về).
   */
  onDone?: (result: TranslateResult) => void;
  /** Ước tính đã có sẵn (vừa đọc để quyết có mở hộp không) ⇒ lần mở đầu khỏi đọc lại. */
  initialStatus?: TranslationStatus;
}

type Outcome =
  | { reason: "done" | "stalled" | "stopped" | "insufficientCredit" | "runningElsewhere" | "unreadable" }
  | { reason: "failed"; error: unknown };

type Phase =
  | { kind: "loading" }
  | { kind: "statusError"; error: unknown }
  | { kind: "ready"; status: TranslationStatus }
  | { kind: "running"; translated: number; remaining: number; creditsUsed: number; stopping: boolean }
  | { kind: "finished"; outcome: Outcome; translated: number; remaining: number; creditsUsed: number };

/** Lỗi của một lượt `run` → cách báo. Mã nào cũng dừng vòng: gọi tiếp chỉ lặp lại đúng lỗi đó (và có thể trả credit). */
const outcomeOf = (err: unknown): Outcome => {
  if (err instanceof ApiClientError) {
    if (err.code === "INSUFFICIENT_CREDIT" || err.status === 402) return { reason: "insufficientCredit" };
    if (err.code === "TRANSLATION_RUNNING") return { reason: "runningElsewhere" };
    // PARSE_FAILED / SCHEMA_MISMATCH: mọi lô của lượt này AI trả sai định dạng — BE đã nhả credit của các lô đó
    if (err.status === 422) return { reason: "unreadable" };
  }
  return { reason: "failed", error: err };
};

const SPINNER = <span aria-hidden className="w-3.5 h-3.5 rounded-full border-2 border-current border-t-transparent ff-spinner shrink-0" />;

const NOTICE_TONE = {
  success: "bg-success-soft border-success-border text-success",
  neutral: "bg-surface-container-low border-outline-variant text-on-surface-medium",
  warning: "bg-accent-gold-soft border-accent-gold-border text-accent-gold-text",
  error: "bg-error-container border-error-border text-on-error-container",
} as const;

function Notice({ tone, children }: { tone: keyof typeof NOTICE_TONE; children: ReactNode }) {
  return (
    <div role={tone === "error" ? "alert" : "status"} className={`border rounded-control px-3 py-2 text-body flex flex-col gap-1 ${NOTICE_TONE[tone]}`}>
      {children}
    </div>
  );
}

/**
 * Hộp "Dịch tài liệu" (FLF-265, D9 + BR-01): chỉ dịch phần CÒN THIẾU của ngôn ngữ tài liệu — nội dung mới đã dịch ngay
 * trong lượt AI ghi (D16). Đọc ước tính (`status`, không gọi model) ⇒ user xác nhận ⇒ lặp `run` tới `remaining = 0`
 * HOẶC `translated = 0` (điều kiện dừng của hợp đồng #27). Dùng chung cho workspace (cảnh báo trên tài liệu, lệnh chat)
 * và dashboard (sau khi đổi ngôn ngữ dự án).
 */
export default function TranslateDialog({ open, ...props }: TranslateDialogProps) {
  // Mỗi lần mở là một lượt mới (đọc lại ước tính, không còn kết quả cũ); đóng ⇒ gỡ hẳn, vòng đang chạy tự dừng
  if (!open) return null;
  return <TranslateFlow {...props} />;
}

function TranslateFlow({ projectId, onClose, onDone, initialStatus }: Omit<TranslateDialogProps, "open">) {
  const t = useTranslations("app.translateDialog");
  const tc = useTranslations("app.common");
  // Ước tính truyền vào chỉ dùng cho lần đầu; "Thử lại" / "Dịch tiếp" luôn đọc lại từ BE
  const [seed] = useState(initialStatus);
  const [phase, setPhase] = useState<Phase>(() => (seed ? { kind: "ready", status: seed } : { kind: "loading" }));
  /** Tăng để đọc lại ước tính. */
  const [statusRequest, setStatusRequest] = useState(0);
  /** Vòng dịch dừng sau lượt đang chạy: bấm "Dừng", đóng hộp, hoặc hộp bị gỡ. */
  const stopRef = useRef(false);

  useEffect(() => {
    if (seed && statusRequest === 0) return;
    let cancelled = false;
    getTranslationStatus(projectId)
      .then((res) => {
        if (!cancelled) setPhase(res.data ? { kind: "ready", status: res.data } : { kind: "statusError", error: null });
      })
      .catch((err: unknown) => {
        if (!cancelled) setPhase({ kind: "statusError", error: err });
      });
    return () => {
      cancelled = true;
    };
  }, [projectId, seed, statusRequest]);

  // Hộp bị gỡ giữa vòng dịch (đóng, rời trang) ⇒ dừng sau lượt đang chạy; phần đã dịch vẫn giữ và báo qua `onDone`
  useEffect(() => {
    stopRef.current = false;
    return () => {
      stopRef.current = true;
    };
  }, []);

  const close = () => {
    stopRef.current = true;
    onClose();
  };

  const stop = () => {
    stopRef.current = true;
    setPhase((current) => (current.kind === "running" ? { ...current, stopping: true } : current));
  };

  const refetch = () => {
    setPhase({ kind: "loading" });
    setStatusRequest((n) => n + 1);
  };

  const start = async (status: TranslationStatus) => {
    stopRef.current = false;
    let translated = 0;
    let creditsUsed = 0;
    let remaining = status.missing;
    let outcome: Outcome | null = null;
    setPhase({ kind: "running", translated, remaining, creditsUsed, stopping: false });
    while (outcome === null) {
      let step: TranslationRunResult;
      try {
        step = (await runTranslation(projectId, BATCHES_PER_REQUEST)).data ?? { translated: 0, remaining, credits_used: 0 };
      } catch (err) {
        outcome = outcomeOf(err);
        break;
      }
      translated += step.translated;
      creditsUsed += step.credits_used;
      remaining = step.remaining;
      // Hợp đồng #27: hết phần thiếu, HOẶC lượt vừa rồi không dịch được mục nào — gọi tiếp chỉ trả credit lặp cho cùng lô hỏng
      if (remaining === 0) outcome = { reason: "done" };
      else if (step.translated === 0) outcome = { reason: "stalled" };
      else if (stopRef.current) outcome = { reason: "stopped" };
      else setPhase({ kind: "running", translated, remaining, creditsUsed, stopping: false });
    }
    setPhase({ kind: "finished", outcome, translated, remaining, creditsUsed });
    if (translated > 0 || creditsUsed > 0) onDone?.({ translated, remaining, creditsUsed });
  };

  let body: ReactNode;
  let actions: ReactNode;
  switch (phase.kind) {
    case "loading":
      body = (
        <p className="flex items-center gap-2 text-body text-on-surface-muted">
          {SPINNER}
          {t("checking")}
        </p>
      );
      actions = (
        <Button variant="secondary" onClick={close}>
          {tc("cancel")}
        </Button>
      );
      break;

    case "statusError":
      body = <Notice tone="error">{userErrorMessage(phase.error, t("statusFailed"))}</Notice>;
      actions = (
        <>
          <Button variant="secondary" onClick={close}>
            {tc("close")}
          </Button>
          <Button onClick={refetch}>{tc("retry")}</Button>
        </>
      );
      break;

    case "ready": {
      const { status } = phase;
      if (status.missing === 0) {
        // Ngôn ngữ tài liệu = ngôn ngữ gốc ⇒ BE đếm `total: 0`; còn lại là đã dịch đủ
        body = (
          <p className="text-body text-on-surface-variant">
            {status.total === 0 ? t("nothingToTranslate") : t("allTranslated", { language: t(`language.${status.locale}`) })}
          </p>
        );
        actions = <Button onClick={close}>{tc("close")}</Button>;
        break;
      }
      body = (
        <>
          <div className="flex items-start gap-3 bg-surface-container-low border border-outline-variant rounded-control px-4 py-3">
            <Icon name="translate" size={20} className="mt-0.5 text-primary" />
            <div className="flex flex-col gap-0.5">
              <span className="text-heading font-bold text-on-surface">
                {t("estimate", { count: status.missing, credits: status.estimated_credits })}
              </span>
              <span className="text-body text-on-surface-variant">
                {t("direction", { source: t(`language.${status.source_locale}`), target: t(`language.${status.locale}`) })}
              </span>
            </div>
          </div>
          <p className="text-body text-on-surface-variant">{t("detail")}</p>
        </>
      );
      actions = (
        <>
          <Button variant="secondary" onClick={close}>
            {tc("cancel")}
          </Button>
          <Button icon="translate" onClick={() => void start(status)}>
            {t("start")}
          </Button>
        </>
      );
      break;
    }

    case "running": {
      const total = phase.translated + phase.remaining;
      const percent = total > 0 ? Math.round((phase.translated / total) * 100) : 0;
      body = (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-3 text-body font-semibold text-on-surface-medium">
            <span className="flex items-center gap-2">
              {SPINNER}
              {phase.stopping ? t("stopping") : t("running")}
            </span>
            <span className="tabular-nums">{t("progress", { done: phase.translated, total })}</span>
          </div>
          <div
            role="progressbar"
            aria-label={t("progressLabel")}
            aria-valuemin={0}
            aria-valuemax={total}
            aria-valuenow={phase.translated}
            className="h-2 rounded-full bg-surface-container-high overflow-hidden"
          >
            <div className="h-full rounded-full bg-primary transition-[width] duration-300" style={{ width: `${percent}%` }} />
          </div>
          <p className="text-caption text-on-surface-muted">{t("closeHint")}</p>
        </div>
      );
      actions = (
        <Button variant="secondary" onClick={stop} disabled={phase.stopping}>
          {t("stop")}
        </Button>
      );
      break;
    }

    case "finished": {
      const { outcome, translated, remaining, creditsUsed } = phase;
      // Lượt dừng vì lỗi mà đã dịch được một phần: nói rõ phần đó không mất
      const kept = translated > 0 && outcome.reason !== "done" && outcome.reason !== "stopped" && <span>{t("kept", { count: translated })}</span>;
      const spent = creditsUsed > 0 && <span className="text-caption">{t("creditsUsed", { credits: creditsUsed })}</span>;
      const message =
        outcome.reason === "done" ? (
          <Notice tone="success">
            <span className="font-bold">{t("done", { count: translated })}</span>
            {spent}
          </Notice>
        ) : outcome.reason === "stopped" ? (
          <Notice tone="neutral">
            <span>{t("stopped", { count: translated, remaining })}</span>
            {spent}
          </Notice>
        ) : outcome.reason === "stalled" || outcome.reason === "runningElsewhere" ? (
          <Notice tone="warning">
            <span>{outcome.reason === "stalled" ? t("stalled", { remaining }) : t("runningElsewhere")}</span>
            {kept}
            {spent}
          </Notice>
        ) : (
          <Notice tone="error">
            <span>
              {outcome.reason === "insufficientCredit"
                ? t("insufficientCredit")
                : outcome.reason === "unreadable"
                  ? t("unreadable")
                  : userErrorMessage(outcome.reason === "failed" ? outcome.error : null, t("runFailed"))}
            </span>
            {kept}
            {spent}
          </Notice>
        );
      body = message;
      actions =
        outcome.reason === "done" || outcome.reason === "insufficientCredit" ? (
          <Button onClick={close}>{tc("close")}</Button>
        ) : (
          <>
            <Button variant="secondary" onClick={close}>
              {tc("close")}
            </Button>
            {/* Đọc lại ước tính rồi mới chạy tiếp: user xác nhận lại số credit (BR-01) */}
            <Button onClick={refetch}>{outcome.reason === "stopped" ? t("continue") : tc("retry")}</Button>
          </>
        );
      break;
    }
  }

  return (
    <Modal open onClose={close} title={t("title")}>
      <div className="flex flex-col gap-4">
        {body}
        <div className="flex justify-end gap-2">{actions}</div>
      </div>
    </Modal>
  );
}
