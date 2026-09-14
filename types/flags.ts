import type { FlagLevel } from "./spine";

export type { Flag, FlagLevel, FlagRuleId, RedFlagRuleId, YellowFlagRuleId } from "./spine";

export interface ListFlagsQuery {
  level?: FlagLevel;
  open?: boolean;
}

/** Dữ liệu legacy `GET /verification/projects/:id` — T16 thay bằng flags + progress. */
export interface VerificationData {
  readinessScore?: number;
  readinessLevel?: "discuss" | "plan" | "blocked" | "ready";
  completenessPercent?: number;
  blockingIssues?: string[];
  facts?: Array<{ statement: string; source?: string }>;
  assumptions?: Array<{ statement: string; status?: "confirmed" | "pending" }>;
  goalAlignmentPercent?: number;
}
