import type { DocumentUploadChoice, DocxPrecheck, ProjectDocument, ReferenceDocumentText } from "@/types/document";
import { apiCall } from "./client";
import { fetchFile } from "./files";

export const listProjectDocuments = (projectId: string) =>
  apiCall<ProjectDocument[]>(`/projects/${projectId}/documents`);

/**
 * `choice` (FLF-398): lần tải lại sau `409 POSSIBLE_NEW_VERSION` — "Thay bản cũ" (`replace_document_id`) hoặc "Giữ cả hai"
 * (`keep_both`). Trùng hệt nội dung ⇒ `409 DUPLICATE_DOCUMENT` (xem `lib/reference-upload.ts`).
 */
export const uploadProjectDocument = (projectId: string, file: File, choice?: DocumentUploadChoice) => {
  const formData = new FormData();
  if (choice && "replaceDocumentId" in choice) formData.append("replace_document_id", choice.replaceDocumentId);
  if (choice && "keepBoth" in choice) formData.append("keep_both", "true");
  formData.append("file", file);
  // `precheck`: file trông như SRS (§3.6) — `null` khi BE kiểm lỗi
  return apiCall<ProjectDocument & { precheck?: DocxPrecheck | null }>(`/projects/${projectId}/documents`, {
    method: "POST",
    body: formData,
  });
};

/** Hộp Tạo dự án: file ở ô Tài liệu tham khảo có trông như SRS không (không cần dự án, BE không lưu file). */
export const precheckDocx = (file: File) => {
  const formData = new FormData();
  formData.append("file", file);
  return apiCall<DocxPrecheck>("/projects/precheck-docx", { method: "POST", body: formData });
};

export const deleteProjectDocument = (projectId: string, documentId: string) =>
  apiCall<{ deleted: boolean }>(`/projects/${projectId}/documents/${documentId}`, {
    method: "DELETE",
  });

/** Chữ của tài liệu tham khảo, chia đoạn theo `para_id` (Lead / Analyst). `404 DOCUMENT_NOT_FOUND` khi tài liệu không thuộc dự án. */
export const getReferenceDocumentText = (projectId: string, documentId: string) =>
  apiCall<ReferenceDocumentText>(`/projects/${projectId}/documents/${documentId}/text`);

/** File gốc (blob + tên từ `Content-Disposition`). `503 DOCUMENT_UNAVAILABLE` khi kho lưu file không trả được. */
export const downloadReferenceDocument = (projectId: string, documentId: string) =>
  fetchFile(`/projects/${projectId}/documents/${documentId}/download`);
