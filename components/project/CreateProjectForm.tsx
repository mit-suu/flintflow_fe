"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import Button from "@/components/ui/Button";
import Icon from "@/components/ui/Icon";
import { createProjectFrom } from "@/lib/api/projects";
import { precheckDocx } from "@/lib/api/documents";
import { markImportPending } from "@/lib/import-pending";
import { startProjectUploads } from "@/lib/project-uploads";
import { DEFAULT_LOCALE, isLocale } from "@/lib/i18n";
import type { DocumentLanguage, Project } from "@/types/project";
import type { OrgTemplateSummary } from "@/types/org-library";
import DocumentLanguagePicker from "./DocumentLanguagePicker";
import OrgTemplatePicker from "./OrgTemplatePicker";
import { splitDuplicateFiles } from "@/lib/file-fingerprint";
import { ReferenceSlot, SrsSlot, REFERENCE_MAX_BYTES, SRS_MAX_BYTES, isDocx, isReferenceType, type ReferenceFile } from "./create-project-file-slots";
import { userErrorMessage } from "@/lib/api/error-messages";

const NAME_MAX = 100; // khớp CreateProjectSchema ở BE

interface CreateProjectFormProps {
  /** `inline`: nằm trên dashboard khi chưa có dự án; `dialog`: trong dialog "+ Dự án mới". */
  variant: "inline" | "dialog";
  onCreated: (project: Project) => void | Promise<void>;
  onCancel?: () => void;
  /** Đang ở trong một thư mục ⇒ dự án tạo thẳng trong đó. */
  folderId?: string;
}

type Stage = "creating";

let refSeq = 0;

/**
 * Tạo dự án (UC-13/14, business-flow §1): tên + ô **SRS** (0–1 .docx, hoặc mẫu đã lưu của tổ chức) + ô chọn "Bổ sung các mục còn
 * thiếu theo mẫu chuẩn FlintFlow" + ô **Tài liệu tham khảo**. Người dùng không chọn chế độ, không khai dự án mới / có sẵn — BE
 * suy ra. Ngôn ngữ chỉ hỏi khi không có SRS (có SRS ⇒ theo file). Tạo xong mở dự án ngay; SRS và tài liệu tham khảo tải nền
 * (`lib/project-uploads`), trang dự án hiện từng bước và báo lỗi tải.
 */
