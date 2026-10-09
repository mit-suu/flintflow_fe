/**
 * Dịch tài liệu theo lô (FLF-265) — `pipeline-contract.md` #26, #27. Ngôn ngữ đích là ngôn ngữ tài liệu của dự án
 * (`Project.documentLanguage`), không có tham số. Spine không đổi: chữ dịch nằm ở lớp bản dịch ngoài Spine, khoá theo
 * hash chữ gốc — nên dịch xong `spine_version` giữ nguyên, nơi gọi tự tải lại tài liệu.
 */
import type { TranslationRunResult, TranslationStatus } from "@/types/document";
import { apiCall } from "./client";

/** `GET /translations/status` — đếm phần chưa dịch + ước tính credit, không gọi model; mọi vai trò đọc được. */
export const getTranslationStatus = (projectId: string) =>
  apiCall<TranslationStatus>(`/projects/${projectId}/translations/status`);

/**
 * `POST /translations/run` — dịch tối đa `maxBatches` lô (BE nhận 1–10, bỏ trống ⇒ 5) phần còn thiếu; chỉ Lead/Analyst.
 * Nơi gọi lặp tới `remaining = 0` HOẶC `translated = 0` (lô không tiến ⇒ dừng, khỏi trả credit lặp). Lỗi riêng:
 * 402 `INSUFFICIENT_CREDIT` (phần đã dịch giữ), 409 `TRANSLATION_RUNNING`, 422 `PARSE_FAILED` / `SCHEMA_MISMATCH`,
 * 403 `ORG_ROLE_FORBIDDEN`.
 */
export const runTranslation = (projectId: string, maxBatches?: number) =>
  apiCall<TranslationRunResult>(`/projects/${projectId}/translations/run`, {
    method: "POST",
    body: JSON.stringify(maxBatches === undefined ? {} : { max_batches: maxBatches }),
  });
