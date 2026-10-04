"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { resumeProject } from "@/lib/api/pipeline";
import { getSpine } from "@/lib/api/spine";
import type { Spine } from "@/types/spine";
import { userErrorMessage } from "@/lib/api/error-messages";

export interface UseSpineResult {
  spine: Spine | null;
  version: number | null;
  loading: boolean;
  error: string | null;
  /** Trả `spine_version` vừa đọc (null ⇒ lỗi, hoặc đã có lần đọc mới hơn thay thế) để nơi gọi cập nhật `base_version` ngay. */
  reload: () => Promise<number | null>;
  /** Nhận Spine mới từ response ghi (ApplyResult) mà không gọi lại API. */
  replace: (spine: Spine) => void;
}

/** Không lùi về bản cũ hơn bản đang giữ của cùng project (response về trễ). */
const newer = (current: Spine | null, next: Spine): Spine =>
  current && current.projectId === next.projectId && current.spine_version > next.spine_version ? current : next;

/** `GET /projects/:id/spine`; `version` là `spine_version` dùng làm `base_version` khi ghi. */
export function useSpine(projectId: string, enabled = true): UseSpineResult {
  const [spine, setSpine] = useState<Spine | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Chỉ response của lần gọi mới nhất được áp — reload chồng nhau không ghi đè bằng dữ liệu cũ
  const requestRef = useRef(0);

  const reload = useCallback(() => {
    const request = ++requestRef.current;
    return getSpine(projectId)
      .then((res) => {
        if (request !== requestRef.current) return null;
        const next = res.data;
        setSpine((current) => (next ? newer(current, next) : next));
        setError(null);
        return next?.spine_version ?? null;
      })
      .catch((err: unknown): null => {
        if (request === requestRef.current) setError(userErrorMessage(err, "Không tải được dữ liệu tài liệu"));
        return null;
      })
      .finally(() => {
        if (request === requestRef.current) setLoading(false);
      });
  }, [projectId]);

  const replace = useCallback((next: Spine) => {
    requestRef.current++;
    setSpine((current) => newer(current, next));
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!enabled || !projectId) return;
    // Mở workspace: BE revert step bỏ dở giữa Draft (endpoint 24) rồi mới đọc Spine; resume lỗi không chặn tải.
    void resumeProject(projectId)
      .catch(() => undefined)
      .then(() => reload());
  }, [enabled, projectId, reload]);

  return { spine, version: spine?.spine_version ?? null, loading, error, reload, replace };
}
