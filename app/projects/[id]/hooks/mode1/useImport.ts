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
import type { FieldsPatchRequest, FinalizeResponse, GetImportResponse, MappingPatchRequest } from "@/types/import";
import { errorText } from "../../_components/mode1/errors";

/** Nhịp poll `GET /import` khi I-4 chạy nền (#6/#10 trả ngay). */
export const EXTRACT_POLL_MS = 2000;

export type ImportAction = "upload" | "confirm" | "mapping" | "extract" | "fields" | "finalize" | "resume";

/**
 * Trạng thái wizard import (UC-19–UC-22). Nguồn sự thật là `GET /import`; mỗi hành động gọi API rồi đọc lại.
 * I-4 chạy nền: sau khi bật job thì poll tới khi import rời `extracting` hoặc bị `paused`.
 */
export function useImport(projectId: string, { pollMs = EXTRACT_POLL_MS }: { pollMs?: number } = {}) {
  const [data, setData] = useState<GetImportResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<ImportAction | null>(null);
  /** Đã bấm bắt đầu/tiếp tục trong phiên này — BE có thể chưa kịp ghi `extract_cursor` ở lần poll đầu. */
  const [jobStarted, setJobStarted] = useState(false);
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

  // Poll khi job nền đang chạy; dừng khi rời `extracting`, bị pause, hoặc rời trang
  useEffect(() => {
    if (!jobRunning) return;
    const timer = setTimeout(() => void reload(), pollMs);
    return () => clearTimeout(timer);
  }, [jobRunning, data, pollMs, reload]);

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
        setJobStarted(true);
        return res;
      }),
    saveFields: (body: Omit<FieldsPatchRequest, "import_id">) =>
      run("fields", () => patchFields(projectId, { ...body, import_id: importId })),
    /** 1.10–1.12: baseline 0.0 + kiểm. `base_version` = `spine_version` đọc ngay trước khi gửi. */
    finalize: () =>
      run("finalize", async (): Promise<FinalizeResponse | null> => {
        const spine = await getSpine(projectId);
        const res = await finalizeImport(projectId, importId, spine.data?.spine_version ?? 0);
        return res.data;
      }),
  };
}
