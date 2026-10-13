/**
 * Comment ghim vào nội dung SRS (UC-49) — phản chiếu `commentSchema` của BE (endpoint 28–31).
 * Giữ snake_case đúng như field BE trả.
 *
 * Comment KHÔNG đổi nội dung tài liệu (BR-05). Kết luận một comment (`resolve`) trên mục có bước đã
 * Accept sẽ **mở lại bước đó** ở BE (UC-47) — UI phải nói trước cho người dùng.
 */
import type { IsoDateTime } from "./spine";

export const COMMENT_TEXT_MAX = 2000;

export type CommentStatus = "open" | "resolved" | "converted";

/** Phiên bản đang đọc lúc viết comment: bản nháp, hoặc một baseline đã phát hành (BR-27). */
export interface CommentVersion {
  source: "draft" | "baseline";
  baseline_id: string | null;
  /** Nhãn hiển thị: `draft`, `v1.0`, `0.0`… */
  label: string;
}

/** Chỗ ghim: một section của tài liệu, có thể thu hẹp tới một block trong section. */
export interface CommentAnchor {
  section_id: string;
  /** `null` = ghim cả section. */
  block_index: number | null;
  /** Nhãn do BE dựng, vd `3.2.4 Cancel booking › Block 2`. */
  label: string;
  excerpt: string | null;
}

export interface CommentPerson {
  _id: string;
  name: string | null;
  email: string | null;
}

export interface CommentReply {
  author: CommentPerson | null;
  author_role: string;
  text: string;
  at: IsoDateTime;
}

export interface Comment {
  comment_id: string;
  version: CommentVersion;
  anchor: CommentAnchor;
  author: CommentPerson | null;
  author_role: string;
  text: string;
  status: CommentStatus;
  /** Mã change request khi comment đã được chuyển thành CR (mode 1). */
  cr_id: string | null;
  handled_by: string | null;
  handled_at: IsoDateTime | null;
  /** Kết luận lượt xử lý; `null` khi chưa xử lý hoặc đã chuyển thành CR. */
  resolution: CommentResolution | null;
  replies: CommentReply[];
  created_at: IsoDateTime;
}

/** Body của `POST /projects/:id/comments`. `block_index` vắng ⇒ ghim cả section. */
export interface CreateCommentInput {
  version: { source: "draft" | "baseline"; baseline_id?: string };
  anchor: { section_id: string; block_index?: number };
  text: string;
}

/** Chỗ người dùng vừa chọn để ghim — chưa gửi lên BE. */
export interface PendingCommentAnchor {
  sectionId: string;
  blockIndex?: number;
  /** Nhãn mục để hiện trong ô soạn ("§3.2 Actors"); BE vẫn tự dựng nhãn thật khi ghi. */
  label: string;
}

/**
 * Hai nhánh kết luận một comment (`business-flow.md §3.5`): đã nhờ AI sửa qua chat, hoặc giữ nguyên
 * kèm lý do. Tách hai nhánh vì Lead duyệt lại cần biết **vì sao** comment được đóng.
 */
export type CommentResolutionKind = "fixed" | "kept";

/** Lý do bắt buộc khi giữ nguyên — BE từ chối nếu ngắn hơn ngần này. */
export const KEEP_REASON_MIN_LENGTH = 10;

export interface CommentResolution {
  kind: CommentResolutionKind;
  /** `null` với `fixed`: nội dung đã đổi, bản thân thay đổi là lời giải thích. */
  reason: string | null;
}

/** Body của `POST /comments/:id/resolve`. */
export interface CommentResolutionInput {
  kind: CommentResolutionKind;
  reason?: string;
}
