"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { downloadGapReport } from "@/lib/api/import";
import { saveBlob } from "@/lib/api/files";
import type { TargetStructure } from "@/types/import";
import { useMode1Labels } from "./i18n";

interface ReadingResultScreenProps {
  projectId: string;
  structure: TargetStructure;
  /** Bấm "Hoàn thiện" ⇒ finalize với `complete: true`. */
  onComplete: () => void;
  /**
   * FLF-278 trên FLF-336 — chế độ 3: "Viết phần còn thiếu với FlintFlow" (Luồng 2: Brief từ phần đã có, AI soạn từng bước
   * còn thiếu, BA duyệt, ký baseline 1.0). Không truyền ⇒ không có nút (chế độ 4 chưa hỗ trợ).
   */
  onDraftMissing?: () => void;
  busy?: boolean;
}

const STATUS_TONE: Record<TargetStructure["sections"][number]["status"], string> = {
  present: "bg-[#E9F7EE] text-[#1F7A45]",
  missing: "bg-[#FDEDED] text-[#B03030]",
  out_of_scope: "bg-[#F0EEEA] text-[#6B6862]"
};

/**
 * Điểm dừng "Kết quả đọc file" (FLF-336 §3.1.2 bước 1.10): bản đồ mục của file ⇒ cấu trúc đích (có / sẽ soạn / ngoài phạm vi),
 * chế độ thật Code đã chọn (3 / 4), hai lối đi: **Dừng, tải gap report** (dự án "chưa hoàn thiện", mở lại tiếp được, chỉ xuất
 * DRAFT) hoặc **Hoàn thiện** (lát 1: tạo v0 như hôm nay; lát sau: rà soát phần có sẵn rồi soạn phần thiếu).
 */
export default function ReadingResultScreen({ projectId, structure, onComplete, onDraftMissing, busy = false }: ReadingResultScreenProps) {
  const t = useTranslations("mode1.readingResult");
  const L = useMode1Labels();
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const missing = structure.sections.filter((s) => s.status === "missing");
  const present = structure.sections.filter((s) => s.status === "present");
  const outOfScope = structure.sections.filter((s) => s.status === "out_of_scope");

  const download = async () => {
    setDownloading(true);
    setError(null);
    try {
      const { blob, filename } = await downloadGapReport(projectId);
      saveBlob(blob, filename ?? "gap-report.docx");
    } catch (err) {
      setError(L.errorText(err, t("downloadFailed")));
    } finally {
      setDownloading(false);
    }
  };

  return (
    <section className="bg-white border border-[#ECEAE5] rounded-[14px] p-5 flex flex-col gap-4" aria-label={t("aria")}>
      <div>
        <h3 className="text-title font-extrabold text-[#191817]">{t("title")}</h3>
        <p className="text-body text-[#4B4842]">{t(`mode.${structure.resolved_mode}`, { missing: missing.length, present: present.length })}</p>
      </div>

      <ul className="flex flex-col gap-1.5" aria-label={t("mapAria")}>
        {structure.sections.map((s) => (
          <li key={s.section_id} className="flex flex-wrap items-center gap-2 text-body">
            <span className={`px-2 py-0.5 rounded-full text-caption font-bold ${STATUS_TONE[s.status]}`}>{t(`status.${s.status}`)}</span>
            <span className="font-bold text-[#191817]">{L.humanizeText(s.title)}</span>
            {s.status === "missing" && s.owner_steps.length > 0 && <span className="text-caption text-[#8A867E]">{t("ownerSteps", { steps: s.owner_steps.join(", ") })}</span>}
          </li>
        ))}
      </ul>
      {outOfScope.length > 0 && <p className="text-caption text-[#8A867E]">{t("outOfScopeNote", { count: outOfScope.length })}</p>}

      {error && (
        <p role="alert" className="text-body text-[#B03030]">
          {error}
        </p>
      )}

      <div className="flex flex-wrap items-center justify-end gap-2 border-t border-[#ECEAE5] pt-3">
        <p className="flex-1 min-w-[240px] text-caption text-[#8A867E]">{onDraftMissing && structure.resolved_mode === 3 ? t("draftMissingNote") : t("stopNote")}</p>
        <button type="button" disabled={busy || downloading} onClick={() => void download()} className="px-4 py-2 rounded-[10px] border border-[#ECEAE5] bg-white text-[#191817] text-body font-bold cursor-pointer disabled:opacity-50">
          {downloading ? t("downloading") : t("stop")}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={onComplete}
          className={onDraftMissing && structure.resolved_mode === 3 ? "px-4 py-2 rounded-[10px] border border-[#ECEAE5] bg-white text-[#191817] text-body font-bold cursor-pointer disabled:opacity-50" : "px-5 py-2.5 rounded-[10px] btn-gradient-primary text-white text-body font-bold cursor-pointer disabled:opacity-50"}
        >
          {busy ? t("completing") : t("complete")}
        </button>
        {onDraftMissing && structure.resolved_mode === 3 && (
          <button type="button" disabled={busy} onClick={onDraftMissing} className="px-5 py-2.5 rounded-[10px] btn-gradient-primary text-white text-body font-bold cursor-pointer disabled:opacity-50">
            {t("draftMissing")}
          </button>
        )}
      </div>
    </section>
  );
}
