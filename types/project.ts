export type ProjectStatus = "active" | "archived";

/**
 * Project theo `project.model.ts` BE. Các field `currentStep/currentPhase/workspacePhase/
 * baselineVersion/progressPercent` là legacy (section-based), còn tới T21.
 */
export interface Project {
  _id: string;
  name: string;
  domain?: string | null;
  status: ProjectStatus;
  currentStep: string;
  currentPhase?: number;
  workspacePhase?: string;
  baselineVersion?: string | null;
  progressPercent: number;
  createdAt: string;
  updatedAt: string;
}
