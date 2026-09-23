"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ImportStatus } from "@/types/import";
import PageSkeleton from "@/components/ui/PageSkeleton";
import { useImport } from "../../hooks/mode1/useImport";
import ConfirmLatestModal from "./ConfirmLatestModal";
import ExtractProgress from "./ExtractProgress";
import FieldsReview from "./FieldsReview";
import { IMPORT_DONE_STATUSES } from "./labels";
import MappingReviewTable from "./MappingReviewTable";
import PausedBanner from "./PausedBanner";
import PreflightIssues from "./PreflightIssues";
import UploadStep from "./UploadStep";

interface ImportWizardProps {
  projectId: string;
  credits: number | null;
  /** Gọi sau mỗi bước làm đổi `project.import_state` / credit (header). */
  onChanged?: () => void;
  /** Nhịp poll khi trích — test đặt nhỏ. */
  pollMs?: number;
}

const STEPS: { label: string; statuses: ImportStatus[] }[] = [
  { label: "Tải lên", statuses: ["uploaded", "preflight_rejected", "awaiting_latest_confirm", "parsing"] },
  { label: "Mapping", statuses: ["mapping_review"] },
  { label: "Trích field", statuses: ["extracting"] },
  { label: "Xác nhận field", statuses: ["fields_review"] },
  { label: "Baseline & kiểm", statuses: ["baselining", "checking"] },
  { label: "Gap report", statuses: IMPORT_DONE_STATUSES as ImportStatus[] },
];

/** Luồng 1.1–1.12 (UC-19–UC-22): mỗi bước hiện theo `import.status` do BE trả. */
export default function ImportWizard({ projectId, credits, onChanged, pollMs }: ImportWizardProps) {
  const router = useRouter();
  const imp = useImport(projectId, pollMs ? { pollMs } : undefined);
  const [pickAnother, setPickAnother] = useState(false);
  const doc = imp.doc;
  const status: ImportStatus | null = doc?.status ?? null;
  const stepIndex = status ? STEPS.findIndex((s) => s.statuses.includes(status)) : 0;
  const after = async <T,>(p: Promise<T>) => {
    const res = await p;
    onChanged?.();
    return res;
  };

  if (imp.loading) {
    return (
      <div className="p-8">
        <PageSkeleton rows={2} label="Đang tải trạng thái import" />
      </div>
    );
  }

  const showUpload = !doc || status === "preflight_rejected" || (status === "awaiting_latest_confirm" && pickAnother);

  return (
    <div className="flex flex-col gap-5 max-w-[920px] w-full mx-auto">
      <ol className="flex flex-wrap items-center gap-2 text-[12px]" aria-label="Các bước import">
        {STEPS.map((s, i) => (
          <li
            key={s.label}
            aria-current={i === stepIndex ? "step" : undefined}
            className={`px-3 py-1 rounded-full font-bold ${
              i < stepIndex ? "bg-[#E9F7EE] text-[#1F7A45]" : i === stepIndex ? "bg-[#191817] text-white" : "bg-[#F0EEEA] text-[#A8A49C]"
            }`}
          >
            {i + 1}. {s.label}
          </li>
        ))}
      </ol>

      {imp.error && (
        <div role="alert" className="flex items-center gap-3 bg-[#FDEDED] border border-[#F2CACA] text-[#8A4141] px-4 py-3 rounded-[12px] text-[12.5px]">
          <span className="flex-1">{imp.error}</span>
          <button type="button" onClick={imp.clearError} className="font-bold hover:opacity-75" aria-label="Đóng thông báo lỗi">
            ✕
          </button>
        </div>
      )}

      {showUpload && (
        <>
          {status === "preflight_rejected" && doc && <PreflightIssues issues={doc.preflight.issues} fileName={doc.original_name} />}
          <UploadStep
            busy={imp.busy === "upload"}
            onUpload={(file) =>
              void after(imp.upload(file)).then(() => setPickAnother(false))
            }
            title={status === "preflight_rejected" ? "Tải lên file đã sửa" : undefined}
          />
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
        <div className="flex items-center gap-3 text-[13px] text-[#4B4842] bg-white border border-[#ECEAE5] rounded-[14px] p-5">
          <span className="w-5 h-5 rounded-full border-2 border-[#E4E1DC] border-t-[#6A62C4] ff-spinner" />
          Đang tách tài liệu thành block…
          <button type="button" onClick={() => void imp.reload()} className="ml-auto text-[12px] font-bold text-[#6A62C4] underline">
            Tải lại
          </button>
        </div>
      )}

      {status === "mapping_review" && imp.data?.profile && (
        <MappingReviewTable profile={imp.data.profile} busy={imp.busy === "mapping"} onSubmit={(body) => void after(imp.saveMapping(body))} />
      )}

      {status === "extracting" && doc && (
        <ExtractProgress
          doc={doc}
          sections={imp.data?.extraction.sections ?? []}
          running={imp.jobRunning}
          credits={credits}
          busy={imp.busy === "extract" || imp.busy === "resume"}
          onStart={() => void after(imp.extract())}
          onResume={() => void after(imp.resume())}
        />
      )}

      {status === "fields_review" && (
        <FieldsReview fields={imp.data?.extraction.review_fields ?? []} busy={imp.busy === "fields"} onSubmit={(body) => void after(imp.saveFields(body))} />
      )}

      {(status === "baselining" || status === "checking") && doc && (
        <div className="bg-white border border-[#ECEAE5] rounded-[14px] p-5 flex flex-col gap-3">
          <h3 className="font-extrabold text-[#191817] text-[15px]">Tạo baseline 0.0 và kiểm tra</h3>
          <p className="text-[12.5px] text-[#4B4842] leading-relaxed">
            Ghi các field đã xác nhận làm chỉ mục, lưu tài liệu gốc thành version <strong>0.0</strong>, rồi chạy kiểm tra: AI soát ngữ
            nghĩa (cờ vàng, tốn credit) và luật tất định (cờ đỏ/vàng). Kết quả nằm ở gap report.
          </p>
          {doc.paused ? (
            <PausedBanner paused={doc.paused} what="Kiểm tra" busy={imp.busy === "resume"} onResume={() => void after(imp.resume())} />
          ) : (
            <div className="flex justify-end">
              <button
                type="button"
                disabled={imp.busy === "finalize"}
                onClick={() =>
                  void after(imp.finalize()).then((res) => {
                    if (res) router.push(`/projects/${projectId}/gap-report`);
                  })
                }
                className="px-5 py-2.5 rounded-[10px] btn-gradient-primary text-white text-[13px] font-bold disabled:opacity-50 cursor-pointer"
              >
                {imp.busy === "finalize" ? "Đang tạo baseline và kiểm tra…" : "Tạo baseline 0.0"}
              </button>
            </div>
          )}
        </div>
      )}

      {status && IMPORT_DONE_STATUSES.includes(status) && (
        <div className="bg-[#E9F7EE] border border-[#BFE6CE] rounded-[14px] p-5 flex flex-wrap items-center gap-3 text-[13px] text-[#1F7A45]">
          <span className="flex-1">
            Import xong — tài liệu đã thành version 0.0. Bản sửa ngoài FlintFlow tải lên ở tab <strong>Tài liệu &amp; version</strong> để
            xem khác biệt.
          </span>
          <Link href={`/projects/${projectId}/gap-report`} className="px-4 py-2 rounded-[8px] bg-[#1F7A45] text-white font-bold">
            Xem gap report
          </Link>
        </div>
      )}
    </div>
  );
}
