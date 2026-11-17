"use client";

import type { ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import { diffTokens } from "@/lib/word-diff";
import type { ChangeConflict } from "../hooks/useChanges";

interface ChangeConflictCardProps {
  conflict: ChangeConflict;
  /** Tên mục hiển thị (không mã nội bộ). */
  sectionName: (sectionId: string) => string;
  busy?: boolean;
  onRedraft: () => void;
  onDrop: () => void;
}

/**
 * P12 — BF §3.2 "Hai người sửa cùng lúc" cho sửa qua chat trước baseline (chốt câu 8): lúc bấm Áp dụng, người khác đã sửa
 * đúng chữ mà bản xem trước định đổi ⇒ không ghi; so sánh 3 cột (① lúc AI soạn · ② hiện tại (ai, lúc nào) · ③ đề xuất của
 * bạn) + **AI soạn lại trên nội dung hiện tại** / **Bỏ yêu cầu**. Cùng khung `ConflictCard` của CR; không có nút ghi đè.
 */
export default function ChangeConflictCard({ conflict, sectionName, busy = false, onRedraft, onDrop }: ChangeConflictCardProps) {
  const t = useTranslations("mode1.crThread.conflict");
  const locale = useLocale();
  const clock = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" }) : null);

  return (
    <div className="flex flex-col gap-2" role="group" aria-label={t("aria", { title: conflict.items.map((c) => sectionName(c.section_id ?? "")).join(", ") })}>
      {conflict.items.map((c) => {
        const where = [c.section_id ? sectionName(c.section_id) : null, c.label || null].filter(Boolean).join(" - ");
        const when = clock(c.changed_at);
        const since = clock(c.proposed_at);
        // ① so với ② = người khác đã đổi gì; ① so với ③ = mình định đổi gì — tô màu như Track Changes
        const marked = (body: string, ins: string): ReactNode =>
          !body
            ? "-"
            : diffTokens(c.at_proposal, body).map((tk, i) => (
                <span key={i}>
                  {tk.kind === "same" ? (
                    tk.text
                  ) : tk.kind === "del" ? (
                    <del className="text-[#B03030]">{tk.text}</del>
                  ) : (
                    <ins className={`no-underline rounded px-0.5 ${ins}`}>{tk.text}</ins>
                  )}{" "}
                </span>
              ));
        const col = (head: string, body: ReactNode, tone: string) => (
          <div className={`rounded-[8px] border px-2 py-1.5 ${tone}`}>
            <p className="text-caption font-bold mb-0.5">{head}</p>
            <p className="whitespace-pre-wrap break-words">{body}</p>
          </div>
        );
        return (
          <article key={c.path} className="rounded-[12px] border border-[#EFD9A6] bg-[#FBF4E4] p-2.5 flex flex-col gap-2 text-body">
            <p className="font-bold text-[#8A6D1F]">
              ⚠ {when && since ? t("titleTimed", { title: where, who: c.changed_by, when, since }) : t("title", { title: where, who: c.changed_by })}
            </p>
            <div className="grid grid-cols-1 gap-1.5">
              {col(since ? `${t("atProposal")} (${since})` : t("atProposal"), c.at_proposal || "-", "border-outline-variant bg-white")}
              {col(t("current", { who: when ? `${c.changed_by}, ${when}` : c.changed_by }), marked(c.current, "bg-[#D6E4FA]"), "border-[#BFD3F2] bg-[#F2F6FD]")}
              {col(t("yours"), marked(c.proposal, "bg-[#CDEBD8]"), "border-[#BFE6CE] bg-[#F3FAF6]")}
            </div>
          </article>
        );
      })}
      <p className="text-caption text-on-surface-muted">{t("legend")}</p>
      {conflict.instruction && <p className="text-caption text-on-surface-muted">{t("request", { request: conflict.instruction })}</p>}
      <div className="flex flex-wrap gap-1.5 justify-end">
        <button
          type="button"
          disabled={busy}
          onClick={onDrop}
          className="h-8 px-3 rounded-control text-body font-bold bg-surface-container text-on-surface hover:bg-surface-container-high disabled:opacity-60 cursor-pointer transition-colors"
        >
          {t("drop")}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={onRedraft}
          className="h-8 px-3 rounded-control text-body font-bold bg-primary text-on-primary hover:bg-primary-hover disabled:opacity-60 cursor-pointer transition-colors"
        >
          {t("redraft")}
        </button>
      </div>
    </div>
  );
}
