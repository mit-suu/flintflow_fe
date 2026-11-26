"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import type { Flag } from "@/types/spine";
import { userErrorMessage } from "@/lib/api/error-messages";
import { isRedrawable, type RedrawReport } from "../flag-rules";
import { useMode1Labels } from "./i18n";
import { crPrefillHref } from "./prefill";

interface Mode1FlagsPanelProps {
  projectId: string;
  /** Cờ đang mở (BE tính). */
  flags: Flag[];
  /** Viewer: ẩn nút "Tạo CR" và "Vẽ lại". */
  readOnly?: boolean;
  /**
   * FLF-493: vẽ lại sơ đồ của cờ `diagram_stale` / `render_error` (MỘT lời gọi cho cả lô). Vẽ lại không đổi nội dung, chỉ
   * dựng hình theo dữ liệu đã duyệt ⇒ không cần CR. Không truyền ⇒ cờ sơ đồ chỉ có "Tạo CR".
   */
  onRedraw?: (flags: Flag[]) => Promise<RedrawReport | void>;
}

const shortText = (s: string, max = 70) => (s.length > max ? `${s.slice(0, max - 1)}…` : s);

/**
 * Cờ của project mode 1 v3 (bám BPMN — Flow 1 ⇒ 3.1, Flow 6): import xong không chạy step, không ký baseline v1, không
 * waive — cờ đỏ chỉ đóng bằng change request, và chặn release (6.1). Mỗi cờ đỏ có nút mở **form 3.1** điền sẵn nguồn
 * gap report; CR đi đủ 3.2 → 3.14 (mục trống ⇒ C-3 dựng vị trí thêm mới).
 */
