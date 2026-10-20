import type { BaselineSubmission } from "@/types/spine";

export interface EditLockInput {
  mode1: boolean;
  submission: BaselineSubmission | null | undefined;
  runnerBusy: boolean;
  runnerNeedsInput: boolean;
}

/**
 * Lý do khoá chip "Sửa tài liệu" (null = sửa được). Mode 1 sửa qua change request nên không khoá ở đây.
 * - Đang chờ Lead duyệt (FLF-293): BE trả 409 `DRAFT_LOCKED` — báo trước thay vì để user gõ rồi mới vấp lỗi.
 * - Step đang chạy / chờ trả lời: hai luồng cùng ghi Spine sẽ vấp 409 `SPINE_VERSION_CONFLICT`.
 */
export const editLockReason = ({ mode1, submission, runnerBusy, runnerNeedsInput }: EditLockInput): string | null => {
  if (mode1) return null;
  if (submission?.status === "pending") return "Tài liệu đang chờ Lead duyệt — tạm khoá sửa cho tới khi Lead duyệt hoặc từ chối";
  if (runnerBusy) return "Bước đang chạy — đợi chạy xong rồi hãy sửa tài liệu";
  if (runnerNeedsInput) return "Trả lời câu hỏi của bước đang chạy trước đã";
  return null;
};
