"use client";

import { useTranslations } from "next-intl";
import type { CreditEstimate, ExtractionSection, HeadingMapEntry, ImportedDocument } from "@/types/import";
import CreditEstimateNote from "./CreditEstimateNote";
import PausedBanner from "./PausedBanner";
import { useMode1Labels } from "./i18n";
import Icon, { type IconName } from "@/components/ui/Icon";

interface ExtractProgressProps {
  doc: ImportedDocument;
  sections: ExtractionSection[];
  /** Job nền đang chạy (FE đang poll). */
  running: boolean;
  credits: number | null;
  /** Ước tính lượt AI / credit còn phải chạy (BE chỉ trả khi job chưa chạy / đang dừng). */
  estimate?: CreditEstimate | null;
  onStart: () => void;
  onResume: () => void;
  busy?: boolean;
  /** Heading của profile — ghi rõ tính năng / chức năng mới (section tạm) theo tiêu đề trong file. */
  headingMap?: HeadingMapEntry[];
}

const STATUS_ICON: Record<ExtractionSection["status"], { icon: IconName; color: string }> = {
  pending: { icon: "clock", color: "#A8A49C" },
  done: { icon: "check-circle", color: "#1F7A45" },
  failed: { icon: "warning", color: "#B03030" },
};

/**
 * 1.8 Trích field (I-4) theo section — chạy nền, FE poll `GET /import`. Hiện tiến độ, credit còn lại và banner
 * paused (UC-61, UC-75). Số liệu do BE trả; FE chỉ đếm section theo trạng thái để vẽ thanh tiến độ.
 */
export default function ExtractProgress({ doc, sections, running, credits, estimate = null, onStart, onResume, busy = false, headingMap }: ExtractProgressProps) {
  const t = useTranslations("mode1.extractProgress");
  const L = useMode1Labels();
  const done = sections.filter((s) => s.status === "done").length;
  const total = sections.length;
  const notStarted = !running && !doc.paused && doc.extract_cursor === null && done === 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-extrabold text-[#191817] text-heading">{t("title")}</h3>
          <p className="text-body text-[#8A867E]">{t("hint")}</p>
        </div>
        <div className="px-3 py-1 rounded-full bg-[#F0EEEA] text-body font-semibold text-[#191817]">
          {t("credits", { credits: credits ?? "…" })}
        </div>
      </div>

      {doc.paused && <PausedBanner paused={doc.paused} onResume={onResume} busy={busy} what={t("pausedWhat")} />}

      {estimate && !running && (notStarted || doc.paused) && <CreditEstimateNote estimate={estimate} fallbackBalance={credits} remaining={!notStarted} />}

      {notStarted ? (
        <div className="bg-white border border-[#ECEAE5] rounded-[14px] p-5 flex flex-wrap items-center justify-between gap-3">
          <p className="text-body text-[#4B4842]">
            {t("ready", { total })}
          </p>
          <button
            type="button"
            onClick={onStart}
            disabled={busy}
            className="px-5 py-2.5 rounded-[10px] btn-gradient-primary text-white text-body font-bold disabled:opacity-50 cursor-pointer"
          >
            {busy ? t("starting") : t("start")}
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-body font-semibold text-[#4B4842]">
            <span>
              {running && <span className="inline-block w-3 h-3 mr-1.5 align-middle rounded-full border-2 border-[#E4E1DC] border-t-[#6A62C4] ff-spinner" />}
              {running ? (doc.extract_cursor ? t("runningSection", { section: L.sectionLabelIn(doc.extract_cursor, headingMap) }) : t("running")) : t("stopped")}
            </span>
            <span>
              {t("progress", { done, total })}
            </span>
          </div>
          <div className="h-2 rounded-full bg-[#ECEAE5] overflow-hidden" role="progressbar" aria-valuenow={done} aria-valuemin={0} aria-valuemax={total}>
            <div className="h-full bg-[#6A62C4] transition-all" style={{ width: total ? `${(done / total) * 100}%` : "0%" }} />
          </div>
        </div>
      )}

      {total > 0 && (
        <ul className="bg-white border border-[#ECEAE5] rounded-[14px] divide-y divide-[#F0EEEA]">
          {sections.map((s) => {
            const st = STATUS_ICON[s.status];
            const current = running && s.section_id === doc.extract_cursor;
            return (
              <li key={s.section_id} className={`px-3 py-2 flex items-center gap-3 text-body ${current ? "bg-[#F2F1FB]" : ""}`}>
                <Icon name={st.icon} size={18} style={{ color: st.color }} label={t(`status.${s.status}`)} />
                <span className="flex-1 font-semibold text-[#191817]">{L.sectionLabelIn(s.section_id, headingMap)}</span>
                {s.status === "done" && (
                  <span className="text-body text-[#8A867E]">
                    {t("fields", { count: s.fields_total })}
                    {s.fields_needing_review > 0 && <strong className="text-[#8A6D1F]"> · {t("needsReview", { count: s.fields_needing_review })}</strong>}
                  </span>
                )}
                {s.error && <span className="text-body text-[#B03030]">{L.humanizeText(s.error)}</span>}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
