import { ApiClientError } from "@/lib/api/client";
import { uploadProjectDocument } from "@/lib/api/documents";
import type { DocumentUploadChoice, DocumentVersionCandidate, DocxPrecheck, ProjectDocument } from "@/types/document";

/**
 * FLF-398 — tải một tài liệu tham khảo, xử lý hai lỗi nhận diện của BE:
 * - `409 DUPLICATE_DOCUMENT`: file trùng hệt tài liệu đã có ⇒ không lưu, trả `duplicate` kèm câu báo (đã dịch, có tên file).
 * - `409 POSSIBLE_NEW_VERSION`: có thể là bản mới của tài liệu đã có ⇒ hỏi người dùng qua `choose` rồi tải lại kèm lựa chọn;
 *   `choose` trả `null` (Bỏ qua) ⇒ không tải.
 * Lỗi khác ném tiếp như cũ.
 */

/** Hỏi người dùng: thay bản cũ nào / giữ cả hai / bỏ qua (`null`). */
export type DocumentVersionChooser = (file: File, candidates: DocumentVersionCandidate[]) => Promise<DocumentUploadChoice | null>;

export type ReferenceUploadResult =
  | { kind: "uploaded"; document: (ProjectDocument & { precheck?: DocxPrecheck | null }) | null }
  | { kind: "duplicate"; message: string }
  | { kind: "skipped" };

/** Ứng viên bản mới trong lỗi `POSSIBLE_NEW_VERSION`; lỗi khác ⇒ `null`. */
export const versionCandidatesOf = (err: unknown): DocumentVersionCandidate[] | null => {
  if (!(err instanceof ApiClientError) || err.code !== "POSSIBLE_NEW_VERSION") return null;
  const candidates = err.meta?.candidates;
  return Array.isArray(candidates) && candidates.length ? (candidates as DocumentVersionCandidate[]) : null;
};

const isDuplicate = (err: unknown): err is ApiClientError => err instanceof ApiClientError && err.code === "DUPLICATE_DOCUMENT";

export async function uploadReferenceDocument(projectId: string, file: File, choose: DocumentVersionChooser): Promise<ReferenceUploadResult> {
  try {
    return { kind: "uploaded", document: (await uploadProjectDocument(projectId, file)).data };
  } catch (err) {
    if (isDuplicate(err)) return { kind: "duplicate", message: err.message };
    const candidates = versionCandidatesOf(err);
    if (!candidates) throw err;
    const choice = await choose(file, candidates);
    if (!choice) return { kind: "skipped" };
    try {
      return { kind: "uploaded", document: (await uploadProjectDocument(projectId, file, choice)).data };
    } catch (again) {
      if (isDuplicate(again)) return { kind: "duplicate", message: again.message };
      throw again;
    }
  }
}
