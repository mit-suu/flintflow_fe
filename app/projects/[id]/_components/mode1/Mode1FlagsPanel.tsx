"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import type { Flag } from "@/types/spine";
import { useMode1Labels } from "./i18n";
import { crPrefillHref } from "./prefill";

interface Mode1FlagsPanelProps {
  projectId: string;
  /** Cờ đang mở (BE tính). */
  flags: Flag[];
  /** Viewer: ẩn nút "Tạo CR". */
  readOnly?: boolean;
}

const shortText = (s: string, max = 70) => (s.length > max ? `${s.slice(0, max - 1)}…` : s);

/**
 * Cờ của project mode 1 v3 (bám BPMN — Flow 1 ⇒ 3.1, Flow 6): import xong không chạy step, không ký baseline v1, không
 * waive — cờ đỏ chỉ đóng bằng change request, và chặn release (6.1). Mỗi cờ đỏ có nút mở **form 3.1** điền sẵn nguồn
 * gap report; CR đi đủ 3.2 → 3.14 (mục trống ⇒ C-3 dựng vị trí thêm mới).
 */
export default function Mode1FlagsPanel({ projectId, flags, readOnly = false }: Mode1FlagsPanelProps) {
  const t = useTranslations("mode1.flagsPanel");
  const L = useMode1Labels();
  const open = flags.filter((f) => !f.resolved_at && !f.waived_by_user);
  const red = open.filter((f) => f.level === "red");
  const yellow = open.filter((f) => f.level === "yellow");

  return (
    <div className="flex flex-col gap-3">
      <p className="text-caption text-[#8A867E] leading-relaxed">{t("intro")}</p>

      <section className="flex flex-col gap-2" aria-label={t("redAria")}>
        <h4 className="text-body font-extrabold text-[#191817]">{t("redTitle", { count: red.length })}</h4>
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
                  {!readOnly && (
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
                    className="ml-auto text-caption font-bold text-[#6A62C4] hover:underline shrink-0"
                  >
                    {t("createCr")}
                  </Link>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {yellow.length > 0 && <p className="text-caption text-[#8A6D1F]">{t("yellowNote", { count: yellow.length })}</p>}
    </div>
  );
}
