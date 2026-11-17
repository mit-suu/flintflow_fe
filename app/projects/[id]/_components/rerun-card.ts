import type { RunnerStatus } from "../hooks/useStepRunner";

/**
 * FLF-431 (BarberGo #21): thẻ "Cập nhật lại bước này" của bước đang xem có hiện không. Trước chỉ hiện khi runner `idle` —
 * ở Ký baseline cổng S-9.5 đang mở (`gate_ready`) nên mở bước nào từ bảng Kiểm & chốt cũng không thấy nút, cờ "Bước soạn mục
 * này đã mở lại" không gỡ được. Nay: không có lượt AI nào đang chạy, và runner không đứng ở chính bước đang xem (cổng / câu hỏi
 * của bước đó đã có thẻ riêng).
 */
export const canShowRerunCard = (aiWorking: boolean, runner: { status: RunnerStatus; stepId: string | null }, viewedStep: string): boolean =>
  !aiWorking && (runner.status === "idle" || runner.stepId !== viewedStep);
