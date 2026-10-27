"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import type { RocRow } from "@/types/document";
import type { ImportStatus } from "@/types/import";
import PageSkeleton from "@/components/ui/PageSkeleton";
import { useImport } from "../../hooks/mode1/useImport";
import ConfirmLatestModal from "./ConfirmLatestModal";
import CreditEstimateNote from "./CreditEstimateNote";
import ExtractProgress from "./ExtractProgress";
import ReadingResultScreen from "./ReadingResultScreen";
import FieldsReview from "./FieldsReview";
import { IMPORT_DONE_STATUSES } from "./labels";
import MappingReviewTable from "./MappingReviewTable";
import PausedBanner from "./PausedBanner";
import PreflightIssues from "./PreflightIssues";
import RecordOfChangesCard from "./RecordOfChangesCard";
import UploadStep from "./UploadStep";
import { gapReportHref } from "./prefill";

interface ImportWizardProps {
  projectId: string;
  credits: number | null;
  /** Gọi sau mỗi bước làm đổi `project.import_state` / credit (header). */
  onChanged?: () => void;
  /** Nhịp poll khi trích — test đặt nhỏ. */
  pollMs?: number;
}

const STEPS: { id: "upload" | "mapping" | "extract" | "fields" | "result" | "baseline" | "gap"; statuses: ImportStatus[] }[] = [
  { id: "upload", statuses: ["uploaded", "preflight_rejected", "awaiting_latest_confirm", "parsing"] },
  { id: "mapping", statuses: ["mapping_review"] },
  { id: "extract", statuses: ["extracting"] },
  { id: "fields", statuses: ["fields_review"] },
  // FLF-336 I-5: so cấu trúc đích — thiếu mục ⇒ điểm dừng "Kết quả đọc file"
  { id: "result", statuses: ["incomplete"] },
  { id: "baseline", statuses: ["baselining", "checking"] },
  { id: "gap", statuses: IMPORT_DONE_STATUSES as ImportStatus[] },
];

/**
 * Bước đã đọc xong file ⇒ hiện ngôn ngữ nhận diện (FLF-265, D3). Không gắn vào bước mapping vì BE có thể bỏ qua nó
 * (mapping đủ tin cậy ⇒ đi thẳng sang trích).
 */
const LANGUAGE_STATUSES: ImportStatus[] = ["fields_review", "baselining", "checking"];


