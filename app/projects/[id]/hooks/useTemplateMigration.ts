"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ApiClientError } from "@/lib/api/client";
import { userErrorMessage } from "@/lib/api/error-messages";
import {
  applyTemplateMigration,
  cancelTemplateMigration,
  confirmMigrationMapping,
  getTemplateMigration,
  listTemplateMigrations,
  markMigrationReady,
  patchMigrationDecisions,
  patchMigrationMapping,
  patchMigrationPairs,
  restoreTemplateMigration,
  revertTemplateMigration,
  startTemplateMigration,
} from "@/lib/api/template-migration";
import { isOpenMigration, type BatchAction, type MappingEdit, type Migration, type MigrationDecision, type MigrationSummary, type PairEdit, type StartMigrationInput } from "@/types/template-migration";

export type MigrationAction = "start" | "pairs" | "confirm" | "decisions" | "ready" | "cancel" | "apply" | "revert" | "mapping" | "restore";

/** Điều kiện chặn bắt đầu đổi mẫu mà FE biết trước (BE vẫn kiểm lại và trả mã lỗi tương ứng). */
export interface UseTemplateMigrationOptions {
  /** Tải chi tiết lần đổi mẫu mở / vừa áp dụng (màn đổi mẫu). Panel công cụ chỉ cần danh sách. */
  detail?: boolean;
  /** `false` ⇒ không gọi BE (vai trò không đổi mẫu được). */
  enabled?: boolean;
  /** Fallback khi lỗi không có câu hiện được cho người dùng. */
  fallbackError: string;
}

export interface UseTemplateMigration {
  loading: boolean;
  summaries: MigrationSummary[];
  /** Lần đổi mẫu đang mở, hoặc lần mới nhất đã áp dụng (hiện kết quả + nút hoàn tác). */
  current: Migration | null;
  /** Lần mới nhất kết thúc ở `applied` (chưa hoàn tác) — cho nút "Hoàn tác lần đổi mẫu". */
  latestApplied: MigrationSummary | null;
  open: MigrationSummary | null;
  busy: MigrationAction | null;
  error: string | null;
  /** 409 `TEMPLATE_MIGRATION_LINKS_BROKEN`: liên kết sẽ gãy nếu áp dụng. */
  brokenLinks: string[];
  /** 409 `TEMPLATE_MIGRATION_REVERT_BLOCKED`: đã có thay đổi ghi sau lần đổi mẫu — dùng đổi mẫu ngược. */
  revertBlocked: boolean;
  /** Có thay đổi dữ liệu giữa chừng (409 STALE): đã quay về bước quyết định. */
  stale: boolean;
  reload: () => Promise<void>;
  start: (input: StartMigrationInput) => Promise<Migration | null>;
  editPairs: (pairs: PairEdit[]) => Promise<Migration | null>;
  editMapping: (edits: MappingEdit[]) => Promise<Migration | null>;
  restore: () => Promise<Migration | null>;
  confirmMapping: () => Promise<Migration | null>;
  decide: (change: { decisions?: MigrationDecision[]; batch?: BatchAction }) => Promise<Migration | null>;
  markReady: () => Promise<Migration | null>;
  cancel: () => Promise<Migration | null>;
  apply: () => Promise<Migration | null>;
  revert: () => Promise<Migration | null>;
  clearNotices: () => void;
}

/** `GET` trả mới nhất trước: lần kết thúc gần nhất (không tính huỷ / lỗi) quyết định còn hoàn tác được không. */
const endedOf = (list: MigrationSummary[]): MigrationSummary | null => list.find((s) => !isOpenMigration(s.state) && s.state !== "cancelled" && s.state !== "failed") ?? null;

/** Lỗi cho biết trạng thái lần đổi mẫu đã khác lúc FE đọc — đọc lại thay vì để màn lệch. */
const RELOAD_CODES: ReadonlySet<string> = new Set(["TEMPLATE_MIGRATION_CONFLICT", "TEMPLATE_MIGRATION_INVALID_STATE", "TEMPLATE_MIGRATION_OPEN", "TEMPLATE_MIGRATION_APPLYING"]);

const violationsOf = (err: ApiClientError): string[] => {
  const raw = err.meta?.violations;
  if (!Array.isArray(raw)) return [];
  return raw.map((v) => (typeof v === "string" ? v : typeof (v as { message?: unknown })?.message === "string" ? (v as { message: string }).message : JSON.stringify(v)));
};

/**
 * Trạng thái một lần đổi mẫu của dự án. BE là nguồn sự thật: mọi thao tác trả lại `Migration` đầy đủ, hook chỉ giữ bản mới nhất.
 * Mã lỗi có nghĩa riêng (409 STALE / LINKS_BROKEN / REVERT_BLOCKED) được tách thành cờ để màn hình hiện đúng chỗ.
 */
