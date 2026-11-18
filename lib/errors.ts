import type { ReactNode } from "react";
import { createTranslator } from "next-intl";
import { currentLocale, localizeApiError } from "@/lib/api/error-messages";
import { tStep, type Locale } from "@/lib/i18n";
import en from "@/messages/en.json";
import vi from "@/messages/vi.json";

/**
 * Lỗi nói cho NGƯỜI, không nói cho máy (FLF-206 / BUG-25).
 *
 * Lượt test UI cho thấy user gặp nguyên văn `STEP_NOT_RUNNABLE: This step isn't ready to run or review yet`,
 * `NOT_IMPLEMENTED`, `duplicate_id` — tiếng Anh, không nói vì sao, và chỉ có một nút "Đóng". Bảng này đổi mã
 * lỗi thành một câu tiếng Việt **kèm hành động kế tiếp**. Nguyên tắc: mọi lỗi phải có ít nhất một việc user
 * làm được; mã kỹ thuật không hiện ra chữ user đọc — nó nằm ở log BE, nơi người sửa lỗi thật sự tìm nó.
 *
 * Khác với `lib/api/error-messages.ts` (dịch câu lỗi theo `code` cho mọi lời gọi API), file này còn quyết
 * định **hành động** và **cách hồi phục** của khu vực workspace.
 */

export type ErrorActionKind = "cancel_and_rerun" | "goto_step" | "retry" | "reload_spine" | "edit_command" | "dismiss";

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

const MESSAGES = { vi, en } as const;

/** Câu theo ngôn ngữ đang hiển thị (`common.friendlyErrors`) — helper này chạy cả ngoài React (callback, throw). */
const translatorFor = (locale: Locale) => createTranslator({ locale, messages: MESSAGES[locale], namespace: "common.friendlyErrors" });

/** "Bước này đang chạy ở lượt trước (bắt đầu 14:02)" — BE đã kèm giờ trong message. */
const startedAtOf = (rawMessage: string): string | null => /bắt đầu (\d{1,2}:\d{2})/.exec(rawMessage)?.[1] ?? null;

/** Step cần xong trước, lấy từ câu của BE ("Cần xong bước S-4.2 trước"). */
const stepIdOf = (rawMessage: string): string | null => /\b([BS]-\d+\.\d+(?:@[\w-]+)?)\b/.exec(rawMessage)?.[1] ?? null;

/**
 * Mã lỗi + câu gốc của BE → thông điệp và hành động. `rawMessage` là câu BE trả (có thể tiếng Việt), chỉ
 * dùng để rút chi tiết (giờ bắt đầu, id step), không hiện thẳng. Regex dưới đây khớp **câu BE**, không phải chữ UI.
 */
export const friendlyError = (code: string, rawMessage = "", locale: Locale = currentLocale()): FriendlyError => {
  const t = translatorFor(locale);
  const RETRY: ErrorAction = { kind: "retry", label: t("actions.retry") };
  const DISMISS: ErrorAction = { kind: "dismiss", label: t("actions.understood") };
  switch (code) {
    case "STEP_NOT_RUNNABLE": {
      const startedAt = startedAtOf(rawMessage);
      if (startedAt || /đang chạy|đang được xử lý/i.test(rawMessage)) {
        return {
          message: startedAt ? t("stepRunningSince", { startedAt }) : t("stepRunning"),
          actions: [{ kind: "cancel_and_rerun", label: t("actions.cancelAndRerun") }]
        };
      }
      const step = stepIdOf(rawMessage);
      if (/chưa tới lượt/i.test(rawMessage) && step) {
        // Tên bước, không phải mã `S-4.2` (FLF-247)
        const name = tStep(step, locale);
        return { message: t("stepPrerequisite", { step: name }), actions: [{ kind: "goto_step", label: t("actions.gotoStep", { step: name }), stepId: step }] };
      }
      if (/đã accepted/i.test(rawMessage)) {
        return { message: t("stepAccepted"), actions: [DISMISS] };
      }
      return { message: t("stepNotRunnable"), actions: [RETRY] };
    }

    case "SPINE_VERSION_CONFLICT":
      return { message: t("spineVersionConflict"), actions: [RETRY], selfHealing: true };

    case "CALL_LIMIT":
      return { message: t("callLimit"), actions: [DISMISS] };

    case "REGENERATE_LIMIT":
      return { message: t("regenerateLimit"), actions: [DISMISS] };

    case "INSUFFICIENT_CREDIT":
      return { message: t("insufficientCredit"), actions: [RETRY] };

    case "NEEDS_USER_INPUT":
      return { message: t("needsUserInput"), actions: [RETRY] };

    case "NOT_IMPLEMENTED":
    case "STREAM_FAILED":
    case "UNKNOWN_ERROR":
      return { message: t("systemError"), actions: [RETRY] };

    case "BASELINE_BLOCKED":
      return { message: t("baselineBlocked"), actions: [{ kind: "dismiss", label: t("actions.viewFlags") }] };

    case "NO_WORKING_DRAFT":
      // FLF-264: tài liệu tự dựng khi đọc ⇒ mã này chỉ còn nghĩa "dự án chưa chạy bước nào", không có việc gì để mời làm
      return { message: t("noWorkingDraft"), actions: [] };

    case "NOT_PIPELINE_SESSION":
      return { message: t("notPipelineSession"), actions: [RETRY] };

    case "ORG_ROLE_FORBIDDEN":
      return { message: t("orgRoleForbidden"), actions: [] };

    case "OP_INVALID":
    case "INVARIANT_VIOLATION":
    case "path_not_resolved":
    case "duplicate_id":
    case "op_not_allowed":
    case "op_out_of_scope":
      return { message: t("opInvalid"), actions: [{ kind: "edit_command", label: t("actions.editCommand") }] };

    case "STREAM_CLOSED":
      return { message: t("streamClosed"), actions: [RETRY] };

    default:
      // Mã có bản dịch, hoặc câu BE đã là câu cho người ⇒ dùng; text kỹ thuật ⇒ câu chung (FLF-247)
      return { message: localizeApiError(code, rawMessage, locale), actions: [RETRY] };
  }
};