export default function CreateProjectForm({ variant, onCreated, onCancel, folderId }: CreateProjectFormProps) {
  const t = useTranslations("app.createProject");
  const tc = useTranslations("app.common");
  const locale = useLocale();
  const defaultName = t("defaultName");
  const [name, setName] = useState(defaultName);
  const [srsFile, setSrsFile] = useState<File | null>(null);
  const [orgTemplate, setOrgTemplate] = useState<OrgTemplateSummary | null>(null);
  const [completeToStandard, setCompleteToStandard] = useState(false);
  const [references, setReferences] = useState<ReferenceFile[]>([]);
  // FLF-265 (D2): mặc định theo ngôn ngữ giao diện — user đang đọc tiếng gì thì tài liệu viết tiếng đó
  const [documentLanguage, setDocumentLanguage] = useState<DocumentLanguage>(isLocale(locale) ? locale : DEFAULT_LOCALE);
  const [stage, setStage] = useState<Stage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [srsError, setSrsError] = useState<string | null>(null);
  const [refError, setRefError] = useState<string | null>(null);
  // FLF-398: đang đọc file tham khảo vừa chọn (so trùng) ⇒ khoá Bắt đầu, file chưa vào danh sách thì không bị bỏ sót
  const [checkingRefs, setCheckingRefs] = useState(0);
  const inputId = `project-name-${variant}`;
  const languageLabelId = `document-language-${variant}`;
  const submitting = stage !== null;
  const hasSrs = !!srsFile || !!orgTemplate;
  const canSubmit = name.trim().length > 0 && !submitting && checkingRefs === 0;

  const pickSrs = (file: File | null) => {
    setSrsError(null);
    if (file && !isDocx(file)) return setSrsError(t("srs.notDocx"));
    if (file && file.size > SRS_MAX_BYTES) return setSrsError(t("srs.tooLarge"));
    setSrsFile(file);
    if (file) setOrgTemplate(null);
    if (!file) setCompleteToStandard(false);
  };

  const addReferences = async (files: File[]) => {
    setRefError(null);
    const rejected = files.filter((f) => !isReferenceType(f) || f.size > REFERENCE_MAX_BYTES);
    // FLF-398: file trùng nội dung với file đã có trong danh sách (kể cả đổi tên) hoặc trùng nhau trong lượt chọn ⇒ không thêm
    const known = new Set(references.flatMap((r) => (r.fingerprint ? [r.fingerprint] : [])));
    setCheckingRefs((n) => n + 1);
    const { kept, duplicates } = await splitDuplicateFiles(files.filter((f) => !rejected.includes(f)), known).finally(() => setCheckingRefs((n) => n - 1));
    const errors = [
      ...(rejected.length ? [t("references.rejected", { files: rejected.map((f) => f.name).join(", ") })] : []),
      ...(duplicates.length ? [t("references.duplicate", { files: duplicates.map((f) => f.name).join(", ") })] : []),
    ];
    if (errors.length) setRefError(errors.join(" "));
    const added: ReferenceFile[] = kept.map(({ file, fingerprint }) => ({ key: `ref-${++refSeq}`, file, fingerprint, ...(isDocx(file) ? {} : { precheck: null }) }));
    if (!added.length) return;
    setReferences((prev) => [...prev, ...added]);
    // §3.6: file .docx trông như SRS ⇒ gợi ý (không chặn). Kiểm lỗi ⇒ coi như không phải SRS
    for (const ref of added.filter((r) => isDocx(r.file))) {
      precheckDocx(ref.file)
        .then((res) => res.data ?? null)
        .catch(() => null)
        .then((precheck) => setReferences((prev) => prev.map((r) => (r.key === ref.key ? { ...r, precheck } : r))));
    }
  };

  const moveToSrs = (key: string) => {
    const ref = references.find((r) => r.key === key);
    if (!ref) return;
    setReferences((prev) => prev.filter((r) => r.key !== key));
    pickSrs(ref.file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setStage("creating");
    setError(null);
    let project: Project;
    try {
      const res = await createProjectFrom({
        name: name.trim(),
        has_srs_file: hasSrs,
        ...(hasSrs && completeToStandard ? { complete_to_standard: true } : {}),
        ...(folderId ? { folderId } : {}),
        // Có SRS: ngôn ngữ theo file (D3) ⇒ không gửi
        ...(hasSrs ? {} : { documentLanguage }),
      });
      if (!res.data) throw new Error(t("missingProject"));
      project = res.data;
    } catch (err) {
      setError(userErrorMessage(err, t("failed")));
      setStage(null);
      return;
    }

    // Không bắt chờ trong hộp thoại: file tải nền, trang dự án hiện các bước tích dần (lỗi tải ⇒ báo + thử lại ở đó)
    if (hasSrs) markImportPending(project._id);
    startProjectUploads(project._id, { projectName: project.name, srs: srsFile, orgTemplate: orgTemplate ? { id: orgTemplate.id, name: orgTemplate.name } : null, references: references.map((r) => r.file) });
    // Giữ trạng thái gửi cho tới khi chuyển trang, tránh bấm tạo hai lần
    await onCreated(project);
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      {/* Tên dự án + ngôn ngữ cùng một hàng; có SRS ⇒ ngôn ngữ theo file nên ô ngôn ngữ ẩn, tên chiếm cả hàng */}
      <div className={`grid gap-4 ${hasSrs ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-[minmax(0,1fr)_auto]"}`}>
        <div className="flex flex-col gap-1.5 min-w-0">
          <label htmlFor={inputId} className="text-caption font-bold uppercase tracking-wide text-on-surface-muted">
            {t("nameLabel")}
          </label>
          <input
            id={inputId}
            type="text"
            value={name}
            maxLength={NAME_MAX}
            disabled={submitting}
            onChange={(e) => setName(e.target.value)}
            onFocus={(e) => {
              if (name === defaultName) e.target.select();
            }}
            // Không viền; focus ⇒ nền trắng + vòng tím
            className="h-12 px-4 rounded-control bg-surface-container text-heading font-semibold text-on-surface outline-none transition-colors hover:bg-surface-container-high focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary/30"
          />
        </div>
        {!hasSrs && (
          <div className="flex flex-col gap-1.5">
            <span id={languageLabelId} className="text-caption font-bold uppercase tracking-wide text-on-surface-muted">
              {t("language.label")}
            </span>
            <div className="h-12 flex items-center">
              <DocumentLanguagePicker value={documentLanguage} onChange={setDocumentLanguage} disabled={submitting} labelledBy={languageLabelId} />
            </div>
          </div>
        )}
      </div>

      {/* Hai ô file cạnh nhau: SRS (file FlintFlow sửa) nền tím nhạt, tham khảo nền xám — khác vai trò nhìn là thấy */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-stretch">
      <SrsSlot
        file={srsFile}
        orgTemplateName={orgTemplate?.name ?? null}
        completeToStandard={completeToStandard}
        disabled={submitting}
        onFile={pickSrs}
        onClearOrgTemplate={() => {
          setOrgTemplate(null);
          setCompleteToStandard(false);
        }}
        onCompleteToStandardChange={setCompleteToStandard}
        orgTemplatePicker={<OrgTemplatePicker disabled={submitting} onPick={(tpl) => {
          setOrgTemplate(tpl);
          setSrsFile(null);
          setSrsError(null);
        }} />}
        error={srsError}
      />

      <ReferenceSlot
        files={references}
        hasSrs={hasSrs}
        disabled={submitting}
        onAdd={addReferences}
        onRemove={(key) => setReferences((prev) => prev.filter((r) => r.key !== key))}
        onKeep={(key) => setReferences((prev) => prev.map((r) => (r.key === key ? { ...r, keep: true } : r)))}
        onMoveToSrs={moveToSrs}
        error={refError}
      />
      </div>

      {error && (
        <p role="alert" className="text-body text-on-error-container bg-error-container rounded-control px-3 py-2">
          {error}
        </p>
      )}

      <div className={`flex flex-wrap items-center gap-x-2 gap-y-3 pt-1 ${variant === "dialog" ? "justify-end" : ""}`}>
        {/* Bấm Bắt đầu thì chuyện gì xảy ra — theo có SRS hay không (BE suy ra chế độ, người dùng không phải chọn) */}
        <p className="mr-auto flex items-center gap-2 text-caption text-on-surface-variant" aria-live="polite">
          {submitting && <Icon name="spinner" size={14} className="shrink-0 text-primary animate-spin" />}
          {submitting ? t(`stage.${stage}`) : hasSrs ? t("outcome.withSrs") : t("outcome.noSrs")}
        </p>
        {onCancel && (
          <Button variant="ghost" onClick={onCancel} disabled={submitting}>
            {tc("cancel")}
          </Button>
        )}
        <Button type="submit" disabled={!canSubmit} loading={submitting} iconRight="arrow-right">
          {submitting ? t("submitting") : t("submit")}
        </Button>
      </div>
    </form>
  );
}
