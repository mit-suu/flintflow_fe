"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ApiClientError } from "@/lib/api/client";
import {
  confirmLatest,
  finalizeImport,
  getImport,
  patchFields,
  patchMapping,
  resumeImport,
  startExtraction,
  uploadImport,
} from "@/lib/api/import";
import { getSpine } from "@/lib/api/spine";
import type { RocRow } from "@/types/document";
import type { FieldsPatchRequest, FinalizeResponse, GetImportResponse, MappingPatchRequest } from "@/types/import";
import { errorText } from "../../_components/mode1/errors";
import { IMPORT_DONE_STATUSES } from "../../_components/mode1/labels";

/** Nhịp poll `GET /import` khi I-4 chạy nền (#6/#10 trả ngay). */
export const EXTRACT_POLL_MS = 2000;

export type ImportAction = "upload" | "confirm" | "mapping" | "extract" | "fields" | "finalize" | "resume";

/**
 * Trạng thái wizard import (UC-19–UC-22). Nguồn sự thật là `GET /import`; mỗi hành động gọi API rồi đọc lại.
 * I-4 và finalize (1.10–1.12) chạy nền: sau khi bật job thì poll tới khi import rời `extracting` / tới `gap_review`, hoặc
 * bị `paused`.
 */
export function useImport(projectId: string, { pollMs = EXTRACT_POLL_MS }: { pollMs?: number } = {}) {
  const [data, setData] = useState<GetImportResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<ImportAction | null>(null);
  /** Đã bấm bắt đầu/tiếp tục trong phiên này — BE có thể chưa kịp ghi `extract_cursor` ở lần poll đầu. */
  const [jobStarted, setJobStarted] = useState(false);
  /** Đã bấm tạo baseline / tiếp tục bước baseline–kiểm trong phiên này (BE không báo `baselining` nào đang có job). */
  const [finalizeStarted, setFinalizeStarted] = useState(false);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const reload = useCallback(
    () =>
      getImport(projectId)
        .then((res) => {
          if (!alive.current) return;
          setData(res.data);
          setError(null);
        })
        .catch((err: unknown) => alive.current && setError(errorText(err, "Không tải được trạng thái import")))
        .finally(() => alive.current && setLoading(false)),
    [projectId]
  );

  useEffect(() => {
    void reload();
  }, [reload]);

  const doc = data?.import ?? null;
  const extracting = doc?.status === "extracting" && !doc.paused;
  const jobRunning = extracting && (jobStarted || doc?.extract_cursor !== null);
  // `checking` không dừng luôn là job nền đang chạy (BE đặt `paused` khi job mất); `baselining` chỉ khi phiên này đã bấm
  const finalizing = !!doc && !doc.paused && (doc.status === "checking" || (doc.status === "baselining" && finalizeStarted));
  /** Job baseline–kiểm bấm trong phiên này đã xong (`gap_review`) — wizard chuyển sang gap report. */
  const finalizeDone = finalizeStarted && !!doc && IMPORT_DONE_STATUSES.includes(doc.status);

  // Poll khi job nền đang chạy; dừng khi rời `extracting` / tới `gap_review`, bị pause, hoặc rời trang
  useEffect(() => {
    if (!jobRunning && !finalizing) return;
    const timer = setTimeout(() => void reload(), pollMs);
    return () => clearTimeout(timer);
  }, [jobRunning, finalizing, data, pollMs, reload]);

  const run = useCallback(
    async <T,>(action: ImportAction, fn: () => Promise<T>): Promise<T | null> => {
      setBusy(action);
      setError(null);
      try {
        const result = await fn();
        await reload();
        return result;
      } catch (err) {
        // Preflight từ chối vẫn tạo bản ghi import (`preflight_rejected` + issues) ⇒ đọc lại để hiện danh sách lỗi
        if (err instanceof ApiClientError && err.code === "IMPORT_FILE_REJECTED") await reload();
        else setError(errorText(err));
        if (err instanceof ApiClientError && err.code === "SPINE_VERSION_CONFLICT") await reload();
        return null;
      } finally {
        if (alive.current) setBusy(null);
      }
    },
    [reload]
  );

  const importId = doc?.id ?? "";

  return {
    data,
    doc,
    loading,
    error,
    busy,
    jobRunning,
    finalizing,
    finalizeDone,
    reload,
    clearError: () => setError(null),
    upload: (file: File) => run("upload", () => uploadImport(projectId, file)),
    confirm: () => run("confirm", () => confirmLatest(projectId, importId)),
    saveMapping: (body: Omit<MappingPatchRequest, "import_id">) =>
      run("mapping", () => patchMapping(projectId, { ...body, import_id: importId })),
    extract: () =>
      run("extract", async () => {
        const res = await startExtraction(projectId, importId);
        setJobStarted(true);
        return res;
      }),
    resume: () =>
      run("resume", async () => {
        const res = await resumeImport(projectId, importId);
        // #10 chạy nền ở cả ba bước: `extracting` (I-4), `baselining` (chạy lại finalize), `checking` (1.11–1.12)
        if (res.data?.import.status === "extracting") setJobStarted(true);
        else setFinalizeStarted(true);
        return res;
      }),
    saveFields: (body: Omit<FieldsPatchRequest, "import_id">) =>
      run("fields", () => patchFields(projectId, { ...body, import_id: importId })),
    /**
     * 1.10–1.12: baseline 0.0 + kiểm. `base_version` = `spine_version` đọc ngay trước khi gửi. `recordOfChanges` (FLF-252):
     * dòng Record of Changes người dùng đã sửa ở wizard — bỏ trống ⇒ BE dùng dòng đọc từ file. BE trả ngay (`baselining`),
     * job chạy nền ⇒ poll `GET /import` tới `gap_review` (`finalizeDone`) hoặc `paused`.
     */
    finalize: (recordOfChanges?: RocRow[]) =>
      run("finalize", async (): Promise<FinalizeResponse | null> => {
        const spine = await getSpine(projectId);
        const res = await finalizeImport(projectId, importId, spine.data?.spine_version ?? 0, recordOfChanges);
        setFinalizeStarted(true);
        return res.data;
      }),
  };
}
