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
import type { ImportStatus } from "@/types/import";
import WorkspaceHeader from "../WorkspaceHeader";
import PreflightIssues from "../mode1/PreflightIssues";
import UploadStep from "../mode1/UploadStep";
import { useErrorText } from "../mode1/i18n";
import { useImport } from "../../hooks/mode1/useImport";
import { useImportSource } from "../../hooks/mode1/useImportSource";
import { useMode1Project } from "../../hooks/mode1/useMode1Project";
import ImportProgress from "./import-progress";
import ReviewConfirm from "./review-confirm";
import StructurePreview, { StructureReading } from "./structure-preview";
import TextSections from "./text-sections";
import SkeletonLanguage from "./skeleton-language";
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
}

/** Đọc xong — trang sắp chuyển sang workspace sửa (bản gốc 0.1) / soạn (phần còn thiếu). */
const FINISHED_STATUSES: readonly ImportStatus[] = ["gap_review", "delivered", "change_requested", "drafting"];

/** Trạng thái chạy nền — hiện tiến trình. */
const RUN_STATUSES: readonly ImportStatus[] = ["extracting", "baselining", "checking"];

/**
 * Upload SRS có sẵn trong **layout workspace** (thay wizard `/import` + `Mode1Shell`): màn đọc khung (trước credit) ⇒ Bắt đầu ⇒
 * tiến trình đọc ⇒ kết cục. File đủ khung ⇒ bản gốc 0.1; giữ khung còn thiếu (chế độ 3) lẫn bổ sung theo mẫu chuẩn còn thiếu
 * (chế độ 4, FLF-416) ⇒ soạn phần thiếu (BE đổi dự án sang luồng soạn) — trang tự chuyển sang workspace khi project đổi. File bị
 * từ chối ⇒ lý do + chọn file khác ngay tại đây.
 */
