/**
 * FLF-338 — business-flow §3.6.1 "Rút yêu cầu từ tài liệu thô" (bám `flintflow_be/src/modules/change-request/change-request.dto.ts`
 * `extractionSchema`, contract #31a–#31d). Đổi ở BE thì đổi ở đây trong cùng PR.
 * FLF-449 (P6): nhãn `inferred` (Suy ra) + khối `inference`, người nói, các phía của mâu thuẫn, hiện trạng / mong muốn,
 * tên phần tử (`entity_names`), phương án đã chọn, số lô.
 */

export type ExtractionLabel = "new" | "modification" | "duplicate" | "contradiction" | "ambiguous" | "inferred";
export const EXTRACTION_LABELS: readonly ExtractionLabel[] = ["new", "modification", "duplicate", "contradiction", "ambiguous", "inferred"];
/** Nhãn cần BA trả lời câu hỏi trước khi đưa vào change request (bước 4). */
export const QUESTION_LABELS: ReadonlySet<ExtractionLabel> = new Set(["contradiction", "ambiguous"]);

/**
 * Một phương án của mục Suy ra. Tương thích kiểu `OptionAnalysis` chung (FLF-449 N1: label, description?, pros, cons, risks)
 * đang làm ở nhánh khác — gộp sau thì thay bằng kiểu chung.
 */
export interface ExtractionOption {
  label: string;
  description: string | null;
  pros: string[];
  cons: string[];
  risks: string[];
}

export interface ExtractionInference {
  /** Triệu chứng tài liệu nhắc tới + câu trích (bắt buộc) + mã đoạn. */
  symptom: string;
  symptom_quote: string;
  symptom_para_id: string | null;
  root_cause: string;
  rationale: string;
  /** Đúng 2 phương án. */
  options: ExtractionOption[];
  /** Chỉ số phương án khuyến nghị; `null` = AI chưa chắc chắn, hai phương án ngang nhau. */
  recommended: number | null;
  recommendation_reason: string | null;
  /** Mục tiêu dự án mà nhu cầu phục vụ; `null` khi dự án chưa có mục tiêu. */
  serves_goal: string | null;
}

export interface ExtractionSide {
  speaker: string | null;
  para_id: string | null;
  quote: string;
}

export interface SituationPoint {
  text: string;
  para_id: string | null;
  quote: string;
}

export interface ExtractionItem {
  id: string;
  text: string;
  label: ExtractionLabel;
  /** Mã đoạn nguồn `D1-P03` (chỉ để tra / mở đoạn, UI không in); null khi AI trỏ sai và Code không tìm được đoạn. */
  para_id: string | null;
  quote: string;
  /** Nhóm AI đề xuất gộp thành một CR — BA tách được. */
  group: string;
  entity_paths: string[];
  /** Tên đọc được của từng phần tử trong `entity_paths` (cùng thứ tự, "" khi không có). Bản rút cũ có thể thiếu. */
  entity_names?: string[];
  /** Người nói (chỉ khi tài liệu ghi rõ). */
  speaker?: string | null;
  /** Mâu thuẫn: các phía, mỗi phía kèm người nói + câu trích. */
  sides?: ExtractionSide[];
  inference?: ExtractionInference | null;
  question: string | null;
  suggested_answers: string[];
  include: boolean | null;
  drop_reason: string | null;
  answer: string | null;
  /** Mục Suy ra: phương án BA đã chọn. */
  chosen_option?: number | null;
  cr_id: string | null;
}

export interface Extraction {
  document_id: string;
  document_name: string;
  doc_code: number;
  status: "extracted" | "approved";
  /** Đầu danh sách: hiện trạng / mong muốn kèm câu trích. Bản rút cũ có thể thiếu. */
  situation?: { current: SituationPoint[]; desired: SituationPoint[] };
  items: ExtractionItem[];
  /** Số lô (mỗi lô một lượt AI). */
  batches?: number;
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
  /** Mục Suy ra được tick: chỉ số phương án chọn (bắt buộc). */
  chosen_option?: number | null;
}

export interface ApproveExtractionRequest {
  requester: string;
  decisions: ExtractionDecision[];
}

/** #31d — số lô + credit dự kiến trước khi rút (tài liệu dài chia lô, mỗi lô một lượt). */
export interface ExtractionEstimate {
  batches: number;
  credits: number;
  cost_per_batch: number;
}
