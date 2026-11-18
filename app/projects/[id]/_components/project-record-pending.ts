import type { Spine } from "@/types/spine";

/**
 * Số việc đang chờ user quyết trong tab "Chờ bạn quyết" của "Hồ sơ dự án": chỉ đếm việc có nút hành động — giả định chưa
 * xác nhận, ghi chú Brief chưa phân loại (pha Brief), màn chưa chốt mức chi tiết (S-5). Rủi ro, câu hỏi mở, rủi ro kỹ
 * thuật (`other_requirements`) chỉ để xem, không có nút quyết nên không tính.
 */
export const pendingRecordCount = (spine: Spine, inBriefPhase: boolean): number => {
  const unconfirmed = inBriefPhase ? spine.assumptions.filter((a) => a.status === "unconfirmed").length : 0;
  const briefNotes = inBriefPhase ? spine.addendum.length : 0;
  const screensQueued = spine.progress.current_phase === "S-5" ? spine.screens.filter((s) => s.detail_status === "pending").length : 0;
  return unconfirmed + briefNotes + screensQueued;
};
