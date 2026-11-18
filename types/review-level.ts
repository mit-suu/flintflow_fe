import type { ReviewMode } from "./spine";

/**
 * FLF-337 — mức duyệt 3 tầng (business-flow §1.2): `strict` mọi bước · `fast` cuối giai đoạn · `milestones` chỉ ở mốc chốt
 * (cổng cứng). `balanced` là giá trị cũ, BE đọc như `fast`.
 */
export interface ReviewModeResponse {
  review_mode: ReviewMode;
  spine_version: number;
}

/** `PATCH /projects/:id/skip-confirm-sections` — phần "Chấp nhận, không hỏi lại". */
export interface SkipConfirmSectionsResponse {
  skip_confirm_sections: string[];
  spine_version: number;
}

/** Một thay đổi AI tự qua (bước im) — `GET /projects/:id/auto-passed`. */
export interface AutoPassedItem {
  id: string;
  step_id: string;
  label_vi: string;
  reason_vi: string;
  at: string;
  /** Người đang gọi đã mở xem chưa. */
  seen: boolean;
}

export interface AutoPassedResponse {
  total: number;
  unseen: number;
  items: AutoPassedItem[];
}
