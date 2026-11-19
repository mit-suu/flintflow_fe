"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import Button from "@/components/ui/Button";
import Icon from "@/components/ui/Icon";
import { WAIVE_REASON_MIN_LENGTH, type ChoiceDef } from "./resolve-queue-actions";
import type { ResolveQueueController } from "./useResolveQueue";
import type { ResolveQueueT } from "./resolve-queue-view";
import { CR_MAX_FLAG_IDS } from "@/types/change-request";

interface ResolveQueueCardProps {
  controller: ResolveQueueController;
  onShowSection: (sectionId: string) => void;
}

const isTypingTarget = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
};

/**
 * Thẻ một việc mỗi lần ở vùng ô nhập. Bấm lựa chọn là áp dụng ngay (hoặc mở ô nhập / xác nhận cho lựa chọn cần thêm
 * thông tin); chỉ sang việc kế khi hook báo ghi thành công. Phím 1-n chọn theo số thứ tự.
 */
export default function ResolveQueueCard({ controller: c, onShowSection }: ResolveQueueCardProps) {
  // Key động theo loại việc / lựa chọn ⇒ translator lỏng (cùng cách `useResolveQueue`)
  const t = useTranslations("workspace.resolveQueue") as unknown as ResolveQueueT;
  const view = c.current;
  const [form, setForm] = useState<ChoiceDef | null>(null);
  const [value, setValue] = useState("");
  const [showGone, setShowGone] = useState(false);
  // Chế độ 1: cờ bỏ chọn (mặc định chọn hết) và người yêu cầu ghi trên CR
  const [unchecked, setUnchecked] = useState<ReadonlySet<string>>(new Set());
  const [requester, setRequester] = useState(c.requester);
  const [editingRequester, setEditingRequester] = useState(false);

  const choices = view?.choices ?? [];
  const disabled = c.locked || c.busy;
  const groupCard = (view?.flagList.length ?? 0) > 0;
  const selected = (view?.flagIds ?? []).filter((id) => !unchecked.has(id));
  const extra = groupCard ? { flagIds: selected, requester } : undefined;
  const crBlocked = c.crLockReason !== null || selected.length === 0 || selected.length > CR_MAX_FLAG_IDS || !requester.trim();
  const choiceDisabled = (def: ChoiceDef) => disabled || (groupCard && (selected.length === 0 || (def.createsCr === true && crBlocked)));

  const activate = (def: ChoiceDef) => {
    if (choiceDisabled(def)) return;
    if (def.confirm || def.input !== "none") {
      setForm(def);
      setValue("");
      return;
    }
    void c.choose(def.id, "", extra);
  };

  useEffect(() => {
    if (disabled || form !== null) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey || isTypingTarget(event.target)) return;
      const index = Number(event.key) - 1;
      if (!Number.isInteger(index) || index < 0 || index >= choices.length) return;
      event.preventDefault();
      activate(choices[index]);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // `activate` đọc `disabled`/`form` ở trên; dựng lại listener theo danh sách lựa chọn là đủ
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [disabled, form, choices, c.choose]);

  if (!view) return null;

  const left = c.phase === "single" ? c.total : c.activeCount;
  const progressTotal = c.resolved + c.activeCount;
  const reasonLength = value.trim().length;
  const formReady = form?.input === "reason" ? reasonLength >= WAIVE_REASON_MIN_LENGTH : form?.input === "text" ? reasonLength > 0 : true;
  const creditHint = (def: ChoiceDef) => {
    const credit = def.credit === "change_request" ? c.crCredit(selected) : c.credit;
    return def.credit && credit !== null ? t("card.credit", { count: credit }) : null;
  };
  const toggle = (id: string) =>
    setUnchecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const uncheckedIds = (view.flagIds ?? []).filter((id) => unchecked.has(id));

  return (
    <section aria-label={t("card.aria", { kind: view.kindLabel })} className="mx-3 mb-2 bg-surface-container-low rounded-card p-4 flex flex-col gap-3">
      <header className="flex items-center gap-2">
        <span className="text-caption font-bold uppercase tracking-wider text-primary-hover">{view.kindLabel}</span>
        <span className="text-caption text-on-surface-muted">{t(c.mode1 ? "mode1.left" : "card.left", { count: left })}</span>
        <span className="flex-1" />
        <button type="button" onClick={c.collapse} className="text-caption font-bold text-on-surface-variant hover:text-on-surface cursor-pointer">
          {t("card.collapse")}
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={c.later}
          className="text-caption font-bold text-on-surface-variant hover:text-on-surface disabled:opacity-50 cursor-pointer"
        >
          {t("card.later")}
        </button>
      </header>

      {c.phase === "queue" && progressTotal > 0 && (
        <div
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={progressTotal}
          aria-valuenow={c.resolved}
          aria-label={t("card.progress", { done: c.resolved, total: progressTotal })}
          className="h-1 rounded-full bg-surface-container-high overflow-hidden">
          <div className="h-full bg-primary transition-[width]" style={{ width: `${(c.resolved / progressTotal) * 100}%` }} />
        </div>
      )}

      <p className="text-body font-bold text-on-surface leading-relaxed">{view.question}</p>
      {groupCard && <p className="text-body text-on-surface">{view.subject}</p>}

      {groupCard && (
        <ul aria-label={t("mode1.listAria")} className="bg-surface-container-lowest rounded-control px-3 py-2 flex flex-col gap-1.5 max-h-48 overflow-y-auto">
          {view.flagList.map((f) => (
            <li key={f.id}>
              <label className="flex items-start gap-2 text-body text-on-surface-variant cursor-pointer">
                {view.flagList.length > 1 && (
                  <input
                    type="checkbox"
                    className="mt-1 accent-primary"
                    checked={!unchecked.has(f.id)}
                    disabled={disabled}
                    onChange={() => toggle(f.id)}
                  />
                )}
                <span className="leading-relaxed">{f.message}</span>
              </label>
            </li>
          ))}
        </ul>
      )}

      {view.quoteLines.length > 0 && (
        <div className="bg-surface-container-lowest rounded-control px-3 py-2 flex flex-col gap-1 text-body text-on-surface-variant">
          {view.quoteLines.map((line, index) => (
            <p key={index} className="leading-relaxed">
              {line}
            </p>
          ))}
        </div>
      )}
      {view.detail && <p className="text-caption text-on-surface-variant italic">{t("card.why", { text: view.detail })}</p>}

      {view.sectionId && view.sectionName && (
        <button
          type="button"
          onClick={() => onShowSection(view.sectionId as string)}
          className="self-start text-caption font-bold text-primary hover:text-primary-hover cursor-pointer">
          {t("card.section", { name: view.sectionName })}
        </button>
      )}
      {view.item.dependents > 0 && <p className="text-caption text-on-surface-variant">{t("card.dependents", { count: view.item.dependents })}</p>}

      {c.alsoDone && (
        <div className="text-caption text-on-surface-variant">
          <span>{t("card.alsoDone", { count: c.alsoDone.count })}</span>{" "}
          <button type="button" onClick={() => setShowGone((v) => !v)} className="font-bold text-primary hover:text-primary-hover cursor-pointer">
            {showGone ? t("card.alsoDoneHide") : t("card.alsoDoneShow")}
          </button>
          {showGone && (
            <ul className="mt-1 list-disc pl-4">
              {c.alsoDone.labels.map((label, index) => (
                <li key={index}>{label}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {form === null ? (
        <ol className="flex flex-col gap-1.5">
          {choices.map((def, index) => {
            const credit = creditHint(def);
            return (
              <li key={def.id}>
                <button
                  type="button"
                  disabled={choiceDisabled(def)}
                  onClick={() => activate(def)}
                  className="w-full flex items-center gap-3 text-left rounded-control px-3 py-2 bg-surface-container-lowest hover:bg-surface-container-high transition-colors disabled:opacity-50 cursor-pointer">
                  <span aria-hidden className="w-5 h-5 shrink-0 rounded-full bg-primary-soft text-primary-hover text-caption font-bold flex items-center justify-center">
                    {index + 1}
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-body font-bold text-on-surface">{t(groupCard ? `mode1.choice.${def.id}` : `choice.${view.kind}.${def.id}`)}</span>
                    <span className="block text-caption text-on-surface-variant">
                      {t(groupCard ? `mode1.choiceHint.${def.id}` : `choiceHint.${view.kind}.${def.id}`)}
                      {credit && ` (${credit})`}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      ) : (
        <form
          className="flex flex-col gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (formReady && !choiceDisabled(form)) void c.choose(form.id, value, extra);
          }}>
          <p className="text-body font-bold text-on-surface">{t(groupCard ? `mode1.choice.${form.id}` : `choice.${view.kind}.${form.id}`)}</p>
          {form.confirm ? (
            <p className="text-body text-on-surface-variant">{t("card.confirmDrop")}</p>
          ) : (
            <>
              <textarea
                autoFocus
                rows={3}
                value={value}
                disabled={disabled}
                onChange={(event) => setValue(event.target.value)}
                placeholder={t(
                  form.input === "reason" ? "card.reasonPlaceholder" : groupCard ? "mode1.textPlaceholder" : `card.textPlaceholder.${view.kind}`,
                  { min: WAIVE_REASON_MIN_LENGTH }
                )}
                className="w-full resize-none rounded-control bg-surface-container-lowest px-3 py-2 text-body text-on-surface focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
              />
              {form.input === "reason" && (
                <p className="text-caption text-on-surface-muted">{t("card.reasonCount", { count: reasonLength, min: WAIVE_REASON_MIN_LENGTH })}</p>
              )}
            </>
          )}
          {creditHint(form) && <p className="text-caption text-on-surface-variant">{creditHint(form)}</p>}
          <div className="flex items-center gap-2">
            <Button type="submit" size="sm" loading={c.busy} disabled={!formReady || c.locked || choiceDisabled(form)}>
              {form.confirm ? t("card.confirmDropYes") : t("card.apply")}
            </Button>
            <Button type="button" size="sm" variant="ghost" disabled={disabled} onClick={() => setForm(null)}>
              {t("card.back")}
            </Button>
          </div>
        </form>
      )}

      {groupCard && (
        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-caption text-on-surface-variant">
          <span>{t("mode1.footer", { count: selected.length })}</span>
          <span aria-hidden>·</span>
          {editingRequester ? (
            <label className="flex items-center gap-1.5">
              <span>{t("mode1.requesterLabel")}</span>
              <input
                autoFocus
                value={requester}
                maxLength={200}
                onChange={(event) => setRequester(event.target.value)}
                onBlur={() => setEditingRequester(false)}
                className="rounded-control bg-surface-container-lowest px-2 py-0.5 text-caption text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </label>
          ) : (
            <>
              <span>{t("mode1.requester", { name: requester.trim() || t("mode1.requesterEmpty") })}</span>
              <button type="button" disabled={disabled} onClick={() => setEditingRequester(true)} className="font-bold text-primary hover:text-primary-hover disabled:opacity-50 cursor-pointer">
                {t("mode1.requesterEdit")}
              </button>
            </>
          )}
          {view.flagList.length > 1 && (
            <>
              <span aria-hidden>·</span>
              {uncheckedIds.length > 0 && selected.length > 0 ? (
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => {
                    c.split(uncheckedIds);
                    setUnchecked(new Set());
                  }}
                  className="font-bold text-primary hover:text-primary-hover disabled:opacity-50 cursor-pointer">
                  {t("mode1.split", { count: uncheckedIds.length })}
                </button>
              ) : (
                <span>{t("mode1.splitHint")}</span>
              )}
            </>
          )}
        </div>
      )}
      {groupCard && c.crLockReason && <p className="text-caption text-on-surface-variant">{c.crLockReason}</p>}
      {groupCard && !c.crLockReason && selected.length > CR_MAX_FLAG_IDS && (
        <p className="text-caption text-on-surface-variant">{t("mode1.tooMany", { max: CR_MAX_FLAG_IDS })}</p>
      )}

      {c.error && (
        <p role="alert" className="flex items-start gap-1.5 text-body text-error">
          <Icon name="error-circle" size={14} className="mt-0.5 shrink-0" />
          <span>{c.error}</span>
        </p>
      )}
      {view.leftAfterChat && <p className="text-caption text-on-surface-variant">{t("card.leftAfterChat")}</p>}
    </section>
  );
}
