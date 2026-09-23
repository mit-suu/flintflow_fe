import type { ReactNode } from "react";

/**
 * Lỗi nói cho NGƯỜI, không nói cho máy (FLF-206 / BUG-25).
 *
 * Lượt test UI cho thấy user gặp nguyên văn `STEP_NOT_RUNNABLE: This step isn't ready to run or review yet`,
 * `NOT_IMPLEMENTED`, `duplicate_id` — tiếng Anh, không nói vì sao, và chỉ có một nút "Đóng". Bảng này đổi mã
 * lỗi thành một câu tiếng Việt **kèm hành động kế tiếp**. Nguyên tắc: mọi lỗi phải có ít nhất một việc user
 * làm được; mã kỹ thuật chỉ nằm trong phần "Chi tiết" thu gọn.
 *
 * Khác với `lib/api/error-messages.ts` (dịch câu lỗi theo `code` cho mọi lời gọi API), file này còn quyết
 * định **hành động** và **cách hồi phục** của khu vực workspace.
 */

export type ErrorActionKind = "cancel_and_rerun" | "goto_step" | "retry" | "reload_spine" | "edit_command" | "report" | "dismiss";

export interface ErrorAction {
  kind: ErrorActionKind;
  label: string;
  /** Step cần đi tới (`goto_step`). */
  stepId?: string;
}

export interface FriendlyError {
  /** Câu hiện cho user — không chứa mã lỗi. */
  message: string;
  /** Việc user làm được ngay, nút đầu tiên là hành động chính. */
  actions: ErrorAction[];
  /** `true` ⇒ FE tự xử lý (tải lại Spine rồi thử lại), chỉ báo nhẹ. */
  selfHealing?: boolean;
  detail?: ReactNode;
}

const RETRY: ErrorAction = { kind: "retry", label: "Thử lại" };
const REPORT: ErrorAction = { kind: "report", label: "Báo lỗi" };

/** "Bước này đang chạy ở lượt trước (bắt đầu 14:02)" — BE đã kèm giờ trong message. */
const startedAtOf = (rawMessage: string): string | null => /bắt đầu (\d{1,2}:\d{2})/.exec(rawMessage)?.[1] ?? null;

/** Step cần xong trước, lấy từ câu của BE ("Cần xong bước S-4.2 trước"). */
const stepIdOf = (rawMessage: string): string | null => /\b([BS]-\d+\.\d+(?:@[\w-]+)?)\b/.exec(rawMessage)?.[1] ?? null;

/**
 * Mã lỗi + câu gốc của BE → thông điệp và hành động. `rawMessage` là câu BE trả (có thể tiếng Việt), chỉ
 * dùng để rút chi tiết (giờ bắt đầu, id step), không hiện thẳng.
 */
export const friendlyError = (code: string, rawMessage = ""): FriendlyError => {
  switch (code) {
    case "STEP_NOT_RUNNABLE": {
      const startedAt = startedAtOf(rawMessage);
      if (startedAt || /đang chạy|đang được xử lý/i.test(rawMessage)) {
        return {
          message: startedAt ? `Bước này đang chạy ở lượt trước (bắt đầu ${startedAt}).` : "Bước này đang chạy ở một lượt trước.",
          actions: [{ kind: "cancel_and_rerun", label: "Huỷ lượt cũ và chạy lại" }]
        };
      }
      const step = stepIdOf(rawMessage);
      if (/chưa tới lượt/i.test(rawMessage) && step) {
        return { message: `Cần xong bước ${step} trước.`, actions: [{ kind: "goto_step", label: `Đi tới ${step}`, stepId: step }] };
      }
      if (/đã accepted/i.test(rawMessage)) {
        return { message: "Bước này đã chốt. Muốn đổi nội dung thì gửi yêu cầu sửa ở cổng chốt của bước.", actions: [{ kind: "dismiss", label: "Đã hiểu" }] };
      }
      return { message: "Chưa chạy được bước này lúc này.", actions: [RETRY] };
    }

    case "SPINE_VERSION_CONFLICT":
      return {
        message: "Tài liệu vừa được cập nhật ở một bước khác. Đã tải bản mới nhất.",
        actions: [RETRY],
        selfHealing: true
      };

    case "CALL_LIMIT":
      return {
        message: "Bước này đã dùng hết 8 lượt gọi AI. Hãy chốt phần đã có, hoặc mở lại bước sau khi sửa yêu cầu.",
        actions: [{ kind: "dismiss", label: "Đã hiểu" }]
      };

    case "REGENERATE_LIMIT":
      return {
        message: "Đã hết 3 lượt soạn lại cho bước này. Dùng “Yêu cầu sửa” để nói rõ cần đổi gì.",
        actions: [{ kind: "dismiss", label: "Đã hiểu" }]
      };

    case "INSUFFICIENT_CREDIT":
      return { message: "Không đủ credit để chạy tiếp. Nạp thêm rồi chạy lại bước này.", actions: [RETRY] };

    case "NEEDS_USER_INPUT":
      return {
        message: "AI trả kết quả không hợp lệ sau 3 lần thử. Bạn có thể chạy lại, hoặc nói rõ hơn yêu cầu ở ô chat.",
        actions: [RETRY, REPORT]
      };

    case "NOT_IMPLEMENTED":
    case "STREAM_FAILED":
    case "UNKNOWN_ERROR":
      return { message: "Hệ thống gặp lỗi khi xử lý bước này. Nội dung đã ghi trước đó vẫn được giữ.", actions: [RETRY, REPORT] };

    case "BASELINE_BLOCKED":
      return {
        message: "Chưa ký được baseline: còn cờ đỏ chưa xử lý. Xử lý hoặc bỏ qua có lý do từng cờ rồi Accept lại.",
        actions: [{ kind: "dismiss", label: "Xem danh sách cờ" }]
      };

    case "NO_WORKING_DRAFT":
      return { message: "Tài liệu chưa được ghép lần nào. Chạy bước S-8.2 để ghép bản nháp.", actions: [{ kind: "goto_step", label: "Đi tới S-8.2", stepId: "S-8.2" }] };

    case "NOT_PIPELINE_SESSION":
      return { message: "Phiên chat này chỉ để hỏi đáp, không chạy được quy trình. Mở lại dự án để tiếp tục.", actions: [RETRY] };

    case "OP_INVALID":
    case "INVARIANT_VIOLATION":
    case "path_not_resolved":
    case "duplicate_id":
    case "op_not_allowed":
    case "op_out_of_scope":
      return {
        message: "Không tìm thấy mục cần sửa, hoặc mục đó đã tồn tại. Hãy nói rõ tên mục (ví dụ: màn “Đặt lịch”, chức năng “Huỷ lịch”).",
        actions: [{ kind: "edit_command", label: "Sửa lệnh" }]
      };

    case "STREAM_CLOSED":
      return { message: "Lượt chạy bị gián đoạn. Nội dung đã ghi trước đó được giữ.", actions: [RETRY] };

    default:
      return { message: "Có lỗi xảy ra. Bạn thử lại giúp nhé.", actions: [RETRY, REPORT] };
  }
};

/** Dòng "Chi tiết" thu gọn — nơi DUY NHẤT được hiện mã kỹ thuật. */
export const errorDetailLine = (code: string, rawMessage: string): string => (rawMessage ? `${code}: ${rawMessage}` : code);
