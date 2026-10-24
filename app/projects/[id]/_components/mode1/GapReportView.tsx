"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { downloadGapReport, getGapReport } from "@/lib/api/import";
import { saveBlob } from "@/lib/api/files";
import type { Flag } from "@/types/spine";
import type { GapReport } from "@/types/import";
import PageSkeleton from "@/components/ui/PageSkeleton";
import { useErrorText, useMode1Labels, type Mode1Labels } from "./i18n";
import { formatPercent } from "./labels";
import { crPrefillHref } from "./prefill";

interface GapReportViewProps {
  projectId: string;
  projectName?: string;
  /** Tải báo cáo lần đầu ⇒ BE chuyển import sang `delivered` — báo header đọc lại. */
  onChanged?: () => void;
  /** Viewer: chỉ xem / tải báo cáo, không có lối tạo change request. */
  readOnly?: boolean;
}

const Tile = ({ label, value, tone }: { label: string; value: number; tone: "red" | "yellow" | "neutral" }) => (
  <div
    className={`rounded-[14px] border px-4 py-3 flex flex-col gap-0.5 ${
      tone === "red" && value > 0
        ? "bg-[#FDEDED] border-[#F2CACA] text-[#B03030]"
        : tone === "yellow" && value > 0
          ? "bg-[#FBF4E4] border-[#EFD9A6] text-[#8A6D1F]"
          : "bg-white border-[#ECEAE5] text-[#4B4842]"
    }`}
  >
    <span className="text-title font-extrabold leading-none">{value}</span>
    <span className="text-body font-semibold">{label}</span>
  </div>
);

function FlagRow({ flag }: { flag: Flag }) {
  const t = useTranslations("mode1.gapReport");
  const L = useMode1Labels();
  return (
    <li className="flex items-start gap-2 text-body">
      <span
        className={`mt-1 w-2 h-2 rounded-full shrink-0 ${flag.level === "red" ? "bg-[#B03030]" : "bg-[#E8A23D]"}`}
        aria-label={flag.level === "red" ? t("redFlag") : t("yellowFlag")}
      />
      <span className="text-[#33312D]">{L.humanizeText(flag.message)}</span>
      <span className="ml-auto text-caption text-[#A8A49C] shrink-0 text-right" title={flag.rule_id}>
        {L.ruleLabel(flag.rule_id)}
      </span>
    </li>
  );
}

/** Mô tả CR điền sẵn từ gap report: cờ đỏ trên nội dung đã có (người dùng sửa lại trước khi gửi). */
export const gapReportPrefill = (report: GapReport, L: Mode1Labels): { title: string; description: string } => {
  const reds = report.sections.flatMap((s) =>
    s.flags
      .filter((f) => f.level === "red" && f.rule_id !== "section_empty")
      .map((f) => `- ${L.sectionTitle(s.section_id, s.title)}: ${L.humanizeText(f.message)}`)
  );
  return {
    title: L.t("gapReport.prefillTitle"),
    description: [L.t("gapReport.prefillIntro", { version: report.doc_version }), ...reds].join("\n"),
  };
};

/**
 * 1.13 Gap report (UC-23): cờ đỏ/vàng theo section, hình chưa vẽ, field còn độ tin thấp. Mẫu FPT không bắt buộc (FLF-312):
 * không liệt kê đầu mục FPT thiếu hay tiêu đề ngoài mẫu.
 */
