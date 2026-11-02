"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { TEMPLATE_INTENT_OPTIONS } from "@/lib/project-start";
import type { ProjectStartKind, TemplateIntent } from "@/types/project";
import type { ImportStatus } from "@/types/import";
import PageSkeleton from "@/components/ui/PageSkeleton";
import { useImport } from "../../hooks/mode1/useImport";
import ExtractProgress from "./ExtractProgress";
import ReadingResultScreen from "./ReadingResultScreen";
import { IMPORT_DONE_STATUSES } from "./labels";
import PausedBanner from "./PausedBanner";
import PreflightIssues from "./PreflightIssues";
import StartImportCard from "./StartImportCard";
import UploadStep from "./UploadStep";
import OrgTemplatePicker from "./OrgTemplatePicker";
import SaveOrgTemplateCard from "./SaveOrgTemplateCard";
import { gapReportHref } from "./prefill";

interface ImportWizardProps {
  projectId: string;
  credits: number | null;
  /** Gọi sau mỗi bước làm đổi `project.import_state` / credit (header). */
  onChanged?: () => void;
  /** Nhịp poll khi chạy nền — test đặt nhỏ. */
  pollMs?: number;
  /** FLF-335: lựa chọn lúc tạo dự án — dự án mới có mẫu bắt buộc ⇒ màn tải mẫu, ý định `fixed` cố định. */
  startKind?: ProjectStartKind | null;
  templateIntent?: TemplateIntent | null;
}

type StepId = "upload" | "start" | "run" | "result" | "done";
const STEP_IDS: StepId[] = ["upload", "start", "run", "result", "done"];

/** Trạng thái chạy nền của lượt một mạch (bản ghi cũ ở `fields_review` cũng thuộc bước này — chỉ cần bấm Tiếp tục). */
const RUN_STATUSES: ImportStatus[] = ["extracting", "fields_review", "baselining", "checking"];

/** Bước đã đọc xong file ⇒ hiện ngôn ngữ nhận diện (FLF-265, D3). */
const LANGUAGE_STATUSES: ImportStatus[] = ["extracting", "baselining", "checking"];

/**
 * Import SRS có sẵn — FLF-343 chạy một mạch: tải lên (preflight + tách file + khớp mẫu) ⇒ màn báo credit một lần kèm câu hỏi
 * "bản mới nhất" ⇒ Bắt đầu ⇒ đọc file ⇒ baseline 0.1 ⇒ kiểm tra ⇒ trang tạo change request (`?panel=cr`). Không còn bước xác
 * nhận mapping / field / Record of Changes / bấm tạo baseline. Chế độ 3/4 vẫn dừng ở "Kết quả đọc file" (FLF-336).
 */
