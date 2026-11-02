/**
 * Version tài liệu + release mode 1 — bám `flintflow_be/src/modules/doc-version/doc-version.dto.ts` (FLF-171).
 * Import `0.1`; mỗi CR ghi xong lên minor (`0.2`…); release lên major (`1.0`…).
 */
import type { BlockDiffEntry, BlockDiffSummary } from "./import";
import type { Baseline, IsoDateTime } from "./spine";

export type DocVersionKind = "imported" | "cr_revision" | "release";

export interface DocVersion {
  version: string;
  kind: DocVersionKind;
  based_on: string | null;
  cr_ids: string[];
  baseline_id: string | null;
  has_clean_file: boolean;
  /** Mode 1 v3 (BPMN 3.14): có bản Track Changes của CR — tải qua `variant=tracked`. */
  has_tracked_file: boolean;
  /** Có file gốc người dùng upload (bản import 0.1 — FLF-184), tải qua `variant=original`. */
  has_original_file: boolean;
  /**
   * FLF-334 B: tải được theo ngôn ngữ còn lại (`?lang=`) — version có baseline của dự án chuyển từ mode 2. BE luôn gửi;
   * `false` ⇒ ẩn lựa chọn ngôn ngữ.
   */
  other_language_available: boolean;
  created_by: string;
  created_at: IsoDateTime;
}

/**
 * `auto`: release ⇒ bản sạch, draft ⇒ Track Changes + DRAFT (bản 0.1 là bản render từ Spine — FLF-184).
 * `tracked`: luôn bản có Track Changes. `original`: file người dùng upload (chỉ bản 0.1).
 */
export type DownloadVariant = "auto" | "tracked" | "original";
/** `pdf` (FLF-316): chính file .docx của variant đó chuyển ở BE; `original` chỉ có `docx`. */
export type DownloadFormat = "docx" | "pdf";

export interface CompareResponse {
  from: string;
  to: string;
  summary: BlockDiffSummary;
  blocks: BlockDiffEntry[];
}

/** FLF-330 (C-7): gói duyệt — mọi CR đã ghi kể từ lần phát hành trước; bám `doc-version.dto.ts reviewPackageSchema`. */
export type ReviewPackageStatus = "drafting" | "pending" | "changes_requested";

export interface ReviewPackageCr {
  cr_id: string;
  title: string;
  requester: string;
  source: { kind: string; ref: string | null };
  result_doc_version: string | null;
  written_at: IsoDateTime;
}

export interface ReviewPackageSubmission {
  status: "pending" | "rejected";
  submitted_by: string;
  submitted_at: IsoDateTime;
  spine_version: number;
  decided_by: string | null;
  decided_at: IsoDateTime | null;
  reason: string | null;
  rejection_comment_ids: string[];
}

export interface ReviewPackage {
  status: ReviewPackageStatus;
  /** "v0" (chưa phát hành) hoặc số chính gần nhất "1.0". */
  base_version: string | null;
  latest_version: string | null;
  next_version: string | null;
  /** "1.0 · 3 thay đổi chưa duyệt" — chỉ số chính, không số phụ (business-flow §2). */
  draft_label: string;
  change_requests: ReviewPackageCr[];
  red_open: number;
  submission: ReviewPackageSubmission | null;
  spine_version: number;
}

export interface ReleaseRequest {
  base_version: number;
}

export interface ReleaseResponse {
  version: DocVersion;
  baseline: Baseline;
  cr_ids: string[];
  spine_version: number;
}

const VERSION_RE = /^(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

/** Cùng luật `versioning.ts` BE: `x.0` với x ≥ 1 là release. */
export const isReleaseVersion = (version: string): boolean => {
  const m = VERSION_RE.exec(version);
  return !!m && Number(m[1]) >= 1 && m[2] === "0";
};

/** Sắp xếp theo số (0.10 mới hơn 0.9). */
export const compareDocVersions = (a: string, b: string): number => {
  const [am, an] = a.split(".").map(Number);
  const [bm, bn] = b.split(".").map(Number);
  return am - bm || an - bn;
};

/** Bỏ ký tự Windows cấm trong tên file; rỗng ⇒ `SRS` — cùng luật `sanitizeFileBase` BE. */
const sanitizeFileBase = (value: string): string => value.replace(/[\\/:*?"<>|]+/g, "_").trim() || "SRS";

export interface VersionFileNameParts {
  name: string;
  release: boolean;
  /** Release: chính nó. Bản nháp: release gốc (`1.0`, `0` = chưa release); `null` = chưa có gốc (mode 2 chưa baseline). */
  base: string | null;
  latestCr?: string | null;
  tracked?: boolean;
  original?: boolean;
  /** FLF-334 B: chỉ truyền khi khác ngôn ngữ tài liệu ⇒ hậu tố `_EN` / `_VI` cuối tên. */
  language?: string | null;
  ext?: "docx" | "pdf";
}

/**
 * Tên file tải về — bản sao `versionFileName` BE (FLF-334), chỉ dùng khi BE không gửi `Content-Disposition`:
 * `Lumen_v2.0.docx` · `Lumen_v1.0+CR-014_DRAFT.docx` · `Lumen_v0_DRAFT.docx` · `Lumen_DRAFT.docx` · `…_tracked_DRAFT` · `…_original`.
 */
export const versionFileName = (parts: VersionFileNameParts): string => {
  const base = parts.base ? sanitizeFileBase(parts.base.trim().replace(/^v/i, "")) : null;
  const cr = !parts.release && base && parts.latestCr ? `+${sanitizeFileBase(parts.latestCr)}` : "";
  const label = base ? `_v${base}${cr}` : "";
  const tail = parts.original ? "_original" : parts.release ? "" : "_DRAFT";
  const language = parts.language ? `_${sanitizeFileBase(parts.language).toUpperCase()}` : "";
  return `${sanitizeFileBase(parts.name)}${label}${parts.tracked ? "_tracked" : ""}${tail}${language}.${parts.ext ?? "docx"}`;
};

/**
 * Release gốc + CR mới nhất của `target` trong danh sách version (bản sao `versionLineage` BE): gốc = version `x.0` gần
 * nhất trước nó (`0` khi chưa có); CR = mã cuối của version gần nhất (tính cả chính nó, sau gốc) có CR.
 */
export const versionLineage = (
  versions: readonly Pick<DocVersion, "version" | "cr_ids">[],
  target: string
): { release: boolean; base: string; latestCr: string | null } => {
  if (isReleaseVersion(target)) return { release: true, base: target, latestCr: null };
  const history = versions
    .filter((v) => VERSION_RE.test(v.version) && compareDocVersions(v.version, target) <= 0)
    .sort((a, b) => compareDocVersions(b.version, a.version));
  const lastRelease = history.find((v) => isReleaseVersion(v.version)) ?? null;
  const since = lastRelease ? history.slice(0, history.indexOf(lastRelease)) : history;
  const withCr = since.find((v) => v.cr_ids.length > 0);
  return { release: false, base: lastRelease?.version ?? "0", latestCr: withCr ? withCr.cr_ids[withCr.cr_ids.length - 1] : null };
};
