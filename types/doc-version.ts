/**
 * Version tài liệu + release mode 1 — bám `flintflow_be/src/modules/doc-version/doc-version.dto.ts` (FLF-171).
 * Import `0.0`; mỗi CR ghi xong lên minor (`0.1`…); release lên major (`1.0`…).
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
  created_by: string;
  created_at: IsoDateTime;
}

/** `auto`: release ⇒ bản sạch, draft ⇒ Track Changes + DRAFT. `tracked`: luôn bản có Track Changes. */
export type DownloadVariant = "auto" | "tracked";

export interface CompareResponse {
  from: string;
  to: string;
  summary: BlockDiffSummary;
  blocks: BlockDiffEntry[];
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
