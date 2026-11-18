/**
 * Hàng việc chờ người quyết (`GET /projects/:id/pending-queue`, contract #51). Mirror `pendingQueueResponseSchema` của BE:
 * chỉ thứ tự và danh tính, không có chữ - FE dựng câu hỏi từ Spine đã tải.
 */
export type PendingKind = "assumption" | "brief_note" | "screen" | "flag_red" | "flag_yellow_group";

export interface PendingItemRefs {
  assumption_id?: string;
  addendum_id?: string;
  screen_id?: string;
  flag_ids?: string[];
}

export interface PendingItem {
  /** `<kind>:<id>`; nhóm cờ vàng: `flag_yellow_group:<entity_path | rule_id@section_id>`. */
  key: string;
  kind: PendingKind;
  /** `false` chỉ với nhóm cờ vàng. */
  blocking: boolean;
  owner_step: string;
  section_id: string | null;
  entity_path: string | null;
  /** Số việc khác cùng phần tử thuộc bước soạn sau; 0 ⇒ không hiện lý do xếp trước. */
  dependents: number;
  refs: PendingItemRefs;
}

export interface PendingQueue {
  total: number;
  items: PendingItem[];
}
