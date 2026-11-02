"use client";

import type { TemplateIntent } from "@/types/project";
import { useCallback, useEffect, useRef, useState } from "react";
import { ApiClientError } from "@/lib/api/client";
import { continueImportFlow2, finalizeImport, getImport, resumeImport, startExtraction, uploadImport } from "@/lib/api/import";
import { getSpine } from "@/lib/api/spine";
import { importFromOrgTemplate } from "@/lib/api/org-library";
import type { FinalizeResponse, GetImportResponse, ImportStatus } from "@/types/import";
import { useErrorText } from "../../_components/mode1/i18n";
import { IMPORT_DONE_STATUSES } from "../../_components/mode1/labels";

/** Nhịp poll `GET /import` khi lượt import chạy nền (#6/#10 trả ngay). */
export const EXTRACT_POLL_MS = 2000;

export type ImportAction = "upload" | "start" | "finalize" | "resume";

/** Bước chạy nền của lượt một mạch (FLF-343): trích ⇒ tạo bản gốc 0.1 ⇒ kiểm tra. */
const PIPELINE_STATUSES: readonly ImportStatus[] = ["baselining", "checking"];

/**
 * Trạng thái wizard import (FLF-343 — chế độ 1 chạy một mạch). Nguồn sự thật là `GET /import`; mỗi hành động gọi API rồi đọc
 * lại. Chỉ một điểm dừng: màn báo credit (`extracting` chưa chạy) với nút Bắt đầu; sau đó I-4 ⇒ baseline 0.1 ⇒ kiểm tra chạy
 * nền trên BE, FE poll tới `gap_review` (⇒ trang tạo CR), `incomplete` (chế độ 3/4) hoặc `paused`.
 */
export function useImport(projectId: string, { pollMs = EXTRACT_POLL_MS }: { pollMs?: number } = {}) {
  const [data, setData] = useState<GetImportResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<ImportAction | null>(null);
  /** Đã bấm Bắt đầu / Tiếp tục trong phiên này — BE có thể chưa kịp ghi `extract_cursor` ở lần poll đầu. */
  const [started, setStarted] = useState(false);
  const alive = useRef(true);
  const errText = useErrorText();

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
        .catch((err: unknown) => alive.current && setError(errText(err, "loadImport")))
        .finally(() => alive.current && setLoading(false)),
    [projectId, errText]
  );

  useEffect(() => {
    void reload();
  }, [reload]);

  const doc = data?.import ?? null;
  /**
   * BE không trả ước tính (`credit_estimate: null`) cho `extracting` khi job nền đang chạy — tải lại trang giữa lúc bấm Bắt đầu
   * và lần ghi cursor đầu thì vẫn biết là đang chạy (không hiện lại màn Bắt đầu, vẫn poll).
   */
  const serverRunning = doc?.status === "extracting" && !doc.paused && data?.credit_estimate === null;
  /** Màn báo credit: `extracting` chưa chạy lần nào (bản ghi cũ: `awaiting_latest_confirm` / `mapping_review`). */
  const awaitingStart =
    !!doc &&
    !doc.paused &&
    !started &&
    !serverRunning &&
    (doc.status === "awaiting_latest_confirm" || doc.status === "mapping_review" || (doc.status === "extracting" && doc.extract_cursor === null));
  /**
   * Job nền đang chạy: trích (đã bấm hoặc đã có cursor), tạo bản gốc, kiểm tra. `baselining` / `checking` không dừng luôn là
   * job đang chạy (BE đặt `paused: resume_later` khi job mất).
   */
  const running =
    !!doc &&
    !doc.paused &&
    ((doc.status === "extracting" && (started || serverRunning || doc.extract_cursor !== null)) || PIPELINE_STATUSES.includes(doc.status));
  /** Lượt bấm trong phiên này đã chạy xong tới trang tạo CR. */
  const done = started && !!doc && IMPORT_DONE_STATUSES.includes(doc.status);

  // Poll khi job nền đang chạy; dừng khi xong / dừng / rời trang
  useEffect(() => {
    if (!running) return;
    const timer = setTimeout(() => void reload(), pollMs);
    return () => clearTimeout(timer);
  }, [running, data, pollMs, reload]);

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
        else setError(errText(err));
        if (err instanceof ApiClientError && err.code === "SPINE_VERSION_CONFLICT") await reload();
        return null;
      } finally {
        if (alive.current) setBusy(null);
      }
    },
    [reload, errText]
  );

  const importId = doc?.id ?? "";

  return {
    data,
    doc,
    loading,
    error,
    busy,
    awaitingStart,
    running,
    done,
    reload,
    clearError: () => setError(null),
    upload: (file: File, intent?: TemplateIntent) =>
      run("upload", async () => {
        setStarted(false);
        return uploadImport(projectId, file, intent);
      }),
    /** FLF-278: dùng mẫu đã lưu của tổ chức thay cho tải file — mapping áp sẵn. */
    pickOrgTemplate: (orgTemplateId: string, intent?: TemplateIntent) =>
      run("upload", async () => {
        setStarted(false);
        return importFromOrgTemplate(projectId, orgTemplateId, intent);
      }),
    /** Nút Bắt đầu: một mạch I-4 ⇒ baseline 0.1 ⇒ kiểm tra. `confirmLatest` = câu trả lời "đây là bản mới nhất". */
    start: (confirmLatest: boolean) =>
      run("start", async () => {
        const res = await startExtraction(projectId, importId, confirmLatest);
        setStarted(true);
        return res;
      }),
    /** #10 chạy nền ở mọi bước đang dừng; chạy tiếp tới cùng đích (trang tạo CR). */
    resume: () =>
      run("resume", async () => {
        const res = await resumeImport(projectId, importId);
        setStarted(true);
        return res;
      }),
    /** FLF-336: màn "Kết quả đọc file" (`incomplete`) — Hoàn thiện ⇒ chạy tiếp tới baseline. */
    complete: () =>
      run("finalize", async (): Promise<FinalizeResponse | null> => {
        const spine = await getSpine(projectId);
        const res = await finalizeImport(projectId, importId, spine.data?.spine_version ?? 0, undefined, { complete: true });
        setStarted(true);
        return res.data;
      }),
    /** FLF-278: chế độ 3 ⇒ Luồng 2. Thành công ⇒ dự án thành `fpt`, FE mở workspace (không poll import nữa). */
    continueFlow2: () =>
      run("finalize", async () => {
        const spine = await getSpine(projectId);
        return (await continueImportFlow2(projectId, importId, spine.data?.spine_version ?? 0)).data;
      }),
  };
}
