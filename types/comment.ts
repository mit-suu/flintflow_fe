/**
 * Comment ghim vào nội dung SRS (UC-49) — phản chiếu `CommentDto` của BE (`modules/comment/comment.service.ts`),
 * contract `pipeline-contract.md` endpoint 26–29.
 */
import type { OrgRole } from "./organization";

export type CommentStatus = "open" | "resolved" | "converted";

export const COMMENT_TEXT_MAX = 2000;

export interface CommentPerson {
  _id: string;
  name: string | null;
  email: string | null;
}

export interface CommentVersion {
  source: "draft" | "baseline";
  /** `snapshot_ref` của baseline; `null` với bản nháp. */
  baseline_id: string | null;
  /** `draft`, `v1.0`, `0.0`… */
  label: string;
}

export interface CommentAnchor {
  /** `RenderedSection.id` */
  section_id: string;
  /** Chỉ số trong `section.blocks`; `null` = cả section. */
  block_index: number | null;
  label: string;
  excerpt: string | null;
}

export interface CommentReply {
  author: CommentPerson;
  author_role: OrgRole;
  text: string;
  at: string;
}

export interface SrsComment {
  comment_id: string;
  version: CommentVersion;
  anchor: CommentAnchor;
  author: CommentPerson;
  author_role: OrgRole;
  text: string;
  status: CommentStatus;
  cr_id: string | null;
  handled_by: CommentPerson | null;
  handled_at: string | null;
  replies: CommentReply[];
  created_at: string;
}

export interface CreateCommentRequest {
  version: { source: "draft" | "baseline"; baseline_id?: string };
  anchor: { section_id: string; block_index: number | null };
  text: string;
}
