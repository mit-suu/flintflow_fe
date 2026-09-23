"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { downloadGapReport, getGapReport } from "@/lib/api/import";
import { saveBlob } from "@/lib/api/files";
import { sectionLabel } from "@/lib/constants/fpt-sections";
import type { Flag } from "@/types/spine";
import type { GapReport } from "@/types/import";
import PageSkeleton from "@/components/ui/PageSkeleton";
import { errorText } from "./errors";
import { formatDateTime, formatPercent } from "./labels";
import { crPrefillHref } from "./prefill";

interface GapReportViewProps {
  projectId: string;
  projectName?: string;
  /** Tải báo cáo lần đầu ⇒ BE chuyển import sang `delivered` — báo header đọc lại. */
  onChanged?: () => void;
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
    <span className="text-[22px] font-extrabold leading-none">{value}</span>
    <span className="text-[11.5px] font-semibold">{label}</span>
  </div>
);

const FlagRow = ({ flag }: { flag: Flag }) => (
  <li className="flex items-start gap-2 text-[12.5px]">
    <span className={`mt-1 w-2 h-2 rounded-full shrink-0 ${flag.level === "red" ? "bg-[#B03030]" : "bg-[#E8A23D]"}`} aria-label={flag.level === "red" ? "Cờ đỏ" : "Cờ vàng"} />
    <span className="text-[#33312D]">{flag.message}</span>
    <code className="ml-auto text-[10.5px] text-[#A8A49C] shrink-0">{flag.rule_id}</code>
  </li>
);

/**
 * Mô tả CR điền sẵn từ gap report: chỉ cờ đỏ trên **nội dung đã có** (người dùng sửa lại trước khi gửi).
 * Mục còn thiếu (`section_empty`, `missing_sections`) KHÔNG đưa vào: CR sửa phần tử Spine đang có, mục trống thì
 * không có gì để sửa — C-3 sẽ trả 0 vị trí. Mục thiếu đi đường step (AI soạn nội dung, D6), gap report chỉ lối riêng.
 */
export const gapReportPrefill = (report: GapReport): { title: string; description: string } => {
  const reds = report.sections.flatMap((s) =>
    s.flags.filter((f) => f.level === "red" && f.rule_id !== "section_empty").map((f) => `- ${sectionLabel(s.section_id)}: ${f.message}`)
  );
  return {
    title: "Sửa theo gap report",
    description: ["Xử lý các vấn đề trong gap report của bản " + report.doc_version + ":", ...reds].join("\n"),
  };
};