export default function Mode1FlagsPanel({ projectId, flags, readOnly = false, onRedraw }: Mode1FlagsPanelProps) {
  const t = useTranslations("mode1.flagsPanel");
  const tf = useTranslations("workspace.flags");
  const L = useMode1Labels();
  const [redrawing, setRedrawing] = useState<ReadonlySet<string>>(new Set());
  const [redrawReport, setRedrawReport] = useState<RedrawReport | null>(null);
  const open = flags.filter((f) => !f.resolved_at && !f.waived_by_user);
  const red = open.filter((f) => f.level === "red");
  // Mẫu cố định: mục của mẫu còn trống là việc chính của dự án có sẵn ⇒ liệt kê kèm nút tạo CR như cờ đỏ (cờ vàng, không chặn)
  const emptyTemplate = open.filter((f) => f.level === "yellow" && f.rule_id === "template_section_empty");
  const yellow = open.filter((f) => f.level === "yellow" && f.rule_id !== "template_section_empty");
  const canRedraw = !!onRedraw && !readOnly;
  const redrawable = red.filter(isRedrawable);
  const redraw = async (targets: Flag[]) => {
    if (!onRedraw || redrawing.size > 0 || targets.length === 0) return;
    setRedrawReport(null);
    setRedrawing(new Set(targets.map((f) => f.id)));
    try {
      setRedrawReport((await onRedraw(targets)) ?? null);
    } catch (err) {
      setRedrawReport({ failed: targets, stillBroken: [], flagsCheckFailed: false, error: userErrorMessage(err, tf("redrawFailed")) });
    } finally {
      setRedrawing(new Set());
    }
  };
  const sectionNames = (list: readonly Flag[]) => [...new Set(list.map((f) => L.sectionName(f.section_id ?? "")))].join(", ");
  const redrawLines = (): string[] => {
    if (!redrawReport || redrawable.length === 0) return [];
    const lines: string[] = [];
    if (redrawReport.failed.length > 0) lines.push(tf("redrawFailedFor", { sections: sectionNames(redrawReport.failed) }) + (redrawReport.error ? ` ${redrawReport.error}` : ""));
    if (redrawReport.stillBroken.length > 0) lines.push(tf("redrawStillBroken", { sections: sectionNames(redrawReport.stillBroken) }));
    if (redrawReport.flagsCheckFailed) lines.push(tf("redrawCheckFailed"));
    return lines;
  };
  const redrawButton = (f: Flag) =>
    canRedraw && isRedrawable(f) ? (
      <button
        type="button"
        disabled={redrawing.size > 0}
        onClick={() => void redraw([f])}
        className="ml-auto text-caption font-bold text-[#6A62C4] hover:underline shrink-0 cursor-pointer disabled:opacity-50"
      >
        {redrawing.has(f.id) ? tf("redrawing") : tf("redraw")}
      </button>
    ) : null;
  const crLink = (f: Flag) =>
    readOnly ? null : (
      <Link
        href={crPrefillHref(projectId, {
          title: t("prefillTitle", { message: shortText(L.humanizeText(f.message)) }),
          description: [
            L.humanizeText(f.message),
            [L.ruleLabel(f.rule_id), f.section_id && t("prefillSection", { section: L.sectionName(f.section_id) })].filter(Boolean).join(", "),
          ]
            .filter(Boolean)
            .join("\n"),
          source: "gap_report",
          ref: f.section_id ? L.sectionName(f.section_id) : undefined,
        })}
        className={`${canRedraw && isRedrawable(f) ? "" : "ml-auto "}text-caption font-bold text-[#6A62C4] hover:underline shrink-0`}
      >
        {t("createCr")}
      </Link>
    );

  return (
    <div className="flex flex-col gap-3">
      <p className="text-caption text-[#8A867E] leading-relaxed">{t("intro")}</p>

      <section className="flex flex-col gap-2" aria-label={t("redAria")}>
        <div className="flex items-center justify-between gap-2">
          <h4 className="text-body font-extrabold text-[#191817]">{t("redTitle", { count: red.length })}</h4>
          {canRedraw && redrawable.length > 1 && (
            <button
              type="button"
              disabled={redrawing.size > 0}
              onClick={() => void redraw(redrawable)}
              className="text-caption font-bold text-[#6A62C4] hover:underline cursor-pointer disabled:opacity-50"
            >
              {redrawing.size > 0 ? tf("redrawing") : tf("redrawAll")}
            </button>
          )}
        </div>
        {red.length === 0 ? (
          <p className="text-body text-[#1F7A45]">{t("noRed")}</p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {red.map((f) => (
              <li key={f.id} className="flex flex-col gap-1 bg-[#FDEDED] border border-[#F2CACA] rounded-[10px] px-2.5 py-1.5">
                <span className="text-body text-[#33312D]">{L.humanizeText(f.message)}</span>
                <span className="flex items-center gap-2">
                  <span className="text-caption text-[#8A4141]" title={f.rule_id}>
                    {L.ruleLabel(f.rule_id)}
                  </span>
                  {redrawButton(f)}
                  {crLink(f)}
                </span>
              </li>
            ))}
          </ul>
        )}
        {redrawLines().length > 0 && (
          <div role="status" className="rounded-[10px] bg-[#FDEDED] px-2.5 py-1.5 text-caption text-[#8A4141] flex flex-col gap-0.5">
            {redrawLines().map((line) => (
              <p key={line}>{line}</p>
            ))}
          </div>
        )}
      </section>

      {emptyTemplate.length > 0 && (
        <section className="flex flex-col gap-2" aria-label={t("emptyTemplateAria")}>
          <h4 className="text-body font-extrabold text-[#191817]">{t("emptyTemplateTitle", { count: emptyTemplate.length })}</h4>
          <ul className="flex flex-col gap-1.5">
            {emptyTemplate.map((f) => (
              <li key={f.id} className="flex flex-col gap-1 bg-accent-gold-soft border border-accent-gold-border rounded-[10px] px-2.5 py-1.5">
                <span className="text-body text-[#33312D]">{L.humanizeText(f.message)}</span>
                <span className="flex items-center gap-2">
                  <span className="text-caption text-accent-gold-text" title={f.rule_id}>
                    {L.ruleLabel(f.rule_id)}
                  </span>
                  {crLink(f)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {yellow.length > 0 && <p className="text-caption text-[#8A6D1F]">{t("yellowNote", { count: yellow.length })}</p>}
    </div>
  );
}
