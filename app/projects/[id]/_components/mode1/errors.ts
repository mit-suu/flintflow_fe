/**
 * Đổi lỗi API mode 1 thành câu tiếng Việt cho user. Mã không có trong bảng ⇒ dùng thông điệp của BE
 * (đã là tiếng Việt), không nuốt lỗi.
 */
import { ApiClientError } from "@/lib/api/client";
import type { CrNoLocationsMeta, PathLockedMeta } from "@/types/change-request";

const FRIENDLY: Record<string, string> = {
  INSUFFICIENT_CREDIT: "Không đủ credit cho bước AI này — nạp thêm rồi thử lại.",
  SPINE_VERSION_CONFLICT: "Dữ liệu vừa thay đổi ở phiên khác — đã tải lại, vui lòng thử lại.",
  PROJECT_MODE_MISMATCH: "Dự án này không phải dự án upload SRS (mode 1).",
  IMPORT_STAMP_FOREIGN_PROJECT: "File này được xuất từ một dự án khác — không nhập vào dự án này được.",
  IMPORT_NEEDS_LATEST_CONFIRM: "Hãy xác nhận đây là bản mới nhất trước.",
  CR_REQUIRES_BASELINE: "Cần hoàn tất import (baseline 0.0) trước khi tạo change request.",
  RELEASE_RED_FLAGS_OPEN: "Còn cờ đỏ chưa xử lý — chưa release được.",
  CR_VALUE_CHANGED: "Phần tử vừa bị sửa ở chỗ khác sau khi đề xuất — chạy lại đề xuất rồi kiểm lại.",
  CORE_STEP_REQUIRED: "Step này thuộc đầu mục mẫu FPT hoặc đã có dữ liệu — không tắt được.",
  STEP_NOT_IN_PLAN: "Step không có trong kế hoạch của dự án.",
  BASELINE_BLOCKED: "Còn cờ đỏ chưa xử lý — chưa ký baseline v1 được.",
  RATE_LIMIT_EXCEEDED: "Máy chủ AI từ chối phục vụ (hết hạn mức, chưa gắn thanh toán, hoặc gọi quá nhanh). Kiểm tra tài khoản nhà cung cấp AI rồi thử lại.",
  AI_PROVIDER_ERROR: "Máy chủ AI lỗi hoặc trả về rỗng — thử lại; còn lặp lại thì xem log máy chủ.",
  CR_NOTHING_TO_APPROVE: 'Mọi vị trí đều là "không liên quan" nên không có gì để duyệt. Sửa kết luận ở vị trí cần đổi (nút "Sửa tay"), hoặc huỷ change request.',
};

export const errorText = (err: unknown, fallback = "Đã có lỗi xảy ra"): string => {
  if (err instanceof ApiClientError) {
    if (err.code === "PATH_LOCKED") {
      const locked = (err.meta as PathLockedMeta | undefined)?.locked ?? [];
      if (locked.length) {
        return `Phần tử đang bị change request khác giữ: ${locked.map((l) => `${l.path} (${l.cr_id})`).join(", ")}. Chờ CR đó xong hoặc huỷ rồi thử lại.`;
      }
    }
    if (err.code === "CR_NO_LOCATIONS") {
      // C-3 ra 0 vị trí: mục còn trống thì không có gì để sửa — chỉ sang step thay vì để nút "Tìm vị trí" trông như hỏng
      const empty = (err.meta as CrNoLocationsMeta | undefined)?.empty_sections ?? [];
      if (empty.length) {
        const steps = empty.map((s) => `"${s.title}"${s.step_id ? ` → chạy step ${s.step_id}` : ""}`).join("; ");
        return `Không có phần tử nào để sửa — mục còn trống: ${steps}. Về workspace chạy step cho AI soạn nội dung, hoặc sửa mô tả CR cho trỏ vào phần tử cụ thể rồi làm rõ lại.`;
      }
      return "Không tìm được phần tử nào khớp với change request. Sửa mô tả (nêu mã hoặc tên phần tử, ví dụ UC-01, actor Learner) rồi bấm làm rõ lại.";
    }
    // `||` chứ không phải `??`: BE trả `message: ""` là chuỗi RỖNG, không phải null — dùng `??` thì hộp lỗi
    // hiện trắng, người dùng chỉ thấy một khung đỏ không chữ.
    return FRIENDLY[err.code] || err.message || fallback;
  }
  return err instanceof Error && err.message ? err.message : fallback;
};

export const errorCode = (err: unknown): string | null => (err instanceof ApiClientError ? err.code : null);
