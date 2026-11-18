/**
 * FLF-338 — business-flow §3.6.1 "Rút yêu cầu từ tài liệu thô" (bám `flintflow_be/src/modules/change-request/change-request.dto.ts`
 * `extractionSchema`, contract #31a–#31c). Đổi ở BE thì đổi ở đây trong cùng PR.
 */

export type ExtractionLabel = "new" | "modification" | "duplicate" | "contradiction" | "ambiguous";
export const EXTRACTION_LABELS: readonly ExtractionLabel[] = ["new", "modification", "duplicate", "contradiction", "ambiguous"];
/** Nhãn cần BA trả lời câu hỏi trước khi đưa vào change request (bước 4). */
export const QUESTION_LABELS: ReadonlySet<ExtractionLabel> = new Set(["contradiction", "ambiguous"]);

export interface ExtractionItem {
  id: string;
  text: string;
  label: ExtractionLabel;
  /** Mã đoạn nguồn `D1-P03`; null khi AI trỏ sai và Code không tìm được đoạn. */
  para_id: string | null;
  quote: string;
  /** Nhóm AI đề xuất gộp thành một CR — BA tách được. */
  group: string;
  entity_paths: string[];
  question: string | null;
  suggested_answers: string[];
  include: boolean | null;
  drop_reason: string | null;
  answer: string | null;
  cr_id: string | null;
}

export interface Extraction {
  document_id: string;
  document_name: string;
  doc_code: number;
  status: "extracted" | "approved";
  items: ExtractionItem[];
  credits: number;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ExtractionDecision {
  id: string;
  include: boolean;
  drop_reason?: string | null;
  answer?: string | null;
  group?: string | null;
}

export interface ApproveExtractionRequest {
  requester: string;
  decisions: ExtractionDecision[];
}
