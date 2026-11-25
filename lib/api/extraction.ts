import type { ApproveExtractionRequest, Extraction, ExtractionEstimate } from "@/types/extraction";
import { apiCall } from "./client";

const base = (projectId: string, documentId: string) => `/projects/${projectId}/documents/${documentId}/extract`;

/** #31a — rút yêu cầu: mỗi lô tài liệu một lượt `extract_requirements` (báo credit trước bằng #31d). 409 `EXTRACTION_ALREADY_APPROVED`, 422 `EXTRACTION_DOCUMENT_UNREADABLE`. */
export const extractRequirements = (projectId: string, documentId: string) => apiCall<Extraction>(base(projectId, documentId), { method: "POST" });

/** #31b — danh sách rút hiện có, `null` nếu chưa rút. */
export const getExtraction = (projectId: string, documentId: string) => apiCall<Extraction | null>(base(projectId, documentId));

/** #31c — BA duyệt ⇒ mỗi nhóm một CR. 400 `EXTRACTION_DECISION_INVALID` kèm `meta.item_ids`. */
export const approveExtraction = (projectId: string, documentId: string, body: ApproveExtractionRequest) =>
  apiCall<Extraction>(`${base(projectId, documentId)}/approve`, { method: "POST", body: JSON.stringify(body) });

/** #31d — FLF-449: số lô + credit dự kiến (tài liệu dài chia lô, mỗi lô một lượt AI). */
export const estimateExtraction = (projectId: string, documentId: string) => apiCall<ExtractionEstimate>(`${base(projectId, documentId)}/estimate`);
