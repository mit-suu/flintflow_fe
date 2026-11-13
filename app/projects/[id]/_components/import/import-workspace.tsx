"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import Button from "@/components/ui/Button";
import Icon from "@/components/ui/Icon";
import type { BadgeTone } from "@/components/ui/Badge";
import { logoutAndRedirect } from "@/lib/auth";
import { downloadWordExport } from "@/lib/api/export";
import { saveBlob } from "@/lib/api/files";
import { downloadGapReport } from "@/lib/api/import";
import { fetchMe } from "@/lib/api/users";
import type { User } from "@/types/user";
import type { OrgRole } from "@/types/organization";
import type { ImportStatus } from "@/types/import";
import WorkspaceHeader from "../WorkspaceHeader";
import PreflightIssues from "../mode1/PreflightIssues";
import SaveOrgTemplateCard from "../mode1/SaveOrgTemplateCard";
import UploadStep from "../mode1/UploadStep";
import { useErrorText } from "../mode1/i18n";
import { useImport } from "../../hooks/mode1/useImport";
import { useMode1Project } from "../../hooks/mode1/useMode1Project";
import ImportProgress from "./import-progress";
import StructurePreview, { StructureReading } from "./structure-preview";
import TextSections from "./text-sections";
import StructureChangeNotice from "../mode1/structure-change-notice";
import CreationProgress from "./creation-progress";
import ImportSkeleton from "./import-skeleton";
import ReferenceUploadsNote from "./reference-uploads-note";
import { markImportPending } from "@/lib/import-pending";
import { chooseProjectUploadVersion, dismissProjectUpload, retryProjectUpload, useProjectUploads } from "@/lib/project-uploads";

interface ImportWorkspaceProps {
  projectId: string;
  /** Trạng thái import đổi (job nền / hành động) ⇒ trang đọc lại project: xong thì sang workspace soạn / sửa. */
  onProjectChanged: () => void;
  /** Nhịp poll — test đặt nhỏ. */
  pollMs?: number;
  /** Vai trò trong tổ chức: chỉ Lead lưu được mẫu lên thư viện. */
  orgRole?: OrgRole | null;
}

/** Đọc xong — trang sắp chuyển sang workspace sửa (bản gốc 0.1) / soạn (phần còn thiếu). */
const FINISHED_STATUSES: readonly ImportStatus[] = ["gap_review", "delivered", "change_requested", "drafting"];

/** Trạng thái chạy nền — hiện tiến trình. */
const RUN_STATUSES: readonly ImportStatus[] = ["extracting", "baselining", "checking"];

/**
 * Upload SRS có sẵn trong **layout workspace** (thay wizard `/import` + `Mode1Shell`): màn đọc khung (trước credit) ⇒ Bắt đầu ⇒
 * tiến trình đọc ⇒ kết cục. File đủ khung ⇒ bản gốc 0.1, giữ khung còn thiếu ⇒ soạn phần thiếu (BE đổi dự án sang luồng soạn) —
 * cả hai trang tự chuyển sang workspace khi project đổi. Bổ sung theo mẫu chuẩn còn thiếu ⇒ thông báo + tải DRAFT / báo cáo
 * thiếu sót. File bị từ chối ⇒ lý do + chọn file khác ngay tại đây.
 */
