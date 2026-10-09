import type { DocumentTranslationMeta } from "@/types/document";
import type { DocumentLanguage, Project } from "@/types/project";

/**
 * Ngôn ngữ tài liệu SRS ở client (FLF-265). Ngôn ngữ do BE quyết (`Project.documentLanguage`, `meta.translation` của
 * `GET /document`); file này chỉ đọc lại những gì client đã có, không gọi thêm BE.
 */

const DOCUMENT_LANGUAGES: readonly DocumentLanguage[] = ["vi", "en"];

export const isDocumentLanguage = (value: unknown): value is DocumentLanguage =>
  DOCUMENT_LANGUAGES.includes(value as DocumentLanguage);

/**
 * Tên ngôn ngữ viết bằng chính ngôn ngữ đó — chip ở workspace, trang xem chỉ đọc, dòng "Ngôn ngữ" của hộp xuất. Không
 * theo ngôn ngữ giao diện: chip nói tài liệu viết bằng tiếng gì, nên người đọc tiếng nào cũng nhận ra tên tiếng mình.
 */
export const DOCUMENT_LANGUAGE_NAME: Record<DocumentLanguage, string> = { vi: "Tiếng Việt", en: "English" };

/**
 * Ngôn ngữ tài liệu client biết mà không gọi thêm BE (D1, D3). Field của dự án thắng; mode 2 thiếu field (dự án trước
 * FLF-265) ⇒ `en`, đúng như BE đọc. Mode 1 thiếu field ⇒ `null`: ngôn ngữ theo file (`TemplateProfile.language`) không có
 * sẵn ở client ⇒ không hiện chip, cũng không gọi thêm BE chỉ để biết.
 */
export const knownDocumentLanguage = (
  project: Pick<Project, "mode" | "documentLanguage"> | null | undefined
): DocumentLanguage | null => {
  if (!project) return null;
  return project.documentLanguage ?? (project.mode === "import" ? null : "en");
};

/**
 * `meta.translation` của `GET /document` — chỉ có khi ngôn ngữ tài liệu khác ngôn ngữ gốc của Spine. Envelope sai khuôn
 * ⇒ `null` (coi như tài liệu đang ở ngôn ngữ gốc) thay vì để chip / cảnh báo đọc phải giá trị lạ.
 */
export const translationMetaOf = (meta: Record<string, unknown> | undefined): DocumentTranslationMeta | null => {
  const value = meta?.translation as Record<string, unknown> | null | undefined;
  if (!value || typeof value !== "object") return null;
  const { locale, source_locale, missing } = value;
  if (!isDocumentLanguage(locale) || !isDocumentLanguage(source_locale)) return null;
  if (typeof missing !== "number" || !Number.isInteger(missing) || missing < 0) return null;
  return { locale, source_locale, missing };
};

/** Ngôn ngữ đang hiển thị: `meta.translation` BE vừa trả cho chính tài liệu này thắng giá trị client tự suy. */
export const shownDocumentLanguage = (
  translation: DocumentTranslationMeta | null | undefined,
  known: DocumentLanguage | null | undefined
): DocumentLanguage | null => translation?.locale ?? known ?? null;
