/**
 * Dịch tài liệu theo lô (FLF-265) — `pipeline-contract.md` #26, #27. Ngôn ngữ đích mặc định là ngôn ngữ tài liệu của dự án
 * (`Project.documentLanguage`); `locale` (FLF-334 B) chọn ngôn ngữ khác — để tải file theo ngôn ngữ còn lại. Spine không đổi: chữ dịch nằm ở lớp bản dịch ngoài Spine, khoá theo
 * hash chữ gốc — nên dịch xong `spine_version` giữ nguyên, nơi gọi tự tải lại tài liệu.
 */
import type { TranslationRunResult, TranslationStatus } from "@/types/document";
import type { DocumentLanguage } from "@/types/project";
import { apiCall } from "./client";

/**
 * FLF-334 B — phạm vi của #26 / #27: ngôn ngữ đích (bỏ trống ⇒ ngôn ngữ tài liệu) + đích snapshot của lượt tải vừa bị 409
 * `TRANSLATION_INCOMPLETE`: `baselineId` (mode 2, baseline đang xuất) hoặc `version` (mode 1, DocVersion có baseline). Có
 * đích ⇒ BE đếm / dịch đúng snapshot đó, nên "Dịch nốt" xoá đúng phần lượt tải kiểm.
 */
export interface TranslationScope {
  locale?: DocumentLanguage;
  baselineId?: string;
  version?: string;
}

const scopeFields = (scope: TranslationScope): Record<string, string> => ({
  ...(scope.locale ? { locale: scope.locale } : {}),
  ...(scope.baselineId ? { baseline_id: scope.baselineId } : scope.version ? { version: scope.version } : {}),
});

/** `GET /translations/status` — đếm phần chưa dịch + ước tính credit, không gọi model; mọi vai trò đọc được. */
export const getTranslationStatus = (projectId: string, scope: TranslationScope = {}) => {
  const query = new URLSearchParams(scopeFields(scope)).toString();
  return apiCall<TranslationStatus>(`/projects/${projectId}/translations/status${query ? `?${query}` : ""}`);
};

/**
 * `POST /translations/run` — dịch tối đa `maxBatches` lô (BE nhận 1–10, bỏ trống ⇒ 5) phần còn thiếu; chỉ Lead/Analyst.
 * Nơi gọi lặp tới `remaining = 0` HOẶC `translated = 0` (lô không tiến ⇒ dừng, khỏi trả credit lặp). Lỗi riêng:
 * 402 `INSUFFICIENT_CREDIT` (phần đã dịch giữ), 409 `TRANSLATION_RUNNING`, 422 `PARSE_FAILED` / `SCHEMA_MISMATCH`,
 * 403 `ORG_ROLE_FORBIDDEN`; với `scope`: 409 `DOCUMENT_LANGUAGE_UNAVAILABLE`.
 */
export const runTranslation = (projectId: string, maxBatches?: number, scope: TranslationScope = {}) =>
  apiCall<TranslationRunResult>(`/projects/${projectId}/translations/run`, {
    method: "POST",
    body: JSON.stringify({ ...(maxBatches === undefined ? {} : { max_batches: maxBatches }), ...scopeFields(scope) }),
  });
