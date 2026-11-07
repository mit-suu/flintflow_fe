"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import Button from "@/components/ui/Button";
import { createProjectFrom } from "@/lib/api/projects";
import { precheckDocx, uploadProjectDocument } from "@/lib/api/documents";
import { uploadImport } from "@/lib/api/import";
import { importFromOrgTemplate } from "@/lib/api/org-library";
import { DEFAULT_LOCALE, isLocale } from "@/lib/i18n";
import type { DocumentLanguage, Project } from "@/types/project";
import type { OrgTemplateSummary } from "@/types/org-library";
import DocumentLanguagePicker from "./DocumentLanguagePicker";
import OrgTemplatePicker from "./OrgTemplatePicker";
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

type Stage = "creating" | "srs" | "references";

let refSeq = 0;

/**
 * Tạo dự án (UC-13/14, business-flow §1): tên + ô **SRS** (0–1 .docx, hoặc mẫu đã lưu của tổ chức) + ô chọn "Bổ sung các mục còn
 * thiếu theo mẫu chuẩn FlintFlow" + ô **Tài liệu tham khảo**. Người dùng không chọn chế độ, không khai dự án mới / có sẵn — BE
 * suy ra. Ngôn ngữ chỉ hỏi khi không có SRS (có SRS ⇒ theo file). Sau khi tạo: tải SRS (lỗi preflight vẫn vào dự án — màn đọc
 * khung hiện lý do), tải từng tài liệu tham khảo (lỗi chỉ báo, không chặn), rồi mở dự án.
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
  /** Dự án đã tạo nhưng có tài liệu tham khảo tải lỗi — báo rồi để người dùng tự mở dự án. */
  const [createdWithIssues, setCreatedWithIssues] = useState<Project | null>(null);
  const inputId = `project-name-${variant}`;
  const languageLabelId = `document-language-${variant}`;
  const submitting = stage !== null;
  const hasSrs = !!srsFile || !!orgTemplate;
  const canSubmit = name.trim().length > 0 && !submitting && !createdWithIssues;

  const pickSrs = (file: File | null) => {
    setSrsError(null);
    if (file && !isDocx(file)) return setSrsError(t("srs.notDocx"));
    if (file && file.size > SRS_MAX_BYTES) return setSrsError(t("srs.tooLarge"));
    setSrsFile(file);
    if (file) setOrgTemplate(null);
    if (!file) setCompleteToStandard(false);
  };

  const addReferences = (files: File[]) => {
    setRefError(null);
    const rejected = files.filter((f) => !isReferenceType(f) || f.size > REFERENCE_MAX_BYTES);
    if (rejected.length) setRefError(t("references.rejected", { files: rejected.map((f) => f.name).join(", ") }));
    const added = files.filter((f) => !rejected.includes(f)).map((file) => ({ key: `ref-${++refSeq}`, file, ...(isDocx(file) ? {} : { precheck: null }) }));
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

    const projectId = project._id;
    if (hasSrs) {
      setStage("srs");
      // File bị preflight từ chối / lỗi mạng: dự án vẫn có, màn đọc khung hiện lý do + ô chọn file khác
      await (srsFile ? uploadImport(projectId, srsFile) : importFromOrgTemplate(projectId, orgTemplate!.id)).catch(() => null);
    }
    const failed: string[] = [];
    if (references.length) {
      setStage("references");
      for (const ref of references) {
        await uploadProjectDocument(projectId, ref.file).catch(() => failed.push(ref.file.name));
      }
    }
    if (failed.length) {
      setError(t("references.uploadFailed", { files: failed.join(", ") }));
      setCreatedWithIssues(project);
      setStage(null);
      return;
    }
    // Thành công: giữ trạng thái gửi cho tới khi chuyển trang, tránh bấm tạo hai lần
    await onCreated(project);
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <label htmlFor={inputId} className="text-body font-bold text-on-surface-medium">
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
          // Không viền, cùng nền với ô thả file; focus ⇒ nền trắng + vòng tím
          className="h-10 px-3.5 rounded-control bg-surface-container text-body text-on-surface outline-none transition-colors hover:bg-surface-container-high focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary/30"
        />
      </div>

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

      {!hasSrs && (
        <div className="flex flex-col gap-1.5">
          <span id={languageLabelId} className="text-body font-bold text-on-surface-medium">
            {t("language.label")}
          </span>
          <DocumentLanguagePicker value={documentLanguage} onChange={setDocumentLanguage} disabled={submitting} labelledBy={languageLabelId} />
        </div>
      )}

      {error && (
        <p role="alert" className="text-body text-on-error-container bg-error-container rounded-control px-3 py-2">
          {error}
        </p>
      )}

      <div className={`flex items-center gap-2 ${variant === "dialog" ? "justify-end" : ""}`}>
        {submitting && (
          <p className="mr-auto text-body text-on-surface-muted" aria-live="polite">
            {t(`stage.${stage}`)}
          </p>
        )}
        {createdWithIssues ? (
          <Button type="button" iconRight="arrow-right" onClick={() => void onCreated(createdWithIssues)}>
            {t("openProject")}
          </Button>
        ) : (
          <>
            {onCancel && (
              <Button variant="ghost" onClick={onCancel} disabled={submitting}>
                {tc("cancel")}
              </Button>
            )}
            <Button type="submit" disabled={!canSubmit} loading={submitting} iconRight="arrow-right">
              {submitting ? t("submitting") : t("submit")}
            </Button>
          </>
        )}
      </div>
    </form>
  );
}