export default function GapReportView({ projectId, projectName, onChanged, readOnly = false }: GapReportViewProps) {
  const t = useTranslations("mode1.gapReport");
  const L = useMode1Labels();
  const errText = useErrorText();
  const [report, setReport] = useState<GapReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  const load = useCallback(
    () =>
      getGapReport(projectId)
        .then((res) => setReport(res.data))
        .catch((err: unknown) => setError(errText(err, "loadGapReport"))),
    [projectId, errText]
  );

  useEffect(() => {
    void load();
  }, [load]);

  const download = async () => {
    setDownloading(true);
    setError(null);
    try {
      const { blob, filename } = await downloadGapReport(projectId);
      saveBlob(blob, filename ?? `${projectName ?? "SRS"}_gap-report.docx`);
      onChanged?.();
    } catch (err) {
      setError(L.errorText(err, t("downloadFailed")));
    } finally {
      setDownloading(false);
    }
  };

  if (!report) {
    return error ? (
      <div role="alert" className="bg-[#FDEDED] border border-[#F2CACA] text-[#8A4141] rounded-[12px] px-4 py-3 text-body">
        {error}
      </div>
    ) : (
      <PageSkeleton rows={2} label={t("loading")} />
    );
  }

  const prefill = gapReportPrefill(report, L);

  return (
    <div className="flex flex-col gap-5 max-w-[920px] w-full mx-auto">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-title font-extrabold text-[#191817]">{t("title", { version: report.doc_version })}</h2>
          <p className="text-body text-[#8A867E]">{t("generatedAt", { at: L.formatDateTime(report.generated_at) })}</p>
        </div>
      </div>

      {error && (
        <div role="alert" className="bg-[#FDEDED] border border-[#F2CACA] text-[#8A4141] rounded-[12px] px-4 py-3 text-body">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <Tile label={t("tileRed")} value={report.totals.red} tone="red" />
        <Tile label={t("tileYellow")} value={report.totals.yellow} tone="yellow" />
        <Tile label={t("tileLowConfidence")} value={report.totals.low_confidence_fields} tone="yellow" />
      </div>

      <div className="flex flex-wrap gap-3 bg-white border border-[#ECEAE5] rounded-[14px] p-4">
        <div className="flex-1 min-w-[240px] text-body text-[#4B4842]">
          <p className="font-bold text-[#191817]">{t("nextTitle")}</p>
          <p>{t("nextBody")}</p>
        </div>
        <button
          type="button"
          onClick={() => void download()}
          disabled={downloading}
          className="px-4 py-2 rounded-[10px] border-[1.5px] border-[#E4E1DC] bg-white text-body font-bold text-[#191817] hover:bg-[#FAF9F7] disabled:opacity-50"
        >
          {downloading ? t("downloading") : t("download")}
        </button>
        {!readOnly && (
          <Link
            href={crPrefillHref(projectId, { ...prefill, source: "gap_report", ref: t("prefillRef", { version: report.doc_version }) })}
            className="px-4 py-2 rounded-[10px] btn-gradient-primary text-white text-body font-bold"
          >
            {t("createCr")}
          </Link>
        )}
      </div>

      {report.sections.length > 0 && (
        <section className="flex flex-col gap-3">
          <h3 className="font-extrabold text-[#191817] text-heading">{t("flagsBySection")}</h3>
          {report.sections.map((s) => (
            <article key={s.section_id} className="bg-white border border-[#ECEAE5] rounded-[14px] p-4 flex flex-col gap-2">
              <h4 className="font-bold text-[#191817] text-body">{L.sectionTitle(s.section_id, s.title)}</h4>
              <ul className="flex flex-col gap-1.5">
                {s.flags.map((f) => (
                  <FlagRow key={f.id} flag={f} />
                ))}
              </ul>
            </article>
          ))}
        </section>
      )}

      {report.unrendered_diagrams.length > 0 && (
        <section className="bg-white border border-[#ECEAE5] rounded-[14px] p-4 flex flex-col gap-2">
          <h3 className="font-extrabold text-[#191817] text-heading">{t("unrenderedTitle")}</h3>
          <p className="text-body text-[#6B6760]">{t("unrenderedHint")}</p>
          <ul className="list-disc pl-5 text-body text-[#33312D] flex flex-col gap-1">
            {report.unrendered_diagrams.map((d) => (
              <li key={`${d.kind}:${d.diagram_id}`}>
                {L.humanizeText(d.title)}
                <span className="text-[#6B6760]"> — {d.reason === "error" ? t("renderError") : t("notRendered")}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {report.low_confidence_fields.length > 0 && (
        <section className="bg-white border border-[#ECEAE5] rounded-[14px] p-4 flex flex-col gap-2">
          <h3 className="font-extrabold text-[#191817] text-heading">{t("lowConfidenceTitle")}</h3>
          <ul className="text-body text-[#33312D] flex flex-col gap-1">
            {report.low_confidence_fields.map((f) => (
              <li key={`${f.section_id}|${f.path}`}>
                <span title={f.path}>{L.pathLabel(f.path, f.entity_name)}</span> — {formatPercent(f.confidence)}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
