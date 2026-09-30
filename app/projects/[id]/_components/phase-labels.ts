import { stepLabel as registryStepLabel, type PhaseId } from "@/lib/constants/step-registry";

/**
 * Tên giai đoạn đời thường cho rail tiến độ của workspace (không mã B-x / S-x). Riêng workspace: `PHASE_LABELS_VI` trong
 * step-registry còn là nguồn của `tPhase` (i18n), nên không đổi chung.
 */
export const PHASE_NAV_LABELS: Readonly<Record<PhaseId, string>> = {
  "B-0": "Ý tưởng",
  "B-1": "Làm rõ ý tưởng",
  "B-2": "Chốt tóm tắt",
  "S-1": "Phân tích",
  "S-2": "Tổng quan",
  "S-3": "Người dùng",
  "S-4": "Hệ thống",
  "S-5": "Chi tiết màn",
  "S-6": "Phi chức năng",
  "S-7": "Phụ lục",
  "S-8": "Hoàn thiện",
  "S-9": "Kiểm & chốt",
};

/** Giai đoạn hiện thành MỘT mục, không xổ danh sách bước con (B-0.1…0.3 là một cuộc trò chuyện về ý tưởng). */
export const SINGLE_ITEM_PHASES: ReadonlySet<PhaseId> = new Set<PhaseId>(["B-0"]);

/**
 * Nhãn bước đời thường cho workspace Mode 2 (rail, đầu chat, dòng chia bước, nhật ký, chip). Đè nhãn của registry
 * (bản sao đóng băng của BE, không sửa tay) ở những bước mà nhãn có chữ nội bộ: "addendum", "giả định", "Brief".
 */
const STEP_DISPLAY_LABELS: Readonly<Record<string, string>> = {
  "B-1.4": "Phạm vi bản đầu & tính năng dự kiến",
  "B-1.6": "Rủi ro & câu hỏi còn mở",
  "B-2.1": "Rà lại những điều tôi tạm hiểu",
  "B-2.2": "Sắp xếp ghi chú",
  "S-1.1": "Đọc lại tóm tắt ý tưởng",
  "S-1.3": "Xung đột & điều tạm hiểu",
  "S-9.1": "Rà đầy đủ & điều tạm hiểu",
};

export const workspaceStepLabel = (stepId: string): string => STEP_DISPLAY_LABELS[stepId] ?? registryStepLabel(stepId);
