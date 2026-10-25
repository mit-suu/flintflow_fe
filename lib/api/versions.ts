/**
 * Version tài liệu + release mode 1 (#12–#15, #31 `docs/api/import-change-contract.md`).
 */
import type { DocBlock } from "@/types/import";
import type { CompareResponse, DocVersion, DownloadFormat, DownloadVariant, ReleaseResponse } from "@/types/doc-version";
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
 * ở BE — `503 PDF_EXPORT_UNAVAILABLE` khi bộ chuyển không sẵn sàng; `docx` vẫn tải được.
 */
export const downloadVersion = (projectId: string, version: string, variant: DownloadVariant = "auto", format: DownloadFormat = "docx") =>
  fetchFile(`${base(projectId)}/versions/${encodeURIComponent(version)}/download?variant=${variant}${format === "pdf" ? "&format=pdf" : ""}`);

/** 422 `RELEASE_RED_FLAGS_OPEN` mang `meta.flags[]`. */
export const releaseDocument = (projectId: string, baseVersion: number) =>
  apiCall<ReleaseResponse>(`${base(projectId)}/release`, {
    method: "POST",
    body: JSON.stringify({ base_version: baseVersion }),
  });