/** Luồng 1.1–1.12 (UC-19–UC-22): mỗi bước hiện theo `import.status` do BE trả. */
export default function ImportWizard({ projectId, credits, onChanged, pollMs }: ImportWizardProps) {
  const router = useRouter();
  const t = useTranslations("mode1.importWizard");
  const imp = useImport(projectId, pollMs ? { pollMs } : undefined);
  const [pickAnother, setPickAnother] = useState(false);
  /** Record of Changes người dùng đã sửa (FLF-252); `null` = chưa đụng tới. */
  const [recordOfChanges, setRecordOfChanges] = useState<RocRow[] | null>(null);
  const doc = imp.doc;
  const status: ImportStatus | null = doc?.status ?? null;
  const stepIndex = status ? STEPS.findIndex((s) => s.statuses.includes(status)) : 0;
  const after = async <T,>(p: Promise<T>) => {
    const res = await p;
    onChanged?.();
    return res;
  };

  // Baseline 0.1 + kiểm chạy nền xong (poll thấy `gap_review`) ⇒ sang màn Tài liệu & version, mở sẵn popup gap report
  const finalizeDone = imp.finalizeDone;
  const navigated = useRef(false);
  useEffect(() => {
    if (!finalizeDone || navigated.current) return;
    navigated.current = true;
    onChanged?.();
    router.push(gapReportHref(projectId));
  }, [finalizeDone, onChanged, router, projectId]);

  if (imp.loading) {
    return (
      <div className="p-8">
        <PageSkeleton rows={2} label={t("loading")} />
      </div>
    );
  }

  const showUpload = !doc || status === "preflight_rejected" || (status === "awaiting_latest_confirm" && pickAnother);

  return (
    <div className="flex flex-col gap-5 max-w-[920px] w-full mx-auto">
      <ol className="flex flex-wrap items-center gap-2 text-body" aria-label={t("stepsAria")}>
        {STEPS.map((s, i) => (
          <li
            key={s.id}
            aria-current={i === stepIndex ? "step" : undefined}
            className={`px-3 py-1 rounded-full font-bold ${
              i < stepIndex ? "bg-[#E9F7EE] text-[#1F7A45]" : i === stepIndex ? "bg-[#191817] text-white" : "bg-[#F0EEEA] text-[#A8A49C]"
            }`}
          >
            {i + 1}. {t(`steps.${s.id}`)}
          </li>
        ))}
      </ol>

      {imp.error && (
        <div role="alert" className="flex items-center gap-3 bg-[#FDEDED] border border-[#F2CACA] text-[#8A4141] px-4 py-3 rounded-[12px] text-body">
          <span className="flex-1">{imp.error}</span>
          <button type="button" onClick={imp.clearError} className="font-bold hover:opacity-75" aria-label={t("closeError")}>
            ✕
          </button>
        </div>
      )}

      {status && LANGUAGE_STATUSES.includes(status) && imp.data?.profile && (
        <p className="text-body text-on-surface-medium">
          {/* Mode 1 bản đầu không dịch: ngôn ngữ tài liệu = ngôn ngữ file; lạ / thiếu ⇒ tiếng Anh như BE (D1) */}
          {t.rich("detectedLanguage", {
            language: imp.data.profile.language === "vi" ? t("languageVi") : t("languageEn"),
            strong: (c) => <strong>{c}</strong>,
          })}
        </p>
      )}

      {/* FLF-331: Code chưa chắc file là SRS — vẫn cho đi tiếp, nhắc người dùng xem kỹ kết quả đọc file (bước 1.5) */}
      {!showUpload && doc?.preflight.document_kind?.kind === "unknown" && (
        <p role="status" className="text-body text-accent-gold-text bg-accent-gold-soft border border-accent-gold-border rounded-[10px] px-3 py-2 leading-relaxed">
          {t("unknownKindNote")}
        </p>
      )}

      {showUpload && (
        <>
          {status === "preflight_rejected" && doc && <PreflightIssues issues={doc.preflight.issues} fileName={doc.original_name} />}
          <UploadStep
            busy={imp.busy === "upload"}
            onUpload={(file) =>
              void after(imp.upload(file)).then(() => setPickAnother(false))
            }
            title={status === "preflight_rejected" ? t("uploadFixed") : undefined}
          />
          <p className="text-body text-[#4B4842] bg-[#F2F1FB] border border-[#DCD9F2] rounded-[10px] px-3 py-2 leading-relaxed">
            {t.rich("formatNote", { b: (c) => <b>{c}</b> })}
          </p>
        </>
      )}

      {doc && status === "awaiting_latest_confirm" && !pickAnother && (
        <ConfirmLatestModal
          open
          fileName={doc.original_name}
          busy={imp.busy === "confirm"}
          onConfirm={() => void after(imp.confirm())}
          onPickAnother={() => setPickAnother(true)}
        />
      )}

      {(status === "uploaded" || status === "parsing") && (
        <div className="flex items-center gap-3 text-body text-[#4B4842] bg-white border border-[#ECEAE5] rounded-[14px] p-5">
          <span className="w-5 h-5 rounded-full border-2 border-[#E4E1DC] border-t-[#6A62C4] ff-spinner" />
          {t("parsing")}
          <button type="button" onClick={() => void imp.reload()} className="ml-auto text-body font-bold text-[#6A62C4] underline">
            {t("reload")}
          </button>
        </div>
      )}

      {status === "mapping_review" && imp.data?.profile && (
        <>
          {imp.data.credit_estimate && <CreditEstimateNote estimate={imp.data.credit_estimate} fallbackBalance={credits} />}
          <MappingReviewTable profile={imp.data.profile} busy={imp.busy === "mapping"} onSubmit={(body) => void after(imp.saveMapping(body))} />
        </>
      )}

      {status === "extracting" && doc && (
        <ExtractProgress
          doc={doc}
          sections={imp.data?.extraction.sections ?? []}
          running={imp.jobRunning}
          credits={credits}
          estimate={imp.data?.credit_estimate ?? null}
          busy={imp.busy === "extract" || imp.busy === "resume"}
          onStart={() => void after(imp.extract())}
          onResume={() => void after(imp.resume())}
          headingMap={imp.data?.profile?.heading_map}
        />
      )}

      {status === "fields_review" && (
        <FieldsReview fields={imp.data?.extraction.review_fields ?? []} headingMap={imp.data?.profile?.heading_map} busy={imp.busy === "fields"} onSubmit={(body) => void after(imp.saveFields(body))} />
      )}

      {(status === "baselining" || status === "checking") && doc && (
        <div className="bg-white border border-[#ECEAE5] rounded-[14px] p-5 flex flex-col gap-3">
          <h3 className="font-extrabold text-[#191817] text-heading">{t("baseline.title")}</h3>
          <p className="text-body text-[#4B4842] leading-relaxed">
            {t.rich("baseline.body", { strong: (c) => <strong>{c}</strong> })}
          </p>
          {status === "baselining" && !doc.paused && !imp.finalizing && (
            <RecordOfChangesCard
              rows={recordOfChanges ?? imp.data?.profile?.record_of_changes ?? []}
              fromFile={imp.data?.profile?.record_of_changes?.length ?? 0}
              onChange={setRecordOfChanges}
              disabled={imp.busy === "finalize"}
            />
          )}
          {doc.paused ? (
            status === "baselining" ? (
              // Job tạo bản gốc lỗi / bị gián đoạn: BE đã hoàn về trước bước này, Tiếp tục = chạy lại
              <PausedBanner
                paused={doc.paused}
                what={t("baseline.pausedWhat")}
                interrupted={t("baseline.interrupted")}
                busy={imp.busy === "resume"}
                onResume={() => void after(imp.resume())}
              />
            ) : (
              <PausedBanner paused={doc.paused} what={t("baseline.checkWhat")} busy={imp.busy === "resume"} onResume={() => void after(imp.resume())} />
            )
          ) : imp.finalizing ? (
            <div role="status" className="flex items-center gap-3 text-[13px] text-[#4B4842] bg-[#F2F1FB] border border-[#DCD9F2] rounded-[12px] px-4 py-3">
              <span className="w-5 h-5 shrink-0 rounded-full border-2 border-[#E4E1DC] border-t-[#6A62C4] ff-spinner" />
              <div className="flex flex-col gap-0.5">
                <span className="font-bold text-[#191817]">{t("baseline.running")}</span>
                <span className="text-[12px]">
                  {status === "checking" ? t("baseline.runningChecking") : t("baseline.runningWriting")} {t("baseline.runningHint")}
                </span>
              </div>
            </div>
          ) : (
            <div className="flex justify-end">
              <button
                type="button"
                disabled={imp.busy === "finalize"}
                onClick={() =>
                  // Chưa sửa Record of Changes ⇒ không gửi, BE đọc lại từ file. BE trả ngay, việc chạy nền (poll tới gap_review)
                  void after(imp.finalize(recordOfChanges ?? undefined))
                }
                className="px-5 py-2.5 rounded-[10px] btn-gradient-primary text-white text-body font-bold disabled:opacity-50 cursor-pointer"
              >
                {imp.busy === "finalize" ? t("baseline.starting") : t("baseline.start")}
              </button>
            </div>
          )}
        </div>
      )}

      {status === "incomplete" && imp.data?.target_structure && (
        <ReadingResultScreen
          projectId={projectId}
          structure={imp.data.target_structure}
          busy={imp.busy === "finalize"}
          onComplete={() => void after(imp.finalize(undefined, { complete: true }))}
        />
      )}

      {status && IMPORT_DONE_STATUSES.includes(status) && (
        <div className="bg-[#E9F7EE] border border-[#BFE6CE] rounded-[14px] p-5 flex flex-wrap items-center gap-3 text-body text-[#1F7A45]">
          <span className="flex-1">
            {t.rich("done.body", { strong: (c) => <strong>{c}</strong> })}
          </span>
          <Link href={gapReportHref(projectId)} className="px-4 py-2 rounded-[8px] border border-[#1F7A45] text-[#1F7A45] font-bold">
            {t("done.gapReport")}
          </Link>
          <Link href={`/projects/${projectId}`} className="px-4 py-2 rounded-[8px] bg-[#1F7A45] text-white font-bold">
            {t("done.openDocument")}
          </Link>
        </div>
      )}
    </div>
  );
}