export default function ImportWorkspace({ projectId, onProjectChanged, pollMs, orgRole }: ImportWorkspaceProps) {
  const t = useTranslations("workspace.import");
  const { project, credits, reload: reloadProject } = useMode1Project(projectId);
  const onChanged = useCallback(() => {
    void reloadProject();
    onProjectChanged();
  }, [reloadProject, onProjectChanged]);
  const errText = useErrorText();
  const imp = useImport(projectId, pollMs ? { pollMs } : undefined);
  const [user, setUser] = useState<User | null>(null);
  const [pickAnother, setPickAnother] = useState(false);
  const [downloading, setDownloading] = useState<"gap" | "draft" | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const doc = imp.doc;
  const status = doc?.status ?? null;
  // File từ hộp Tạo dự án đang tải nền ⇒ hiện các bước tích dần; SRS tải xong ⇒ đọc lại lần import để mở màn đọc khung
  const uploads = useProjectUploads(projectId);
  const srsUpload = uploads?.items.find((i) => i.kind === "srs") ?? null;
  const srsStatus = srsUpload?.status ?? null;
  const reloadAfterUpload = imp.reload;
  useEffect(() => {
    if (srsStatus === "done") void reloadAfterUpload();
  }, [srsStatus, reloadAfterUpload]);
  // Lần mở trang sau (khi vẫn còn ở màn đọc file) hiện ngay skeleton của màn này
  useEffect(() => markImportPending(projectId), [projectId]);

  useEffect(() => {
    let cancelled = false;
    fetchMe()
      .then((me) => !cancelled && setUser(me))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  // Trạng thái import đổi do job nền (poll) ⇒ báo trang đọc lại project (xong ⇒ sang workspace)
  const seenStatus = useRef<ImportStatus | null>(null);
  useEffect(() => {
    if (!status || seenStatus.current === status) return;
    const first = seenStatus.current === null;
    seenStatus.current = status;
    if (!first) onChanged();
  }, [status, onChanged]);

  // BE ghi trạng thái import trước, `Project.import_state` sau: đọc project giữa hai lần ghi thì trang chưa chuyển sang workspace ⇒
  // thử lại tới khi chuyển (component này gỡ khỏi trang). Đang tách file ⇒ đọc lại import (job nền không poll ở trạng thái này)
  const reloadImport = imp.reload;
  const finished = !!status && (FINISHED_STATUSES.includes(status) || status === "uploaded" || status === "parsing");
  useEffect(() => {
    if (!finished) return;
    const timer = setInterval(() => {
      if (status === "uploaded" || status === "parsing") void reloadImport();
      else onChanged();
    }, 2500);
    return () => clearInterval(timer);
  }, [finished, status, reloadImport, onChanged]);

  const download = async (kind: "gap" | "draft") => {
    setDownloading(kind);
    setDownloadError(null);
    try {
      const { blob, filename } = kind === "gap" ? await downloadGapReport(projectId) : await downloadWordExport(projectId, "draft");
      saveBlob(blob, filename ?? (kind === "gap" ? "GapReport.docx" : "SRS_DRAFT.docx"));
    } catch (err) {
      setDownloadError(errText(err));
    } finally {
      setDownloading(null);
    }
  };

  const showUpload = !doc || status === "preflight_rejected" || pickAnother;
  // SRS từ hộp Tạo dự án: đang tải, hoặc tải xong mà chưa đọc lại được lần import (BE đang đọc khung) ⇒ hiện ngay bố cục màn đọc
  // khung (trang đang quét, các ô ở 0) thay vì danh sách bước / ô tải file chớp qua; lỗi tải ⇒ màn bước có Thử lại
  const srsFailed = srsUpload?.status === "failed" && !doc && !pickAnother;
  const reading =
    !!srsUpload && !pickAnother && (srsUpload.status === "uploading" || (srsUpload.status === "done" && (!doc || status === "uploaded" || status === "parsing")));
  const preview = imp.data?.structure_preview ?? null;
  const structure = imp.data?.target_structure ?? null;
  // Đang đọc khung (SRS vừa tải, BE chưa trả lần import) ⇒ badge hiện ngay, không chờ trạng thái import về
  const badge: { label: string; tone: BadgeTone } | null = reading
    ? { label: t("badge.reading"), tone: "info" }
    : !status
    ? null
    : showUpload
      ? status === "preflight_rejected" && !pickAnother
        ? { label: t("badge.rejected"), tone: "danger" }
        : { label: t("badge.upload"), tone: "neutral" }
      : imp.awaitingStart
        ? { label: t("badge.ready"), tone: "info" }
        : status === "incomplete"
          ? { label: t("badge.incomplete"), tone: "warning" }
          : { label: t("badge.reading"), tone: "info" };

  const body = (() => {
    if (uploads && srsUpload && srsFailed) {
      return <CreationProgress uploads={uploads} onRetry={(key) => retryProjectUpload(projectId, key)} onChoose={(key, choice) => chooseProjectUploadVersion(projectId, key, choice)} onDismiss={(key) => dismissProjectUpload(projectId, key)} onPickAnother={() => setPickAnother(true)} />;
    }
    if (srsUpload && reading) return <StructureReading fileName={srsUpload.name} />;
    if (imp.loading) return <ImportSkeleton withHeader={false} label={t("loading")} />;
    if (showUpload) {
      return (
        <div className="flex flex-col gap-4">
          {status === "preflight_rejected" && doc && !pickAnother && <PreflightIssues issues={doc.preflight.issues} fileName={doc.original_name} />}
          <UploadStep
            busy={imp.busy === "upload"}
            title={status === "preflight_rejected" ? t("upload.again") : t("upload.title")}
            onUpload={(file) => void imp.upload(file).then(() => setPickAnother(false))}
          />
          {pickAnother && (
            <Button variant="ghost" className="self-start" onClick={() => setPickAnother(false)}>
              {t("upload.cancel")}
            </Button>
          )}
        </div>
      );
    }
    if (status === "uploaded" || status === "parsing") {
      return (
        <p role="status" className="flex items-center gap-3 text-body text-on-surface-variant">
          <Icon name="spinner" size={18} className="text-primary animate-spin" />
          {t("parsing")}
        </p>
      );
    }
    if (imp.awaitingStart && doc) {
      return (
        <StructurePreview
          fileName={doc.original_name}
          preview={preview}
          estimate={imp.data?.credit_estimate ?? null}
          credits={credits}
          busy={imp.busy === "start"}
          downloading={downloading === "gap"}
          onStart={() => void imp.start(true)}
          onDownloadGapReport={() => void download("gap")}
          onPickAnother={() => setPickAnother(true)}
          unsureKind={doc.preflight.document_kind?.kind === "unknown"}
          playKey={doc.id}
          startBlocked={imp.busy === "drop"}
          textSections={<TextSections sections={imp.data?.text_sections ?? []} busy={imp.busy === "drop" || imp.busy === "start"} onChange={(keys) => void imp.setDropText(keys)} />}
          footer={project?.template_intent === "fixed" && orgRole === "lead" ? <SaveOrgTemplateCard projectId={projectId} defaultName={doc.original_name.replace(/\.docx$/i, "")} /> : null}
        />
      );
    }
    if (doc && status && (RUN_STATUSES.includes(status) || doc.paused)) {
      return <ImportProgress doc={doc} sections={imp.data?.extraction.sections ?? []} headings={imp.data?.profile?.heading_map} resolvedMode={structure?.resolved_mode ?? preview?.resolved_mode ?? null} fileKind={preview?.summary.kind ?? null} previewSectionIds={preview?.sections.map((x) => x.section_id) ?? null} busy={imp.busy === "resume"} onResume={() => void imp.resume()} onPause={() => void imp.pause()} pausing={imp.busy === "pause"} />;
    }
    if (status === "fields_review") {
      // Bản ghi cũ (trước khi đọc chạy một mạch) dừng ở bước xác nhận ⇒ Tiếp tục = đọc nốt một mạch
      return (
        <div className="flex flex-wrap items-center gap-3 rounded-card bg-surface-container px-4 py-3">
          <p className="flex-1 text-body text-on-surface">{t("legacy.fieldsReview")}</p>
          <Button onClick={() => void imp.resume()} loading={imp.busy === "resume"}>
            {t("legacy.continue")}
          </Button>
        </div>
      );
    }
    if (status === "incomplete") {
      const missing = structure?.missing.length ?? 0;
      // Bản ghi cũ giữ khung còn thiếu (lượt mới BE tự chuyển sang soạn) ⇒ một nút soạn phần còn thiếu
      if (structure?.resolved_mode === 3) {
        return (
          <div className="flex flex-col gap-3">
            <h2 className="text-heading font-bold text-on-surface">{t("outcome.mode3.title", { missing })}</h2>
            <p className="text-body text-on-surface-variant">{t("outcome.mode3.body")}</p>
            <Button className="self-start" iconRight="arrow-right" loading={imp.busy === "finalize"} onClick={() => void imp.continueFlow2().then((res) => res && onChanged())}>
              {t("outcome.mode3.draft")}
            </Button>
          </div>
        );
      }
      return (
        <div className="flex flex-col gap-3">
          <h2 className="text-heading font-bold text-on-surface">{t("outcome.mode4.title", { missing })}</h2>
          {/* Kết quả cuối khác màn đọc khung ⇒ báo luôn ở đây (không vào workspace soạn) */}
          <StructureChangeNotice projectId={projectId} inline />
          <p className="text-body text-on-surface-variant">{t("outcome.mode4.body")}</p>
          <div className="flex flex-wrap gap-2">
            <Button icon="export" loading={downloading === "draft"} onClick={() => void download("draft")}>
              {t("outcome.mode4.draft")}
            </Button>
            <Button variant="secondary" icon="export" loading={downloading === "gap"} onClick={() => void download("gap")}>
              {t("outcome.mode4.gapReport")}
            </Button>
          </div>
        </div>
      );
    }
    // Xong (bản gốc 0.1 / sang soạn phần thiếu): trang đang đọc lại project để chuyển workspace
    return <ImportSkeleton withHeader={false} label={t("opening")} />;
  })();

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-surface-container-lowest">
      <WorkspaceHeader project={project} user={user} fallbackName={uploads?.projectName} baselineStatus={badge} onLogout={() => void logoutAndRedirect()} />
      <main className="flex-1 min-h-0 overflow-y-auto ff-scroll">
        {/* Đang tải lần import / đang đọc khung / màn đọc khung: cột rộng như skeleton của trang (không bóp hẹp rồi nới ra) */}
        <div className={`${imp.awaitingStart || reading || imp.loading || (!!doc && !!status && (RUN_STATUSES.includes(status) || !!doc.paused)) ? "max-w-[1180px]" : "max-w-[760px]"} mx-auto w-full px-4 sm:px-6 py-8 flex flex-col gap-4`}>
          {(imp.error || downloadError) && (
            <div role="alert" className="flex items-center gap-3 rounded-control bg-error-container text-on-error-container px-4 py-3 text-body">
              <span className="flex-1">{imp.error ?? downloadError}</span>
              <button
                type="button"
                onClick={() => {
                  imp.clearError();
                  setDownloadError(null);
                }}
                aria-label={t("closeError")}
                className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-error-container/70 cursor-pointer"
              >
                <Icon name="close" size={14} />
              </button>
            </div>
          )}
          {/* Tài liệu tham khảo còn đang tải nền / lỗi — khi màn tiến trình đã nhường chỗ cho màn đọc khung */}
          {!srsFailed && <ReferenceUploadsNote projectId={projectId} />}
          {body}
        </div>
      </main>
    </div>
  );
}
