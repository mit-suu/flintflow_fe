"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import Button from "@/components/ui/Button";
import { createProjectFrom } from "@/lib/api/projects";
import { DEFAULT_LOCALE, isLocale } from "@/lib/i18n";
import type { DocumentLanguage, Project, ProjectStartKind } from "@/types/project";
import DocumentLanguagePicker from "./DocumentLanguagePicker";
import ProjectStartPicker from "./ProjectStartPicker";
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

/**
 * Tạo dự án (UC-13/14, FLF-335): chọn **Dự án mới** (hỏi thêm có mẫu bắt buộc không) hay **Dự án có sẵn**; không chọn chế độ —
 * BE suy ra. Một component cho cả empty state và dialog. Lỗi hiện ngay dưới form và giữ nguyên lựa chọn để user thử lại.
 */
export default function CreateProjectForm({ variant, onCreated, onCancel, folderId }: CreateProjectFormProps) {
  const t = useTranslations("app.createProject");
  const tc = useTranslations("app.common");
  const locale = useLocale();
  const defaultName = t("defaultName");
  const [source, setSource] = useState<ProjectStartKind | null>(null);
  const [hasRequiredTemplate, setHasRequiredTemplate] = useState<boolean | null>(null);
  const [name, setName] = useState(defaultName);
  // FLF-265 (D2): mặc định theo ngôn ngữ giao diện — user đang đọc tiếng gì thì tài liệu viết tiếng đó
  const [documentLanguage, setDocumentLanguage] = useState<DocumentLanguage>(isLocale(locale) ? locale : DEFAULT_LOCALE);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputId = `project-name-${variant}`;
  const languageLabelId = `document-language-${variant}`;

  /** Dự án mới không mẫu soạn theo mẫu chuẩn FlintFlow ⇒ chọn ngôn ngữ; mọi trường hợp tải file lên theo file. */
  const uploadsFile = source === "existing" || (source === "new" && hasRequiredTemplate === true);
  const answered = source === "existing" || (source === "new" && hasRequiredTemplate !== null);
  const canSubmit = answered && name.trim().length > 0 && !submitting;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!source || !answered || !name.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await createProjectFrom({
        name: name.trim(),
        source,
        ...(source === "new" ? { has_required_template: hasRequiredTemplate === true } : {}),
        ...(folderId ? { folderId } : {}),
        // Tải file lên: ngôn ngữ theo file (D3) ⇒ không gửi
        ...(uploadsFile ? {} : { documentLanguage }),
      });
      if (!res.data) throw new Error(t("missingProject"));
      await onCreated(res.data);
    } catch (err) {
      setError(userErrorMessage(err, t("failed")));
      setSubmitting(false);
    }
    // Thành công: giữ trạng thái gửi cho tới khi chuyển trang, tránh bấm tạo hai lần
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <ProjectStartPicker value={source} onChange={setSource} hasRequiredTemplate={hasRequiredTemplate} onHasRequiredTemplateChange={setHasRequiredTemplate} disabled={submitting} />

      {uploadsFile ? (
        <p className="text-body text-on-surface-muted -mt-1">{t("language.importHint")}</p>
      ) : (
        <div className="flex flex-col gap-1.5">
          <span id={languageLabelId} className="text-body font-bold text-on-surface-medium">
            {t("language.label")}
          </span>
          <DocumentLanguagePicker value={documentLanguage} onChange={setDocumentLanguage} disabled={submitting} labelledBy={languageLabelId} />
        </div>
      )}

      <div className={`flex flex-col gap-3 ${variant === "inline" ? "sm:flex-row sm:items-end" : ""}`}>
        <div className="flex flex-col gap-1.5 flex-1">
          <label htmlFor={inputId} className="text-body font-bold text-on-surface-medium">
            {t("nameLabel")}
          </label>
          <input
            id={inputId}
            type="text"
            value={name}
            maxLength={NAME_MAX}
            onChange={(e) => setName(e.target.value)}
            onFocus={(e) => {
              if (name === defaultName) e.target.select();
            }}
            // Không viền, cùng nền với thẻ chọn; focus ⇒ nền trắng + vòng tím
            className="h-10 px-3.5 rounded-control bg-surface-container text-body text-on-surface outline-none transition-colors hover:bg-surface-container-high focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary/30"
          />
        </div>
        <div className={`flex items-center gap-2 ${variant === "dialog" ? "justify-end" : ""}`}>
          {/* Gợi ý nằm cạnh nút đang mờ — giải thích vì sao chưa bấm được, không thêm một dòng riêng ở đáy */}
          {!answered && variant === "dialog" && (
            <p className="mr-auto text-body text-on-surface-muted">{t(source === "new" ? "answerTemplate" : "pickMode")}</p>
          )}
          {onCancel && (
            <Button variant="ghost" onClick={onCancel} disabled={submitting}>
              {tc("cancel")}
            </Button>
          )}
          <Button type="submit" disabled={!canSubmit} loading={submitting} iconRight="arrow-right">
            {submitting ? t("submitting") : t("submit")}
          </Button>
        </div>
      </div>

      {!answered && variant === "inline" && <p className="text-body text-on-surface-muted -mt-2">{t(source === "new" ? "answerTemplate" : "pickMode")}</p>}
      {error && (
        <p role="alert" className="text-body text-on-error-container bg-error-container rounded-control px-3 py-2">
          {error}
        </p>
      )}
    </form>
  );
}