export function useTemplateMigration(projectId: string, { detail = false, enabled = true, fallbackError }: UseTemplateMigrationOptions): UseTemplateMigration {
  const [loading, setLoading] = useState(true);
  const [summaries, setSummaries] = useState<MigrationSummary[]>([]);
  const [current, setCurrent] = useState<Migration | null>(null);
  const [busy, setBusy] = useState<MigrationAction | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [brokenLinks, setBrokenLinks] = useState<string[]>([]);
  const [revertBlocked, setRevertBlocked] = useState(false);
  const [stale, setStale] = useState(false);
  const fallback = useRef(fallbackError);
  const alive = useRef(true);
  useEffect(() => {
    fallback.current = fallbackError;
  }, [fallbackError]);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const open = summaries.find((s) => isOpenMigration(s.state)) ?? null;
  const latestEnded = endedOf(summaries);
  const latestApplied = latestEnded?.state === "applied" ? latestEnded : null;

  const reload = useCallback(async () => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    try {
      const list = await listTemplateMigrations(projectId);
      if (!alive.current) return;
      setSummaries(list);
      const target = list.find((s) => isOpenMigration(s.state)) ?? endedOf(list);
      setCurrent(detail && target?.state !== undefined && (isOpenMigration(target.state) || target.state === "applied") ? await getTemplateMigration(projectId, target.id) : null);
      setError(null);
    } catch (err) {
      if (alive.current) setError(userErrorMessage(err, fallback.current));
    } finally {
      if (alive.current) setLoading(false);
    }
  }, [projectId, detail, enabled]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- tải lần đầu theo dự án
    void reload();
  }, [reload]);

  const clearNotices = useCallback(() => {
    setError(null);
    setBrokenLinks([]);
    setRevertBlocked(false);
    setStale(false);
  }, []);

  const run = useCallback(
    async (action: MigrationAction, fn: () => Promise<Migration>): Promise<Migration | null> => {
      setBusy(action);
      clearNotices();
      try {
        const next = await fn();
        if (!alive.current) return next;
        setCurrent(next);
        // Danh sách tóm tắt chỉ cần cho điều kiện mở / hoàn tác — đọc lại sau khi trạng thái đổi
        void listTemplateMigrations(projectId)
          .then((list) => alive.current && setSummaries(list))
          .catch(() => undefined);
        return next;
      } catch (err) {
        if (!alive.current) return null;
        if (err instanceof ApiClientError) {
          if (err.code === "TEMPLATE_MIGRATION_LINKS_BROKEN") setBrokenLinks(violationsOf(err));
          if (err.code === "TEMPLATE_MIGRATION_REVERT_BLOCKED") setRevertBlocked(true);
          // Dữ liệu đổi giữa chừng: BE đã đưa lần đổi mẫu về bước quyết định — đọc lại để màn hiện đúng trạng thái
          if (err.code === "TEMPLATE_MIGRATION_STALE") {
            setStale(true);
            await reload();
          } else if (RELOAD_CODES.has(err.code)) {
            // Người khác vừa đổi / đóng lần đổi mẫu này: đọc lại để màn hiện đúng trạng thái
            await reload();
          }
        }
        setError(userErrorMessage(err, fallback.current));
        return null;
      } finally {
        if (alive.current) setBusy(null);
      }
    },
    [projectId, reload, clearNotices]
  );

  const id = current?.id ?? open?.id ?? "";
  return {
    loading,
    summaries,
    current,
    latestApplied,
    open,
    busy,
    error,
    brokenLinks,
    revertBlocked,
    stale,
    reload,
    clearNotices,
    start: (input) => run("start", () => startTemplateMigration(projectId, input)),
    editPairs: (pairs) => run("pairs", () => patchMigrationPairs(projectId, id, pairs)),
    editMapping: (edits) => run("mapping", () => patchMigrationMapping(projectId, id, edits)),
    restore: () => run("restore", () => restoreTemplateMigration(projectId, id)),
    confirmMapping: () => run("confirm", () => confirmMigrationMapping(projectId, id)),
    decide: (change) => run("decisions", () => patchMigrationDecisions(projectId, id, change)),
    markReady: () => run("ready", () => markMigrationReady(projectId, id)),
    cancel: () => run("cancel", () => cancelTemplateMigration(projectId, id)),
    apply: () => run("apply", () => applyTemplateMigration(projectId, id)),
    revert: () => run("revert", () => revertTemplateMigration(projectId, latestApplied?.id ?? id)),
  };
}
