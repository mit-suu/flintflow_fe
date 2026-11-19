import type { Spine } from "@/types/spine";

/**
 * Số mục đang chờ user quyết trong "Hồ sơ dự án" — giả định chưa xác nhận, ghi chú Brief chưa phân loại,
 * màn chưa chốt mức chi tiết, và yêu cầu khác còn treo. Dùng chung cho tab "Chờ bạn quyết" và badge trên
 * nút "Hồ sơ" ở header, để hai chỗ không bao giờ nói hai số khác nhau.
 */
export const pendingRecordCount = (spine: Spine, inBriefPhase: boolean): number => {
  const unconfirmed = inBriefPhase ? spine.assumptions.filter((a) => a.status === "unconfirmed").length : 0;
  const briefNotes = inBriefPhase ? spine.addendum.length : 0;
  const screensQueued = spine.progress.current_phase === "S-5" ? spine.screens.filter((s) => s.detail_status === "pending").length : 0;
  return unconfirmed + briefNotes + screensQueued + spine.other_requirements.length;
};
