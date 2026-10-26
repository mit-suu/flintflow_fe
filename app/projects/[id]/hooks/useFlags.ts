"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { keepFlag, listFlags, recomputeFlags, waiveFlag } from "@/lib/api/flags";
import type { Flag } from "@/types/flags";
import { userErrorMessage } from "@/lib/api/error-messages";
import { HOOK_ERROR } from "@/lib/hook-errors";

export interface UseFlagsResult {
  flags: Flag[];
  loading: boolean;
  error: string | null;
  busy: boolean;
  reload: () => Promise<void>;
  waive: (flagId: string, reason: string) => Promise<void>;
  /** FLF-329: giữ nguyên + lý do — cờ vẫn mở. */
  keep: (flagId: string, reason: string) => Promise<void>;
  recompute: () => Promise<void>;
}

/** `GET /flags`, tải lại mỗi khi `spineVersion` đổi (ops mới có thể mở/đóng cờ). */
export function useFlags(projectId: string, spineVersion: number | null): UseFlagsResult {
  const [flags, setFlags] = useState<Flag[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Chỉ response của lần gọi mới nhất được áp — reload chồng nhau (đổi spineVersion liên tiếp)
  // không bị ghi đè bằng dữ liệu cũ về trễ (cùng pattern `useSpine.ts`).
  const requestRef = useRef(0);

  const reload = useCallback(() => {
    const request = ++requestRef.current;
    setLoading(true);
    return listFlags(projectId)
      .then((res) => {
        if (request !== requestRef.current) return;
        setFlags(res.data ?? []);
        setError(null);
      })
      .catch((err: unknown) => {
        if (request === requestRef.current) setError(userErrorMessage(err, HOOK_ERROR.flagsLoadFailed));
      })
      .finally(() => {
        if (request === requestRef.current) setLoading(false);
      });
  }, [projectId]);

  useEffect(() => {
    if (!projectId || spineVersion === null) return;
    // Lùi một microtask: `reload()` tự `setLoading(true)` đồng bộ (T1) — gọi thẳng trong effect bị
    // lint `react-hooks/set-state-in-effect` chặn (cùng pattern `EditHistory.tsx`).
    queueMicrotask(() => void reload());
  }, [projectId, spineVersion, reload]);

  const waive = useCallback(
    async (flagId: string, reason: string) => {
      setBusy(true);
      try {
        const res = await waiveFlag(projectId, flagId, reason);
        if (res.data) {
          const updated = res.data;
          setFlags((prev) => prev.map((f) => (f.id === updated.id ? updated : f)));
        }
        setError(null);
      } catch (err) {
        setError(userErrorMessage(err, HOOK_ERROR.waiveFailed));
        throw err;
      } finally {
        setBusy(false);
      }
    },
    [projectId]
  );

  const keep = useCallback(
    async (flagId: string, reason: string) => {
      setBusy(true);
      try {
        const res = await keepFlag(projectId, flagId, reason);
        if (res.data) {
          const updated = res.data;
          setFlags((prev) => prev.map((f) => (f.id === updated.id ? updated : f)));
        }
        setError(null);
      } catch (err) {
        setError(userErrorMessage(err, HOOK_ERROR.keepFailed));
        throw err;
      } finally {
        setBusy(false);
      }
    },
    [projectId]
  );

  const recompute = useCallback(async () => {
    setBusy(true);
    try {
      const res = await recomputeFlags(projectId);
      setFlags(res.data ?? []);
      setError(null);
    } catch (err) {
      setError(userErrorMessage(err, HOOK_ERROR.recomputeFailed));
    } finally {
      setBusy(false);
    }
  }, [projectId]);

  return { flags, loading, error, busy, reload, waive, keep, recompute };
}
