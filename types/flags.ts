import type { FlagLevel, RedFlagRuleId } from "./spine";

export type { Flag, FlagLevel, FlagRuleId, RedFlagRuleId, YellowFlagRuleId } from "./spine";

export interface ListFlagsQuery {
  level?: FlagLevel;
  open?: boolean;
}

/** Luật cờ đỏ không cho waive (`docs/api/pipeline-contract.md` §0.3 `FLAG_NOT_WAIVABLE`). */
export const FLAG_NOT_WAIVABLE_RULES: readonly RedFlagRuleId[] = ["array_empty", "dead_reference", "render_error"];

export const isFlagWaivable = (ruleId: string): boolean =>
  !FLAG_NOT_WAIVABLE_RULES.includes(ruleId as RedFlagRuleId);

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
