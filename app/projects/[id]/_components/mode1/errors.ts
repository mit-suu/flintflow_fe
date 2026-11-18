/**
 * Đổi lỗi API mode 1 thành câu cho user theo ngôn ngữ giao diện (`mode1.errors.*`). Mã không có trong bảng ⇒ dùng
 * thông điệp của BE, không nuốt lỗi. Component gọi `L.errorText(err, fallback)` (`useMode1Labels()`); hook ghi lỗi trong
 * effect dùng `useErrorText()`.
 */
import { ApiClientError } from "@/lib/api/client";
import type { CrNoLocationsMeta, PathLockedMeta } from "@/types/change-request";
import { userErrorMessage } from "@/lib/api/error-messages";
import type { Mode1BaseLabels } from "./i18n";

/** Mã lỗi có câu riêng của FE (`mode1.errors.codes.<mã>`). */
const FRIENDLY_CODES: readonly string[] = [
  "INSUFFICIENT_CREDIT",
  "SPINE_VERSION_CONFLICT",
  "PROJECT_MODE_MISMATCH",
  "IMPORT_STAMP_FOREIGN_PROJECT",
  "IMPORT_NEEDS_LATEST_CONFIRM",
  "CR_REQUIRES_BASELINE",
  "RELEASE_RED_FLAGS_OPEN",
  "CR_VALUE_CHANGED",
  "CORE_STEP_REQUIRED",
  "STEP_NOT_IN_PLAN",
  "BASELINE_BLOCKED",
  "RATE_LIMIT_EXCEEDED",
  "AI_PROVIDER_ERROR",
  // Mode 1 v3 (bám BPMN — import xong mọi sửa qua CR)
  "MODE1_NO_STEPS",
  "MODE1_NO_SIGNOFF",
  "MODE1_NO_WAIVE",
  "IMPORT_REUPLOAD_NO_STAMP",
  "CR_NO_OWNER_STEP",
  "PREVIEW_EXPIRED",
  "CR_NOTHING_TO_APPROVE",
];

export const errorText = (err: unknown, L: Pick<Mode1BaseLabels, "t" | "pathLabel">, fallback?: string): string => {
  const { t } = L;
  const fb = fallback ?? t("errors.generic");
  if (err instanceof ApiClientError) {
    if (err.code === "PATH_LOCKED") {
      const locked = (err.meta as PathLockedMeta | undefined)?.locked ?? [];
      if (locked.length) {
        return t("errors.pathLocked", { items: locked.map((l) => `${L.pathLabel(l.path)} (${l.cr_id})`).join(", ") });
      }
    }
    if (err.code === "CR_NO_LOCATIONS") {
      // C-3 ra 0 vị trí — mode 1 v3 không còn step, lối ra duy nhất là sửa mô tả CR rồi làm rõ lại
      const empty = (err.meta as CrNoLocationsMeta | undefined)?.empty_sections ?? [];
      if (empty.length) return t("errors.noLocationsIn", { sections: empty.map((s) => `"${s.title}"`).join(", ") });
      return t("errors.noLocations");
    }
    // `||` chứ không phải `??`: BE trả `message: ""` là chuỗi RỖNG — hộp lỗi không được hiện trắng. Câu BE rỗng hoặc
    // kỹ thuật ⇒ `fallback` (FLF-247).
    if (FRIENDLY_CODES.includes(err.code)) return t(`errors.codes.${err.code}`);
    return userErrorMessage(err, fb);
  }
  return userErrorMessage(err, fb);
};

export const errorCode = (err: unknown): string | null => (err instanceof ApiClientError ? err.code : null);
