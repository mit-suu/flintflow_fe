"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import { decideSkeletonPending, getSkeletonPending, suggestSkeletonNames } from "@/lib/api/org-library";
import { userErrorMessage } from "@/lib/api/error-messages";
import type { PendingHeading, SkeletonDecision, SkeletonPending } from "@/types/org-library";

type Choice = "keep" | "generic" | "drop";
/** Lựa chọn đang soạn của một dòng; chưa đụng tới ⇒ không có mục trong bản đồ. */
interface Draft {
  choice: Choice;
  text?: string;
}

interface PendingHeadingsReviewProps {
  projectId: string;
  /** Lead / Analyst của dự án mới duyệt được; người khác chỉ xem. */
  canReview: boolean;
  /** Danh sách chờ đổi sau khi lưu / gợi ý (để thẻ cha cập nhật số đếm). */
  onChange?: (pending: SkeletonPending) => void;
}

/** Chữ dạng chung đang hiển thị cho một dòng: chữ đang soạn, chữ đã lưu, rồi gợi ý. */
const genericTextOf = (h: PendingHeading, draft: Draft | undefined): string => draft?.text ?? h.generic_text ?? h.suggestion ?? "";

/**
 * Duyệt mục BA tự đặt của mẫu khung tự lưu (chỉ vào mẫu của tổ chức sau khi duyệt): mỗi dòng giữ nguyên / giữ dạng chung (sửa được chữ
 * gợi ý) / bỏ. Nút "Gợi ý tên chung" báo credit trước và chỉ chạy khi bấm. Dự án không có khung riêng ⇒ không hiện gì.
 */
export default function PendingHeadingsReview({ projectId, canReview, onChange }: PendingHeadingsReviewProps) {
  const t = useTranslations("app.org.pendingHeadings");
  const [data, setData] = useState<SkeletonPending | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [busy, setBusy] = useState<"save" | "suggest" | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getSkeletonPending(projectId)
      .then((res) => !cancelled && setData(res))
      .catch((err: unknown) => !cancelled && setError(userErrorMessage(err)))
      .finally(() => !cancelled && setLoaded(true));
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const apply = useCallback(
    (next: SkeletonPending) => {
      setData(next);
      onChange?.(next);
    },
    [onChange]
  );

  const setChoice = (key: string, choice: Choice) => setDrafts((prev) => ({ ...prev, [key]: { ...prev[key], choice } }));
  const setText = (key: string, text: string) => setDrafts((prev) => ({ ...prev, [key]: { choice: "generic", text } }));

  const decisions: SkeletonDecision[] = Object.entries(drafts).map(([key, d]) => {
    const heading = data?.headings.find((h) => h.key === key);
    const text = heading ? genericTextOf(heading, d).trim() : "";
    return d.choice === "generic" ? { key, decision: "generic", generic_text: text } : { key, decision: d.choice };
  });
  const invalid = decisions.some((d) => d.decision === "generic" && !d.generic_text);

  const save = async () => {
    setBusy("save");
    setError(null);
    try {
      apply(await decideSkeletonPending(projectId, decisions));
      setDrafts({});
    } catch (err) {
      setError(userErrorMessage(err));
      // Hai người duyệt cùng lúc ⇒ tải lại danh sách mới nhất
      getSkeletonPending(projectId).then((res) => res && setData(res)).catch(() => undefined);
    } finally {
      setBusy(null);
    }
  };

  const suggest = async () => {
    setBusy("suggest");
    setError(null);
    try {
      apply(await suggestSkeletonNames(projectId));
    } catch (err) {
      setError(userErrorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  if (!loaded) {
    return (
      <p role="status" className="text-body text-on-surface-muted">
        {t("loading")}
      </p>
    );
  }
  if (!data) return error ? <p role="alert" className="text-body text-error">{error}</p> : null;

  const pendingRows = data.headings.filter((h) => h.decision === "pending");
  const stillPending = pendingRows.length;

  return (
    <div className="flex flex-col gap-3">
      <p className="text-body text-on-surface-variant">{t("help", { name: data.name })}</p>
      {data.headings.length === 0 ? (
        <p className="text-body text-on-surface-muted">{t("empty")}</p>
      ) : (
        <ul aria-label={t("listLabel")} className="flex flex-col gap-1.5">
          {data.headings.map((h) => {
            const draft = drafts[h.key];
            const choice: Choice | null = draft?.choice ?? (h.decision === "pending" ? null : h.decision);
            return (
              <li key={h.key} className="flex flex-col gap-2 rounded-control bg-surface-container-low px-3 py-2.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-body font-semibold text-on-surface break-words">{h.heading_text}</span>
                  <Badge tone={h.kind === "custom" ? "info" : "neutral"}>{t(h.kind === "custom" ? "kindCustom" : "kindWording")}</Badge>
                  {h.decision === "pending" ? <Badge tone="warning">{t("pending")}</Badge> : <Badge tone="success">{t(`decided.${h.decision}`)}</Badge>}
                </div>
                {h.kind === "wording" && h.standard_title && <p className="text-caption text-on-surface-muted">{t("standardTitle", { title: h.standard_title })}</p>}
                <fieldset disabled={!canReview || busy !== null} className="flex flex-wrap gap-x-4 gap-y-1">
                  <legend className="sr-only">{t("choiceLabel", { heading: h.heading_text })}</legend>
                  {(["keep", "generic", "drop"] as const).map((c) => (
                    <label key={c} className="inline-flex items-center gap-1.5 text-body text-on-surface cursor-pointer">
                      <input type="radio" name={`choice-${h.key}`} checked={choice === c} onChange={() => setChoice(h.key, c)} />
                      {t(`choice.${c}`)}
                    </label>
                  ))}
                </fieldset>
                {choice === "generic" && (
                  <label className="flex flex-col gap-1 text-caption font-bold text-on-surface-variant">
                    {t("genericLabel")}
                    <input
                      value={genericTextOf(h, draft)}
                      maxLength={300}
                      disabled={!canReview || busy !== null}
                      onChange={(e) => setText(h.key, e.target.value)}
                      className="h-9 rounded-control bg-surface-container-lowest px-3 text-body font-normal text-on-surface outline-none focus:ring-2 focus:ring-primary/30"
                    />
                    {h.suggestion && h.suggestion_reason && <span className="font-normal text-on-surface-muted">{h.suggestion_reason}</span>}
                  </label>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {error && (
        <p role="alert" className="text-body text-error">
          {error}
        </p>
      )}
      {canReview && data.headings.length > 0 && (
        <div className="flex flex-wrap items-center gap-3">
          <Button size="sm" disabled={decisions.length === 0 || invalid || busy === "suggest"} loading={busy === "save"} onClick={() => void save()}>
            {t("save")}
          </Button>
          {stillPending > 0 && (
            <Button size="sm" variant="secondary" disabled={busy === "save"} loading={busy === "suggest"} onClick={() => void suggest()}>
              {t("suggest", { credits: data.suggest_credit_cost })}
            </Button>
          )}
          {invalid && <span className="text-caption text-on-surface-muted">{t("genericRequired")}</span>}
        </div>
      )}
    </div>
  );
}
