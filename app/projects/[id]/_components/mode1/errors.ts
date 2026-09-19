/**
 * Đổi lỗi API mode 1 thành câu tiếng Việt cho user. Mã không có trong bảng ⇒ dùng thông điệp của BE
 * (đã là tiếng Việt), không nuốt lỗi.
 */
import { ApiClientError } from "@/lib/api/client";
import type { BlockLockedMeta } from "@/types/change-request";

const FRIENDLY: Record<string, string> = {
  INSUFFICIENT_CREDIT: "Không đủ credit cho bước AI này — nạp thêm rồi thử lại.",
  SPINE_VERSION_CONFLICT: "Dữ liệu vừa thay đổi ở phiên khác — đã tải lại, vui lòng thử lại.",
  PROJECT_MODE_MISMATCH: "Dự án này không phải dự án upload SRS (mode 1).",
  IMPORT_STAMP_FOREIGN_PROJECT: "File này được xuất từ một dự án khác — không nhập vào dự án này được.",
  IMPORT_NEEDS_LATEST_CONFIRM: "Hãy xác nhận đây là bản mới nhất trước.",
  CR_REQUIRES_BASELINE: "Cần hoàn tất import (baseline 0.0) trước khi tạo change request.",
  RELEASE_RED_FLAGS_OPEN: "Còn cờ đỏ chưa xử lý — chưa release được.",
  CORE_STEP_REQUIRED: "Step này thuộc đầu mục mẫu FPT hoặc đã có dữ liệu — không tắt được.",
  STEP_NOT_IN_PLAN: "Step không có trong kế hoạch của dự án.",
  BASELINE_BLOCKED: "Còn cờ đỏ chưa xử lý — chưa ký baseline v1 được.",
};

export const errorText = (err: unknown, fallback = "Đã có lỗi xảy ra"): string => {
  if (err instanceof ApiClientError) {
    if (err.code === "BLOCK_LOCKED") {
      const locked = (err.meta as BlockLockedMeta | undefined)?.locked ?? [];
      if (locked.length) {
        return `Block đang bị change request khác giữ: ${locked.map((l) => `${l.block_id} (${l.cr_id})`).join(", ")}. Chờ CR đó xong hoặc huỷ rồi thử lại.`;
      }
    }
    return FRIENDLY[err.code] ?? err.message ?? fallback;
  }
  return err instanceof Error && err.message ? err.message : fallback;
};

export const errorCode = (err: unknown): string | null => (err instanceof ApiClientError ? err.code : null);
