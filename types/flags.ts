import type { FlagLevel, RedFlagRuleId } from "./spine";

export type { Flag, FlagLevel, FlagRuleId, RedFlagRuleId, YellowFlagRuleId } from "./spine";

export interface ListFlagsQuery {
  level?: FlagLevel;
  open?: boolean;
}

/**
 * Luật kỹ thuật không có cả "Giữ nguyên + lý do" lẫn waive — chỉ sửa dữ liệu. FLF-329 (BR-04): **mọi cờ đỏ** không
 * waive được; cờ đỏ còn lại chỉ có "Giữ nguyên + lý do" (`keepFlag`, cờ vẫn chặn), cờ vàng mới waive được.
 */
export const FLAG_NOT_WAIVABLE_RULES: readonly RedFlagRuleId[] = ["array_empty", "dead_reference", "render_error"];

/** Có nút xử lý (giữ nguyên với đỏ, bỏ qua với vàng) — không phải "waive được" theo nghĩa BE. */
export const isFlagWaivable = (ruleId: string): boolean =>
  !FLAG_NOT_WAIVABLE_RULES.includes(ruleId as RedFlagRuleId);

/** Cờ đang mở theo luật BR-04: cờ đỏ chỉ đóng khi sửa xong — waive / giữ nguyên không làm nó hết chặn. */
export const isOpenFlag = (flag: { level: FlagLevel; resolved_at: string | null; waived_by_user: boolean }): boolean =>
  !flag.resolved_at && (flag.level === "red" || !flag.waived_by_user);

// ─── traceability (GET /projects/:id/traceability) ────────────────

export type TraceabilityEntity =
  | "actor"
  | "use_case"
  | "function"
  | "screen"
  | "entity"
  | "nfr"
  | "feature"
  | "business_rule";

export interface TraceabilityQuery {
  entity: TraceabilityEntity;
  id: string;
}

export interface TraceabilityNode {
  kind: TraceabilityEntity;
  id: string;
  label: string;
}

export interface TraceabilityEdge {
  from: string;
  to: string;
  field: string;
}

export interface TraceabilityResponse {
  nodes: TraceabilityNode[];
  edges: TraceabilityEdge[];
}

