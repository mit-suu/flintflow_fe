/**
 * Version tài liệu + release mode 1 (#12–#15, #31 `docs/api/import-change-contract.md`).
 */
import type { DocBlock } from "@/types/import";
import type { DocumentLanguage } from "@/types/project";
import type { CompareResponse, DocVersion, DownloadFormat, DownloadVariant, ReleaseResponse, ReviewPackage } from "@/types/doc-version";
import { apiCall } from "./client";
import { fetchFile } from "./files";

const base = (projectId: string) => `/projects/${projectId}`;

/** Mới nhất trước. */
export const listVersions = (projectId: string) => apiCall<DocVersion[]>(`${base(projectId)}/versions`);

export const getVersionBlocks = (projectId: string, version: string) =>
  apiCall<DocBlock[]>(`${base(projectId)}/versions/${encodeURIComponent(version)}/blocks`);

export const compareVersions = (projectId: string, from: string, to: string) =>
  apiCall<CompareResponse>(
    `${base(projectId)}/versions/compare?${new URLSearchParams({ from, to }).toString()}`
  );

/**
 * `auto`: release ⇒ bản sạch, draft ⇒ Track Changes + DRAFT. `format=pdf` (FLF-316) là chính file đó chuyển
 * ở BE — `503 PDF_EXPORT_UNAVAILABLE` khi bộ chuyển không sẵn sàng; `docx` vẫn tải được. `lang` (FLF-334 B): chỉ cho
 * version `other_language_available`; thiếu bản dịch ⇒ `409 TRANSLATION_INCOMPLETE` (`meta { locale, missing, total }`).
 */
export const downloadVersion = (
  projectId: string,
  version: string,
  variant: DownloadVariant = "auto",
  format: DownloadFormat = "docx",
  lang?: DocumentLanguage
) =>
  fetchFile(
    `${base(projectId)}/versions/${encodeURIComponent(version)}/download?variant=${variant}${format === "pdf" ? "&format=pdf" : ""}${lang ? `&lang=${lang}` : ""}`
  );

// ─── gói duyệt (FLF-330, C-7) ───

export const getReviewPackage = (projectId: string) => apiCall<ReviewPackage>(`${base(projectId)}/review-package`);

/** BA gửi Lead duyệt cả gói: 422 `RELEASE_RED_FLAGS_OPEN`, 409 `PACKAGE_EMPTY` / `PACKAGE_ALREADY_SUBMITTED`. */
export const submitReviewPackage = (projectId: string, baseVersion: number) =>
  apiCall<ReviewPackage>(`${base(projectId)}/review-package/submit`, { method: "POST", body: JSON.stringify({ base_version: baseVersion }) });

/** Lead yêu cầu sửa kèm lý do (≥ 10 ký tự) ⇒ mở khoá bản nháp. */
export const requestPackageChanges = (projectId: string, baseVersion: number, reason: string) =>
  apiCall<ReviewPackage>(`${base(projectId)}/review-package/request-changes`, { method: "POST", body: JSON.stringify({ base_version: baseVersion, reason }) });

/** 422 `RELEASE_RED_FLAGS_OPEN` mang `meta.flags[]`. Lead duyệt cả gói = phát hành (FLF-330). */
export const releaseDocument = (projectId: string, baseVersion: number) =>
  apiCall<ReleaseResponse>(`${base(projectId)}/release`, {
    method: "POST",
    body: JSON.stringify({ base_version: baseVersion }),
  });
