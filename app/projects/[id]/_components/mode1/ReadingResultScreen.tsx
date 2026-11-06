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
  /**
   * Dự án có sẵn (FLF-336): "Hoàn thiện" ⇒ finalize với `complete: true`; kèm "Dừng, tải gap report". Không truyền ⇒ không
   * có hai nút này (dự án mới theo mẫu bắt buộc — BE chặn khoá mẫu còn trống thành bản gốc).
   */
  onComplete?: () => void;
  /**
   * FLF-278 / FLF-378 — dự án **mới** theo mẫu bắt buộc: file là mẫu (trống / hướng dẫn / ví dụ), lối đi duy nhất là "Viết
   * với FlintFlow" (Luồng 2: Brief, AI soạn mọi mục của mẫu, BA duyệt, ký baseline 1.0). Truyền ⇒ màn đổi sang lời "đọc mẫu".
   */
  onDraftMissing?: () => void;
  /**
   * FLF-382 (luồng B — dự án có sẵn, mẫu cố định, chế độ 3): ước tính credit cho phần AI soạn mục còn trống
   * (`GET /import` → `gap_fill_credit_estimate`) — hiện cạnh nút Hoàn thiện. `null` / không truyền ⇒ không hiện.
   */
  gapFillCredits?: number | null;
  busy?: boolean;
}

const STATUS_TONE: Record<TargetStructure["sections"][number]["status"], string> = {
  present: "bg-[#E9F7EE] text-[#1F7A45]",
  missing: "bg-[#FDEDED] text-[#B03030]",
  out_of_scope: "bg-[#F0EEEA] text-[#6B6862]"
};

/**
 * Điểm dừng "Kết quả đọc file" (FLF-336 §3.1.2 bước 1.10): bản đồ mục của file ⇒ cấu trúc đích (có / sẽ soạn / ngoài phạm vi),
 * chế độ thật Code đã chọn (3 / 4). Lối đi theo loại dự án:
 *  - dự án có sẵn · tự do (chế độ 4): **Dừng, tải gap report** (dự án "chưa hoàn thiện", mở lại tiếp được, chỉ xuất DRAFT)
 *    hoặc **Hoàn thiện**;
 *  - dự án có sẵn · mẫu cố định (chế độ 3, FLF-382): một nút **Hoàn thiện** (kèm ước tính credit) — chốt 0.1 đúng phần đã
 *    viết rồi mở CR "Bổ sung mục còn thiếu"; tải gap report chỉ là liên kết phụ;
 *  - dự án mới theo mẫu bắt buộc (FLF-278): chỉ **Viết với FlintFlow** — mẫu còn trống thì khoá thành bản gốc hay tải gap
 *    report đều vô nghĩa.
 */
export default function ReadingResultScreen({ projectId, structure, onComplete, onDraftMissing, gapFillCredits = null, busy = false }: ReadingResultScreenProps) {
  const t = useTranslations("mode1.readingResult");
  const L = useMode1Labels();
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const missing = structure.sections.filter((s) => s.status === "missing");
  const present = structure.sections.filter((s) => s.status === "present");
  const outOfScope = structure.sections.filter((s) => s.status === "out_of_scope");
  const template = Boolean(onDraftMissing);
  // FLF-378: dự án mới theo mẫu bắt buộc — FlintFlow soạn mọi mục của mẫu (chữ trong mẫu là hướng dẫn / ví dụ, không phải nội dung)
  const templateCount = missing.length + present.length;
  // FLF-382 luồng B (có sẵn · mẫu cố định): một nút chính "Hoàn thiện" — chốt 0.1 đúng phần đã viết rồi mở CR "Bổ sung mục
  // còn thiếu"; gap report chỉ còn là liên kết phụ. Luồng A (chế độ 4) giữ Dừng / Hoàn thiện như cũ.
  const fixedExisting = Boolean(onComplete) && !template && structure.resolved_mode === 3;

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
        <h3 className="text-title font-extrabold text-[#191817]">{template ? t("template.title") : t("title")}</h3>
        <p className="text-body text-[#4B4842]">
          {template
            ? t("template.summary", { count: templateCount })
            : fixedExisting
              ? t("fixedExisting.summary", { missing: missing.length, present: present.length })
              : t(`mode.${structure.resolved_mode}`, { missing: missing.length, present: present.length })}
        </p>
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

      {fixedExisting && onComplete ? (
        <div className="flex flex-wrap items-center justify-end gap-3 border-t border-[#ECEAE5] pt-3">
          <button
            type="button"
            disabled={busy || downloading}
            onClick={() => void download()}
            className="mr-auto text-body font-semibold text-[#6A62C4] underline underline-offset-2 hover:text-[#554DB0] cursor-pointer disabled:opacity-50 disabled:cursor-default"
          >
            {downloading ? t("downloading") : t("fixedExisting.gapReport")}
          </button>
          {gapFillCredits !== null && gapFillCredits > 0 && (
            <span className="text-caption font-bold text-[#6B6862]" title={t("fixedExisting.creditsTitle")}>
              {t("fixedExisting.credits", { credits: gapFillCredits })}
            </span>
          )}
          <button type="button" disabled={busy} onClick={onComplete} className="px-5 py-2.5 rounded-[10px] btn-gradient-primary text-white text-body font-bold cursor-pointer disabled:opacity-50">
            {busy ? t("completing") : t("complete")}
          </button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-[#ECEAE5] pt-3">
          <p className="flex-1 min-w-[240px] text-caption text-[#8A867E]">{template ? t("template.note", { count: templateCount }) : t("stopNote")}</p>
          {onComplete && (
            <>
              <button type="button" disabled={busy || downloading} onClick={() => void download()} className="px-4 py-2 rounded-[10px] border border-[#ECEAE5] bg-white text-[#191817] text-body font-bold cursor-pointer disabled:opacity-50">
                {downloading ? t("downloading") : t("stop")}
              </button>
              <button type="button" disabled={busy} onClick={onComplete} className="px-5 py-2.5 rounded-[10px] btn-gradient-primary text-white text-body font-bold cursor-pointer disabled:opacity-50">
                {busy ? t("completing") : t("complete")}
              </button>
            </>
          )}
          {onDraftMissing && (
            <button type="button" disabled={busy} onClick={onDraftMissing} className="px-5 py-2.5 rounded-[10px] btn-gradient-primary text-white text-body font-bold cursor-pointer disabled:opacity-50">
              {busy ? t("template.starting") : t("template.action")}
            </button>
          )}
        </div>
      )}
    </section>
  );
}
