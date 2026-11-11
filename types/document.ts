import type { DocumentLanguage } from "./project";

/** Trạng thái section là hàm tính ở BE (`srs-spine.md` §5). */
export type SectionStatus = "draft" | "accepted" | "stale" | "derived";

export type DocumentSource = "draft" | "baseline";

/*
 * RenderedDocument — ĐỒNG BỘ TAY, nguồn là BE `modules/render/rendered-document.types.ts` (T05).
 * Ảnh qua HTTP là chuỗi base64 (có thể kèm tiền tố `data:image/png;base64,`; ảnh giữ chỗ "đang chờ vẽ" luôn là base64),
 * tham chiếu `image-ref:<diagram|media>:<id>[:<locale>]@<hash>` (`GET /document` bản nháp — FE tải ảnh qua
 * `GET /document/image?ref=`, `hash` đổi khi ảnh đổi), hoặc `diagram-ref:<diagramId>` (dạng cũ — `GET /diagrams/:id.png`).
 */

export interface InlineRun {
  text: string;
  bold?: boolean;
  italic?: boolean;
  /** Code inline (font đơn cách). */
  code?: boolean;
}

/** Một ô bảng = một dãy run (giữ được bold/italic trong ô). */
export type TableCell = InlineRun[];

export type Block =
  | { type: "paragraph"; runs: InlineRun[] }
  | { type: "heading"; level: number; text: string }
  | { type: "bullet_list"; items: InlineRun[][] }
  | { type: "numbered_list"; items: InlineRun[][] }
  | { type: "table"; header: TableCell[]; rows: TableCell[][] }
  | { type: "image"; png: string; caption?: string }
  | { type: "page_break" };

export interface RenderedSection {
  id: string;
  number: string;
  heading: string;
  level: number;
  status?: SectionStatus;
  awaiting_reaccept?: boolean;
  blocks: Block[];
}

export type RocChangeType = "A" | "M" | "D";

/** Một dòng bảng §I Record of Changes (khung FPT). */
export interface RocRow {
  /** `YYYY-MM-DD`. */
  date: string;
  version: string;
  change_type: RocChangeType;
  in_charge: string;
  description: string;
}

export interface FlagRow {
  id: string;
  rule_id: string;
  /** Nhãn section đã phân giải để hiển thị (`3.2.1 Create Project`), không phải khoá logic. */
  section: string;
  message: string;
  waive_reason?: string | null;
}

export interface RenderedDocument {
  /** Bắt buộc: ghi vào custom property của file .docx làm "dấu version FlintFlow" (business-flow I-1). */
  projectId: string;
  projectName: string;
  version: string;
  source: DocumentSource;
  watermark?: "DRAFT";
  generatedAt: string;
  sections: RenderedSection[];
  recordOfChanges: RocRow[];
  flagsAppendix?: {
    redOpen: FlagRow[];
    staleCount: number;
    waived: FlagRow[];
  };
}

/** `meta` của `GET /document?source=draft` — vắng mặt khi `source=baseline`. */
export interface DraftMeta {
  assembled_at_version: number;
  spine_version: number;
  stale: boolean;
  /**
   * Revision của tài liệu bản nháp, tính TRƯỚC khi dựng bản này (chuỗi mờ — chỉ so bằng nhau với `GET /version`).
   * BE cũ không gửi ⇒ vắng.
   */
  document_revision?: string;
}

// ─── Ngôn ngữ tài liệu (FLF-265) — `pipeline-contract.md` #16, #26, #27; schema ở BE `pipeline.dto.ts` ───
// Spine giữ ngôn ngữ gốc (mode 2: tiếng Anh); chữ ngôn ngữ khác nằm ở lớp bản dịch ngoài Spine, khoá theo hash chữ gốc.

/**
 * `meta.translation` của `GET /document` (`documentTranslationMetaSchema`) — CHỈ có khi ngôn ngữ tài liệu khác ngôn ngữ
 * gốc của Spine. `missing` = số mục đang in chữ gốc vì chưa có bản dịch.
 */
export interface DocumentTranslationMeta {
  locale: DocumentLanguage;
  source_locale: DocumentLanguage;
  missing: number;
}

/** `GET /projects/:id/translations/status` (`translationStatusResponseSchema`) — không gọi model; ngôn ngữ = gốc ⇒ `total: 0`. */
export interface TranslationStatus {
  locale: DocumentLanguage;
  source_locale: DocumentLanguage;
  total: number;
  missing: number;
  /** Số lô còn phải chạy cho phần thiếu. */
  batches: number;
  /** Ước tính credit của mọi lô còn lại — credit trừ theo lô thật sự chạy. */
  estimated_credits: number;
}

/** `POST /projects/:id/translations/run` (`translationRunResponseSchema`) — kết quả của MỘT lượt gọi (tối đa `max_batches` lô). */
export interface TranslationRunResult {
  translated: number;
  remaining: number;
  credits_used: number;
}

/** Tài liệu đính kèm của project (`/projects/:id/documents`). */
/**
 * Business-flow §3.6: file .docx có trông như SRS không (Code nhận diện như preflight, không gọi AI) — FE gợi ý chuyển ô /
 * cập nhật phiên bản mới, không chặn. `heading_overlap` (0–1) chỉ có khi dự án đã có SRS.
 */
export interface DocxPrecheck {
  looks_like_srs: boolean;
  stamp: { project_id: string } | null;
  heading_overlap?: number;
}

export interface ProjectDocument {
  _id: string;
  projectId: string;
  uploadedBy: string;
  fileName: string;
  originalName: string;
  mimeType: string;
  size: number;
  url: string;
  extension?: string | null;
  parseStatus: "pending" | "success" | "failed";
  parseError?: string | null;
  tokenCount?: number | null;
  summary?: string | null;
  summaryStatus: "pending" | "success" | "failed";
  /** Số tài liệu `D<n>` (FLF-292). */
  docCode?: number | null;
  /** FLF-398: SHA-256 nội dung file — FE so lúc chọn tệp để báo "đã có trong dự án". Tài liệu cũ chưa có ⇒ `null`. */
  contentHash?: string | null;
  /** FLF-398: các bản cũ tài liệu này đã thay ("Thay bản cũ") — chỉ có ở `GET /documents`. */
  replaces?: DocumentRef[];
  createdAt: string;
  updatedAt: string;
}

/** FLF-398: tham chiếu gọn tới một tài liệu tham khảo (trong `meta` lỗi upload và `replaces`). */
export interface DocumentRef {
  id: string;
  name: string;
  doc_code: number | null;
}

/**
 * FLF-398: tài liệu đang dùng mà file vừa tải có thể là bản mới của nó (`409 POSSIBLE_NEW_VERSION` → `meta.candidates`).
 * `same_name`: cùng tên gốc sau khi bỏ dấu phiên bản (`_v1`, `(1)`, `- Copy`…); `similar_content`: nội dung giống ≥ 70%.
 */
export interface DocumentVersionCandidate extends DocumentRef {
  reason: "same_name" | "similar_content";
  /** Độ giống nội dung 0..1. */
  similarity: number;
}

/** FLF-398: lựa chọn gửi kèm lần tải lại sau `POSSIBLE_NEW_VERSION`. */
export type DocumentUploadChoice = { replaceDocumentId: string } | { keepBoth: true };
