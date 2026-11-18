/**
 * Nguồn tài liệu của yêu cầu (FLF-292) — `GET /projects/:id/sources`. Đồng bộ tay với BE
 * `modules/project/requirement-source.service.ts` (`RequirementSourceView`).
 */

export interface RequirementSourceRef {
  /** `D1-P03` = tài liệu 1, đoạn 3. */
  para_id: string;
  document_id: string;
  /** Tài liệu đã xoá ⇒ `null`; `quote` vẫn còn. */
  document_name: string | null;
  quote: string;
}

export interface RequirementSource {
  /** Phần tử Spine: `functions[id=FN12]`, `nfrs[id=N03]`, `project.vision`. */
  path: string;
  step_id: string;
  updated_at: string;
  refs: RequirementSourceRef[];
}

export interface RequirementSourcesResponse {
  sources: RequirementSource[];
}