/** 1.13 Gap report (UC-23): cờ đỏ/vàng theo section, section thiếu, heading không khớp, field còn độ tin thấp. */
export default function GapReportView({ projectId, projectName, onChanged }: GapReportViewProps) {
  const [report, setReport] = useState<GapReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  const load = useCallback(
    () =>
      getGapReport(projectId)
        .then((res) => setReport(res.data))
        .catch((err: unknown) => setError(errorText(err, "Không tải được gap report"))),
    [projectId]
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
      setError(errorText(err, "Không tải được file gap report"));
    } finally {
      setDownloading(false);
    }
  };

  if (!report) {
    return error ? (
      <div role="alert" className="bg-[#FDEDED] border border-[#F2CACA] text-[#8A4141] rounded-[12px] px-4 py-3 text-[12.5px]">
        {error}
      </div>
    ) : (
      <PageSkeleton rows={2} label="Đang tải gap report" />
    );
  }

  const prefill = gapReportPrefill(report);

  return (
    <div className="flex flex-col gap-5 max-w-[920px] w-full mx-auto">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-[20px] font-extrabold text-[#191817]">Gap report — bản {report.doc_version}</h2>
          <p className="text-[12px] text-[#8A867E]">Tạo lúc {formatDateTime(report.generated_at)}. Cờ đỏ phải xử lý trước khi release; cờ vàng là khuyến nghị.</p>
        </div>
      </div>

      {error && (
        <div role="alert" className="bg-[#FDEDED] border border-[#F2CACA] text-[#8A4141] rounded-[12px] px-4 py-3 text-[12.5px]">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Tile label="Cờ đỏ" value={report.totals.red} tone="red" />
        <Tile label="Cờ vàng" value={report.totals.yellow} tone="yellow" />
        <Tile label="Section bắt buộc thiếu" value={report.totals.missing_sections} tone="red" />
        <Tile label="Heading không khớp" value={report.totals.unmapped_headings} tone="neutral" />
        <Tile label="Field độ tin thấp" value={report.totals.low_confidence_fields} tone="yellow" />
      </div>

      {report.missing_fpt_sections.length > 0 && (
        <section className="bg-[#FDEDED] border border-[#F2CACA] rounded-[14px] p-4 flex flex-col gap-2" aria-label="Đầu mục FPT còn thiếu">
          <h3 className="font-extrabold text-[#8A4141] text-[14px]">Đầu mục mẫu FPT còn thiếu — soạn bằng step, không qua change request</h3>
          <p className="text-[12px] text-[#8A4141]">
            Mục trống thì không có phần tử nào để sửa, nên change request không tìm được vị trí. Về workspace, chạy step tương ứng cho AI soạn
            nội dung (hoặc viết tay), cờ đỏ sẽ tự đóng.
          </p>
          <ul className="flex flex-col gap-1 text-[12.5px] text-[#33312D]">
            {report.missing_fpt_sections.map((m) => (
              <li key={m.section_id} className="flex items-center gap-2">
                <span className="font-semibold">{m.title}</span>
                <span className="text-[#8A867E]">— {m.in_layout ? "có heading, chưa có nội dung" : "file không có"}</span>
                <code className="ml-auto text-[11px] text-[#6A62C4] shrink-0">chạy {m.step_id}</code>
              </li>
            ))}
          </ul>
          <Link href={`/projects/${projectId}`} className="self-start px-3 py-1.5 rounded-[8px] bg-[#6A62C4] text-white text-[12px] font-bold">
            Về workspace để chạy step
          </Link>
        </section>
      )}

      <div className="flex flex-wrap gap-3 bg-white border border-[#ECEAE5] rounded-[14px] p-4">
        <div className="flex-1 min-w-[240px] text-[12.5px] text-[#4B4842]">
          <p className="font-bold text-[#191817]">Bước tiếp theo</p>
          <p>
            Không cần sửa ⇒ tải báo cáo để gửi. Cần sửa <strong>nội dung đã có</strong> ⇒ tạo change request (nguồn: gap report). Mục còn thiếu
            thì chạy step ở workspace, không đưa vào CR.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void download()}
          disabled={downloading}
          className="px-4 py-2 rounded-[10px] border-[1.5px] border-[#E4E1DC] bg-white text-[13px] font-bold text-[#191817] hover:bg-[#FAF9F7] disabled:opacity-50"
        >
          {downloading ? "Đang tải…" : "Tải gap report (.docx)"}
        </button>
        <Link
          href={crPrefillHref(projectId, { ...prefill, source: "gap_report", ref: `gap-report ${report.doc_version}` })}
          className="px-4 py-2 rounded-[10px] btn-gradient-primary text-white text-[13px] font-bold"
        >
          Cần sửa → Tạo change request
        </Link>
      </div>

      {report.sections.length > 0 && (
        <section className="flex flex-col gap-3">
          <h3 className="font-extrabold text-[#191817] text-[14px]">Cờ theo section</h3>
          {report.sections.map((s) => (
            <article key={s.section_id} className="bg-white border border-[#ECEAE5] rounded-[14px] p-4 flex flex-col gap-2">
              <h4 className="font-bold text-[#191817] text-[13px]">{s.title && s.title !== s.section_id ? s.title : sectionLabel(s.section_id)}</h4>
              <ul className="flex flex-col gap-1.5">
                {s.flags.map((f) => (
                  <FlagRow key={f.id} flag={f} />
                ))}
              </ul>
            </article>
          ))}
        </section>
      )}

      {report.missing_sections.length > 0 && (
        <section className="bg-white border border-[#ECEAE5] rounded-[14px] p-4 flex flex-col gap-2">
          <h3 className="font-extrabold text-[#191817] text-[14px]">Section bắt buộc không có trong tài liệu</h3>
          <ul className="list-disc pl-5 text-[12.5px] text-[#33312D]">
            {report.missing_sections.map((m) => (
              <li key={m.section_id}>{sectionLabel(m.section_id) === m.section_id ? m.title : sectionLabel(m.section_id)}</li>
            ))}
          </ul>
        </section>
      )}

      {report.unrendered_diagrams.length > 0 && (
        <section className="bg-white border border-[#ECEAE5] rounded-[14px] p-4 flex flex-col gap-2">
          <h3 className="font-extrabold text-[#191817] text-[14px]">Hình chưa vẽ được</h3>
          <p className="text-[12px] text-[#6B6760]">Không chặn ký baseline — vẽ lại ở workspace khi máy chủ vẽ hình sẵn sàng.</p>
          <ul className="list-disc pl-5 text-[12.5px] text-[#33312D] flex flex-col gap-1">
            {report.unrendered_diagrams.map((d) => (
              <li key={`${d.kind}:${d.diagram_id}`}>
                {d.title}
                <span className="text-[#6B6760]"> — {d.reason === "error" ? "vẽ lỗi" : "chưa vẽ"}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {report.unmapped_headings.length > 0 && (
        <section className="bg-white border border-[#ECEAE5] rounded-[14px] p-4 flex flex-col gap-2">
          <h3 className="font-extrabold text-[#191817] text-[14px]">Heading không khớp template (giữ nguyên, không trích)</h3>
          <ul className="text-[12.5px] text-[#33312D] flex flex-col gap-1">
            {report.unmapped_headings.map((h) => (
              <li key={h.block_id}>
                <code className="text-[11px] text-[#A8A49C] mr-2">{h.block_id}</code>
                {h.text}
              </li>
            ))}
          </ul>
        </section>
      )}

      {report.low_confidence_fields.length > 0 && (
        <section className="bg-white border border-[#ECEAE5] rounded-[14px] p-4 flex flex-col gap-2">
          <h3 className="font-extrabold text-[#191817] text-[14px]">Field còn độ tin thấp</h3>
          <ul className="text-[12.5px] text-[#33312D] flex flex-col gap-1">
            {report.low_confidence_fields.map((f) => (
              <li key={`${f.section_id}|${f.path}`}>
                <code className="font-mono">{f.path}</code> — {formatPercent(f.confidence)}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