export default function ImportWizard({ projectId, credits, onChanged, pollMs, startKind = null, templateIntent = null }: ImportWizardProps) {
  const router = useRouter();
  const t = useTranslations("mode1.importWizard");
  const imp = useImport(projectId, pollMs ? { pollMs } : undefined);
  const [pickAnother, setPickAnother] = useState(false);
  /** FLF-335: ý định với file (bước 1.2). Dự án mới có mẫu bắt buộc ⇒ `fixed` cố định; còn lại người dùng chọn, mặc định tự do. */
  const intentLocked = templateIntent === "fixed" && startKind === "new";
  const [intent, setIntent] = useState<TemplateIntent>(templateIntent ?? "free");
  const doc = imp.doc;
  const status: ImportStatus | null = doc?.status ?? null;
  const showUpload = !doc || status === "preflight_rejected" || pickAnother;
  const step: StepId = showUpload || status === "uploaded" || status === "parsing"
    ? "upload"
    : imp.awaitingStart
      ? "start"
      : status === "incomplete"
        ? "result"
        : status && IMPORT_DONE_STATUSES.includes(status)
          ? "done"
          : "run";
  const stepIndex = STEP_IDS.indexOf(step);
  const after = async <T,>(p: Promise<T>) => {
    const res = await p;
    onChanged?.();
    return res;
  };

  // Lượt bấm trong phiên này chạy xong (`gap_review`) ⇒ vào thẳng workspace để tạo change request, không mở popup
  const done = imp.done;
  const navigated = useRef(false);
  useEffect(() => {
    if (!done || navigated.current) return;
    navigated.current = true;
    onChanged?.();
    router.push(`/projects/${projectId}`);
  }, [done, onChanged, router, projectId]);

  if (imp.loading) {
    return (
      <div className="p-8">
        <PageSkeleton rows={2} label={t("loading")} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 max-w-[920px] w-full mx-auto">
      <ol className="flex flex-wrap items-center gap-2 text-body" aria-label={t("stepsAria")}>
        {STEP_IDS.map((id, i) => (
          <li
            key={id}
            aria-current={i === stepIndex ? "step" : undefined}
            className={`px-3 py-1 rounded-full font-bold ${
              i < stepIndex ? "bg-[#E9F7EE] text-[#1F7A45]" : i === stepIndex ? "bg-[#191817] text-white" : "bg-[#F0EEEA] text-[#A8A49C]"
            }`}
          >
            {i + 1}. {t(`steps.${id}`)}
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

      {!showUpload && status && LANGUAGE_STATUSES.includes(status) && imp.data?.profile && (
        <p className="text-body text-on-surface-medium">
          {/* Mode 1 bản đầu không dịch: ngôn ngữ tài liệu = ngôn ngữ file; lạ / thiếu ⇒ tiếng Anh như BE (D1) */}
          {t.rich("detectedLanguage", {
            language: imp.data.profile.language === "vi" ? t("languageVi") : t("languageEn"),
            strong: (c) => <strong>{c}</strong>,
          })}
        </p>
      )}

      {/* FLF-331: Code chưa chắc file là SRS — vẫn cho đi tiếp, nhắc người dùng xem kỹ kết quả */}
      {!showUpload && step === "start" && doc?.preflight.document_kind?.kind === "unknown" && (
        <p role="status" className="text-body text-accent-gold-text bg-accent-gold-soft border border-accent-gold-border rounded-[10px] px-3 py-2 leading-relaxed">
          {t("unknownKindNote")}
        </p>
      )}

      {showUpload && (
        <>
          {status === "preflight_rejected" && doc && !pickAnother && <PreflightIssues issues={doc.preflight.issues} fileName={doc.original_name} />}
          {!intentLocked && (
            <fieldset className="flex flex-col gap-2 rounded-[12px] border border-[#ECEAE5] bg-white p-3">
              <legend className="px-1 text-body font-bold text-[#191817]">{t("intent.question")}</legend>
              <div role="radiogroup" aria-label={t("intent.question")} className="flex flex-col gap-2">
                {TEMPLATE_INTENT_OPTIONS.map((value) => (
                  <label key={value} className={`flex items-start gap-2 rounded-[10px] px-3 py-2 cursor-pointer ${intent === value ? "bg-[#F2F1FB]" : "hover:bg-[#F6F5F2]"}`}>
                    <input type="radio" name="template-intent" value={value} checked={intent === value} onChange={() => setIntent(value)} disabled={imp.busy === "upload"} className="mt-1" />
                    <span className="flex flex-col">
                      <span className="text-body font-bold text-[#191817]">{t(`intent.${value}.label`)}</span>
                      <span className="text-caption text-[#8A867E]">{t(`intent.${value}.description`)}</span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
          )}
          <UploadStep
            busy={imp.busy === "upload"}
            onUpload={(file) => void after(imp.upload(file, intentLocked ? "fixed" : intent)).then(() => setPickAnother(false))}
            title={status === "preflight_rejected" ? t("uploadFixed") : intentLocked ? t("uploadTemplate") : undefined}
            {...(intentLocked ? { hint: t("uploadTemplateHint") } : {})}
          />
          {intentLocked && <OrgTemplatePicker busy={imp.busy === "upload"} onPick={(id) => void after(imp.pickOrgTemplate(id, "fixed")).then(() => setPickAnother(false))} />}
          <p className="text-body text-[#4B4842] bg-[#F2F1FB] border border-[#DCD9F2] rounded-[10px] px-3 py-2 leading-relaxed">{t.rich("formatNote", { b: (c) => <b>{c}</b> })}</p>
        </>
      )}

      {!showUpload && (status === "uploaded" || status === "parsing") && (
        <div className="flex items-center gap-3 text-body text-[#4B4842] bg-white border border-[#ECEAE5] rounded-[14px] p-5">
          <span className="w-5 h-5 rounded-full border-2 border-[#E4E1DC] border-t-[#6A62C4] ff-spinner" />
          {t("parsing")}
          <button type="button" onClick={() => void imp.reload()} className="ml-auto text-body font-bold text-[#6A62C4] underline">
            {t("reload")}
          </button>
        </div>
      )}

      {/* Điểm dừng duy nhất: báo credit một lần + câu hỏi "bản mới nhất" + Bắt đầu */}
      {!showUpload && step === "start" && doc && (
        <StartImportCard
          doc={doc}
          estimate={imp.data?.credit_estimate ?? null}
          credits={credits}
          busy={imp.busy === "start"}
          onStart={(confirmLatest) => void after(imp.start(confirmLatest))}
          onPickAnother={() => setPickAnother(true)}
        />
      )}

      {!showUpload && step === "run" && status === "extracting" && doc && (
        <ExtractProgress
          doc={doc}
          sections={imp.data?.extraction.sections ?? []}
          running={imp.running}
          credits={credits}
          estimate={imp.data?.credit_estimate ?? null}
          busy={imp.busy === "resume"}
          onStart={() => void after(imp.resume())}
          onResume={() => void after(imp.resume())}
          headingMap={imp.data?.profile?.heading_map}
        />
      )}

      {!showUpload && step === "run" && status && RUN_STATUSES.includes(status) && status !== "extracting" && doc && (
        <div className="bg-white border border-[#ECEAE5] rounded-[14px] p-5 flex flex-col gap-3">
          {doc.paused ? (
            <PausedBanner
              paused={doc.paused}
              what={t("run.pausedWhat")}
              {...(status === "baselining" ? { interrupted: t("run.interrupted") } : {})}
              busy={imp.busy === "resume"}
              onResume={() => void after(imp.resume())}
            />
          ) : status === "fields_review" ? (
            // Bản ghi cũ (trước FLF-343) dừng ở bước xác nhận field ⇒ Tiếp tục = tạo bản gốc một mạch
            <div className="flex flex-wrap items-center gap-3">
              <p className="flex-1 text-body text-[#4B4842]">{t("run.legacy")}</p>
              <button
                type="button"
                disabled={imp.busy === "resume"}
                onClick={() => void after(imp.resume())}
                className="px-5 py-2.5 rounded-[10px] btn-gradient-primary text-white text-body font-bold disabled:opacity-50 cursor-pointer"
              >
                {t("run.continue")}
              </button>
            </div>
          ) : (
            <div role="status" className="flex items-center gap-3 text-[13px] text-[#4B4842] bg-[#F2F1FB] border border-[#DCD9F2] rounded-[12px] px-4 py-3">
              <span className="w-5 h-5 shrink-0 rounded-full border-2 border-[#E4E1DC] border-t-[#6A62C4] ff-spinner" />
              <div className="flex flex-col gap-0.5">
                <span className="font-bold text-[#191817]">{status === "checking" ? t("run.checking") : t("run.baselining")}</span>
                <span className="text-[12px]">{t("run.hint")}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {!showUpload && status === "incomplete" && imp.data?.target_structure && (
        <ReadingResultScreen
          projectId={projectId}
          structure={imp.data.target_structure}
          busy={imp.busy === "finalize"}
          onComplete={() => void after(imp.complete())}
          onDraftMissing={() =>
            void after(imp.continueFlow2()).then((res) => {
              // Dự án đã sang luồng tạo mới (`fpt`) ⇒ workspace chạy từ Brief
              if (res) router.push(`/projects/${projectId}`);
            })
          }
        />
      )}

      {/* FLF-278: lưu mẫu cho tổ chức (dự án theo mẫu bắt buộc) */}
      {!showUpload && intentLocked && doc && (status === "incomplete" || (status && IMPORT_DONE_STATUSES.includes(status))) && (
        <SaveOrgTemplateCard projectId={projectId} defaultName={doc.original_name.replace(/\.docx$/i, "")} />
      )}

      {!showUpload && status && IMPORT_DONE_STATUSES.includes(status) && (
        <div className="bg-[#E9F7EE] border border-[#BFE6CE] rounded-[14px] p-5 flex flex-wrap items-center gap-3 text-body text-[#1F7A45]">
          <span className="flex-1">{t.rich("done.body", { strong: (c) => <strong>{c}</strong> })}</span>
          <Link href={gapReportHref(projectId)} className="px-4 py-2 rounded-[8px] border border-[#1F7A45] text-[#1F7A45] font-bold">
            {t("done.gapReport")}
          </Link>
          <Link href={`/projects/${projectId}`} className="px-4 py-2 rounded-[8px] bg-[#1F7A45] text-white font-bold">
            {t("done.openCr")}
          </Link>
        </div>
      )}
    </div>
  );
}