export default function ImportWorkspace({ projectId, onProjectChanged, pollMs }: ImportWorkspaceProps) {
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
  const [confirmSection, setConfirmSection] = useState<string | null>(null);
  const doc = imp.doc;
  const status = doc?.status ?? null;
  // Chữ gốc của file cho khung tài liệu ở màn đọc: tải một lần khi lượt đọc chạy / đang dừng, không theo poll
  // FLF-453: `reviewing` paused (hết credit / lỗi AI) có màn riêng (nút Tiếp tục rà soát / Dừng) — không rơi vào đây.
  const showingProgress = !!doc && !!status && (RUN_STATUSES.includes(status) || (!!doc.paused && status !== "reviewing"));
  const source = useImportSource(projectId, doc?.id ?? null, showingProgress);
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
          : status === "reviewing"
            ? { label: t("badge.reviewing"), tone: "warning" }
            : { label: t("badge.reading"), tone: "info" };

  const body = (() => {
    if (uploads && srsUpload && srsFailed) {
      return <CreationProgress uploads={uploads} onRetry={(key) => retryProjectUpload(projectId, key)} onChoose={(key, choice) => chooseProjectUploadVersion(projectId, key, choice)} onDismiss={(key) => dismissProjectUpload(projectId, key)} onPickAnother={() => setPickAnother(true)} />;
    }
    if (srsUpload && reading) return <StructureReading fileName={srsUpload.name} />;
    if (imp.loading) return <ImportSkeleton withHeader={false} label={t("loading")} />;
    // Lần tải đầu (dự án tải SRS chưa có file): nói rõ đang ở bước nào và tải xong thì sao (chưa tốn credit) — trước đây chỉ có
    // một ô thả file dính mép trên, người vào lại tưởng workspace hỏng
    if (showUpload && !status) {
      return (
        <section aria-labelledby="import-first-upload" className="min-h-[60vh] flex flex-col justify-center gap-6">
          <div className="flex flex-col gap-2 text-center">
            <h1 id="import-first-upload" className="text-title font-extrabold text-on-surface">
              {t("upload.firstTitle")}
            </h1>
            <p className="text-body text-on-surface-variant leading-relaxed max-w-[520px] mx-auto">{t("upload.firstBody")}</p>
          </div>
          <ol className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-body" aria-label={t("upload.stepsAria")}>
            {(["upload", "structure", "read"] as const).map((step, i) => (
              <li key={step} className={`flex items-center gap-2 ${i === 0 ? "text-on-surface font-bold" : "text-on-surface-muted"}`} aria-current={i === 0 ? "step" : undefined}>
                <span className={`size-6 rounded-full grid place-items-center text-caption font-bold ${i === 0 ? "bg-primary text-on-primary" : "bg-surface-container-high text-on-surface-variant"}`}>{i + 1}</span>
                {t(`upload.steps.${step}`)}
              </li>
            ))}
          </ol>
          <UploadStep
            busy={imp.busy === "upload"}
            title={t("upload.dropTitle")}
            onUpload={(file) => void imp.upload(file).then(() => setPickAnother(false))}
            onGoogleImport={(file) => void imp.uploadFromGoogle(file.id).then(() => setPickAnother(false))}
          />
        </section>
      );
    }
    if (showUpload) {
      return (
        <div className="flex flex-col gap-4">
          {status === "preflight_rejected" && doc && !pickAnother && <PreflightIssues issues={doc.preflight.issues} fileName={doc.original_name} />}
          <UploadStep
            busy={imp.busy === "upload"}
            title={status === "preflight_rejected" ? t("upload.again") : t("upload.title")}
            onUpload={(file) => void imp.upload(file).then(() => setPickAnother(false))}
            onGoogleImport={(file) => void imp.uploadFromGoogle(file.id).then(() => setPickAnother(false))}
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
          foreignProject={doc.foreign_project ?? null}
          playKey={doc.id}
          startBlocked={imp.busy === "drop" || imp.busy === "relabel" || imp.busy === "language"}
          onRelabel={(patch) => void imp.relabel(patch)}
          textSections={<TextSections sections={imp.data?.text_sections ?? []} busy={imp.busy === "drop" || imp.busy === "start"} onChange={(keys) => void imp.setDropText(keys)} />}
          skeletonLanguage={<SkeletonLanguage state={imp.data?.skeleton_language ?? null} busy={imp.busy === "drop" || imp.busy === "language" || imp.busy === "start"} onChange={(language) => void imp.setSkeletonLanguage(language)} />}
        />
      );
    }
    if (doc && status && (RUN_STATUSES.includes(status) || (doc.paused && status !== "reviewing"))) {
      return <ImportProgress doc={doc} sections={imp.data?.extraction.sections ?? []} headings={imp.data?.profile?.heading_map} resolvedMode={structure?.resolved_mode ?? preview?.resolved_mode ?? null} fileKind={preview ? (preview.summary.present === 0 ? "template" : "written") : null} previewSectionIds={preview?.sections.map((x) => x.section_id) ?? null} source={source.sections} creditEstimate={imp.data?.credit_estimate ?? null} busy={imp.busy === "resume"} onResume={() => void imp.resume()} onPause={() => void imp.pause()} pausing={imp.busy === "pause"} />;
    }
    if (status === "fields_review") {
      // FLF-462 (bước 1.6): phần tử I-4 độ tin thấp / đoạn lớp 4 chữ hướng dẫn / mục tên đúng nội dung sai chờ xác nhận
      const reviewFields = imp.data?.extraction.review_fields ?? [];
      const reviewGuidance = imp.data?.extraction.review_guidance ?? [];
      const reviewMismatch = imp.data?.extraction.review_content_mismatch ?? [];
      if (reviewFields.length || reviewGuidance.length || reviewMismatch.length) {
        return (
          <ReviewConfirm
            fields={reviewFields}
            guidance={reviewGuidance}
            contentMismatch={reviewMismatch}
            busy={imp.busy === "confirm" || imp.busy === "resume"}
            onField={(f, confirmed) => void imp.confirmReview({ fields: [{ section_id: f.section_id, path: f.path, confirmed }] })}
            onGuidance={(g, isGuidance) => void imp.confirmReview({ guidance: [{ section_id: g.section_id, block_id: g.block_id, is_guidance: isGuidance }] })}
            onMismatch={(m) => void imp.confirmReview({ content_mismatch: [{ section_id: m.section_id }] })}
            onConfirmAll={() => void imp.confirmReview({ confirm_all: true })}
          />
        );
      }
      // Không có gì cụ thể để liệt kê (bản ghi cũ) ⇒ Tiếp tục = xác nhận tất cả theo gợi ý
      return (
        <div className="flex flex-wrap items-center gap-3 rounded-card bg-surface-container px-4 py-3">
          <p className="flex-1 text-body text-on-surface">{t("legacy.fieldsReview")}</p>
          <Button onClick={() => void imp.confirmReview({ confirm_all: true })} loading={imp.busy === "confirm" || imp.busy === "resume"}>
            {t("legacy.continue")}
          </Button>
        </div>
      );
    }
    if (status === "incomplete") {
      const missing = structure?.missing.length ?? 0;
      // Bản ghi cũ còn thiếu mục (lượt mới BE tự chuyển sang soạn) ⇒ một nút soạn phần còn thiếu. Chế độ 4 (FLF-416): soạn mục
      // còn thiếu so với mẫu chuẩn FlintFlow, bố cục sắp lại theo mẫu chuẩn
      const outcome = structure?.resolved_mode === 4 ? "mode4" : "mode3";
      return (
        <div className="flex flex-col gap-3">
          <h2 className="text-heading font-bold text-on-surface">{t(`outcome.${outcome}.title`, { missing })}</h2>
          {/* Kết quả cuối khác màn đọc khung ⇒ báo luôn ở đây */}
          <StructureChangeNotice projectId={projectId} inline />
          <p className="text-body text-on-surface-variant">{t(`outcome.${outcome}.body`)}</p>
          <Button className="self-start" iconRight="arrow-right" loading={imp.busy === "finalize"} onClick={() => void imp.continueFlow2().then((res) => res && onChanged())}>
            {t(`outcome.${outcome}.draft`)}
          </Button>
        </div>
      );
    }
    if (status === "reviewing") {
      // FLF-453 (business-flow §3.1.2): Code đã rà mọi mục theo luật, không tốn credit — còn mục cần AI rà (đầu vào của
      // phần thiếu, hoặc cờ đỏ). Báo credit trước, người dùng xác nhận mới chạy; phát hiện vào cùng danh sách cờ của
      // workspace khi sang Luồng 2 (không có màn riêng ở đây).
      const review = imp.data?.review ?? null;
      const paused = doc?.paused;
      const optional = review?.optional_sections ?? [];
      return (
        <div className="flex flex-col gap-3">
          <h2 className="text-heading font-bold text-on-surface">{t("reviewExisting.title", { count: review?.section_ids.length ?? 0 })}</h2>
          <p className="text-body text-on-surface-variant">{t("reviewExisting.body")}</p>
          {paused?.reason === "credits" && <p className="text-body text-error">{t("reviewExisting.pausedCredits")}</p>}
          {paused?.reason === "resume_later" && <p className="text-body text-error">{t("reviewExisting.pausedError")}</p>}
          <p className="text-body text-on-surface-variant">
            {review && review.credits > 0 ? t("reviewExisting.credit", { credits: review.credits }) : t("reviewExisting.creditNone")}
          </p>
          <div className="flex items-center gap-3">
            <Button iconRight="arrow-right" loading={imp.busy === "review"} onClick={() => void imp.runReview().then((res) => res && "project_mode" in res && onChanged())}>
              {paused ? t("reviewExisting.resume") : t("reviewExisting.confirm")}
            </Button>
            <Button variant="ghost" loading={imp.busy === "reviewStop"} disabled={imp.busy === "review"} onClick={() => void imp.stopReview()}>
              {t("reviewExisting.stop")}
            </Button>
          </div>
          {optional.length > 0 && (
            <div className="flex flex-col gap-2 pt-2" data-testid="review-optional">
              <h3 className="text-body font-semibold text-on-surface">{t("reviewExisting.optionalTitle")}</h3>
              <p className="text-caption text-on-surface-variant">{t("reviewExisting.optionalBody")}</p>
              <ul className="flex flex-col gap-1">
                {optional.map((o) => (
                  <li key={o.section_id} className="flex items-center justify-between gap-3">
                    <span className="text-body text-on-surface min-w-0 truncate">{o.title}</span>
                    {confirmSection === o.section_id ? (
                      <span className="flex items-center gap-2 shrink-0">
                        <span className="text-caption text-on-surface-variant">{t("reviewExisting.sectionCredit", { credits: o.credits })}</span>
                        <Button
                          variant="secondary"
                          loading={imp.busy === "reviewSection"}
                          onClick={() => void imp.runSectionReview(o.section_id).then(() => setConfirmSection(null))}
                        >
                          {t("reviewExisting.sectionConfirm")}
                        </Button>
                        <Button variant="ghost" disabled={imp.busy === "reviewSection"} onClick={() => setConfirmSection(null)}>
                          {t("reviewExisting.sectionCancel")}
                        </Button>
                      </span>
                    ) : (
                      <Button variant="secondary" disabled={!!imp.busy} onClick={() => setConfirmSection(o.section_id)}>
                        {t("reviewExisting.sectionRun")}
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      );
    }
    // Xong (bản gốc 0.1 / sang soạn phần thiếu): trang đang đọc lại project để chuyển workspace
    return <ImportSkeleton withHeader={false} label={t("opening")} />;
  })();

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-surface-container-lowest">
      {/* Chưa có file ⇒ không có gì để Xem & comment / Export */}
      <WorkspaceHeader project={project} user={user} fallbackName={uploads?.projectName} baselineStatus={badge} documentActions={!(showUpload && !status)} onLogout={() => void logoutAndRedirect()} />
      <main className="flex-1 min-h-0 overflow-y-auto ff-scroll">
        {/* Đang tải lần import / đang đọc khung / màn đọc khung: cột rộng như skeleton của trang (không bóp hẹp rồi nới ra) */}
        <div className={`${imp.awaitingStart || reading || imp.loading || showingProgress ? "max-w-[1180px]" : "max-w-[760px]"} mx-auto w-full px-4 sm:px-6 py-8 flex flex-col gap-4`}>
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
