/**
 * FLF-432 (QLHS #10, luồng C #2, FLF-413 #9): thẻ "Tiếp tục" cho bước tới lượt chưa chạy. Trước đây khi không có lượt nào
 * đang chạy (BE khởi động lại giữa chừng, sang giai đoạn mới mà bước không tự chạy) khung chat không có nút nào — chỉ gõ chat
 * mới chạy được, người dùng không biết. Phiên còn trống thì ChatPane / lời mở đầu đã có lời mời riêng ⇒ không hiện trùng.
 */
export interface ContinueCardInput {
  mode1: boolean;
  canEdit: boolean;
  onPipelineSession: boolean;
  stepNotStarted: boolean;
  aiWorking: boolean;
  showOpening: boolean;
  sessionMessages: number;
}

export const canShowContinueCard = (i: ContinueCardInput): boolean =>
  !i.mode1 && i.canEdit && i.onPipelineSession && i.stepNotStarted && !i.aiWorking && !i.showOpening && i.sessionMessages > 0;
