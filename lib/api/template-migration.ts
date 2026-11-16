/**
 * Đổi mẫu của dự án sau baseline (`import-change-contract.md` §Đổi mẫu). Route dự án: chỉ Lead / Analyst. Lỗi giữ nguyên `code` qua
 * `ApiClientError` (`TEMPLATE_MIGRATION_STALE`, `…_LINKS_BROKEN`, `…_REVERT_BLOCKED`…).
 */
import type { BatchAction, MappingEdit, Migration, MigrationDecision, MigrationSummary, PairEdit, StartMigrationInput } from "@/types/template-migration";
import { apiCall } from "./client";

const unwrap = <T>(res: { data: T | null }): T => {
  if (res.data === null) throw new Error("Empty template migration response");
  return res.data;
};
const json = (method: string, body?: unknown): RequestInit => ({ method, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
const base = (projectId: string) => `/projects/${projectId}/template-migrations`;
const one = (projectId: string, migrationId: string) => `${base(projectId)}/${migrationId}`;

const startBody = (input: StartMigrationInput): RequestInit => {
  if (input.kind === "template") return json("POST", { template_id: input.template_id, version: input.version });
  const form = new FormData();
  form.append("file", input.file);
  if (input.publish_to_org) {
    form.append("publish_to_org", "true");
    if (input.name) form.append("name", input.name);
    if (input.template_id) form.append("template_id", input.template_id);
  }
  return { method: "POST", body: form };
};

export const startTemplateMigration = async (projectId: string, input: StartMigrationInput): Promise<Migration> =>
  unwrap(await apiCall<Migration>(base(projectId), startBody(input)));
export const listTemplateMigrations = async (projectId: string): Promise<MigrationSummary[]> =>
  unwrap(await apiCall<MigrationSummary[]>(base(projectId)));
export const getTemplateMigration = async (projectId: string, migrationId: string): Promise<Migration> =>
  unwrap(await apiCall<Migration>(one(projectId, migrationId)));
export const patchMigrationPairs = async (projectId: string, migrationId: string, pairs: PairEdit[]): Promise<Migration> =>
  unwrap(await apiCall<Migration>(`${one(projectId, migrationId)}/pairs`, json("PATCH", { pairs })));
export const confirmMigrationMapping = async (projectId: string, migrationId: string): Promise<Migration> =>
  unwrap(await apiCall<Migration>(`${one(projectId, migrationId)}/confirm-mapping`, json("POST")));
export const patchMigrationDecisions = async (
  projectId: string,
  migrationId: string,
  change: { decisions?: MigrationDecision[]; batch?: BatchAction }
): Promise<Migration> => unwrap(await apiCall<Migration>(`${one(projectId, migrationId)}/decisions`, json("PATCH", change)));
export const markMigrationReady = async (projectId: string, migrationId: string): Promise<Migration> =>
  unwrap(await apiCall<Migration>(`${one(projectId, migrationId)}/ready`, json("POST")));
export const cancelTemplateMigration = async (projectId: string, migrationId: string): Promise<Migration> =>
  unwrap(await apiCall<Migration>(`${one(projectId, migrationId)}/cancel`, json("POST")));
export const applyTemplateMigration = async (projectId: string, migrationId: string): Promise<Migration> =>
  unwrap(await apiCall<Migration>(`${one(projectId, migrationId)}/apply`, json("POST")));
export const revertTemplateMigration = async (projectId: string, migrationId: string): Promise<Migration> =>
  unwrap(await apiCall<Migration>(`${one(projectId, migrationId)}/revert`, json("POST")));
export const patchMigrationMapping = async (projectId: string, migrationId: string, edits: MappingEdit[]): Promise<Migration> =>
  unwrap(await apiCall<Migration>(`${one(projectId, migrationId)}/mapping`, json("PATCH", { edits })));
/** Áp dụng kẹt (`apply_failed`): khôi phục bản nháp về trước lần đổi mẫu. */
export const restoreTemplateMigration = async (projectId: string, migrationId: string): Promise<Migration> =>
  unwrap(await apiCall<Migration>(`${one(projectId, migrationId)}/restore`, json("POST")));
