/**
 * Sự kiện của luồng SSE `GET /projects/:id/events` (FLF-487, pipeline-contract #56). Phản chiếu
 * `flintflow_be/src/shared/realtime/project-events.ts`.
 */

export type SpineWriteSource = "cr" | "edit" | "step" | "undo" | "system";

export interface SpineWrittenEvent {
  type: "spine_written";
  project_id: string;
  /** Chỉ để biết có bản mới hơn — KHÔNG dùng làm `base_version`. */
  spine_version: number;
  actor_user_id: string | null;
  actor_name: string | null;
  source: SpineWriteSource;
  cr_id: string | null;
  /** Id section (owner) bị ghi, tối đa 8. */
  sections: string[];
  more: number;
  at: string;
}

export interface NotificationCreatedEvent {
  type: "notification_created";
  notification_id: string;
  organization_id: string | null;
  at: string;
}

export type ProjectStreamEvent =
  | { type: "ready"; spine_version: number }
  | { type: "bye"; reason: "bye" | "replaced" }
  | SpineWrittenEvent
  | NotificationCreatedEvent;
