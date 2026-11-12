"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { cancelScreenMockupRun, getScreenMockupRun } from "@/lib/api/projects";
import type { ScreenMockupRunView } from "@/types/project";

/** Nhịp hỏi tiến độ khi đang có lượt chạy — một màn vẽ mất vài chục giây. */
export const RUN_POLL_MS = 3000;

export interface UseScreenMockupRun {
  run: ScreenMockupRunView | null;
  /** Lượt vừa bắt đầu (POST trả 202) — hiện ngay, bắt đầu hỏi tiến độ. */
  started: (view: ScreenMockupRunView) => void;
  cancel: () => Promise<void>;
  /** Ẩn thẻ kết quả của lượt đã xong. */
  dismiss: () => void;
  /** Đang có lượt chạy (chưa xong). */
  running: boolean;
}

/**
 * Tiến độ "Vẽ lại bằng mockup" chạy nền (FLF-410). Mở trang ⇒ đọc lượt gần nhất (đang chạy dở từ trước thì tiếp tục theo
 * dõi). Đang chạy ⇒ hỏi lại mỗi `RUN_POLL_MS`; mỗi lần số màn xong tăng ⇒ `onProgress` (trang tải lại tài liệu để màn vừa
 * xong hiện mockup ngay). Lượt đã kết thúc từ phiên trước không hiện thẻ kết quả.
 */
export function useScreenMockupRun(projectId: string, enabled: boolean, onProgress: () => void): UseScreenMockupRun {
  const [run, setRun] = useState<ScreenMockupRunView | null>(null);
  const progressRef = useRef(onProgress);
  const seenRef = useRef<{ id: string; completed: number; status: string } | null>(null);
  useEffect(() => {
    progressRef.current = onProgress;
  }, [onProgress]);

  const apply = useCallback((view: ScreenMockupRunView | null, initial = false) => {
    // Lượt cũ đã xong: không bật lại thẻ kết quả. Đã có lượt (người dùng vừa bấm chạy) ⇒ kết quả đọc lúc mở trang về muộn
    // không được đè lên, kể cả `null`
    if (initial && ((view && view.status !== "running") || seenRef.current)) return;
    const seen = seenRef.current;
    if (view && seen && seen.id === view.run_id && (seen.completed !== view.completed || seen.status !== view.status)) progressRef.current();
    seenRef.current = view ? { id: view.run_id, completed: view.completed, status: view.status } : null;
    setRun(view);
  }, []);

  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    getScreenMockupRun(projectId).then(
      (res) => alive && apply(res.data, true),
      () => undefined
    );
    return () => {
      alive = false;
    };
  }, [projectId, enabled, apply]);

  const running = run?.status === "running";
  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => {
      getScreenMockupRun(projectId).then(
        (res) => apply(res.data),
        () => undefined
      );
    }, RUN_POLL_MS);
    return () => clearInterval(timer);
  }, [projectId, running, apply]);

  const started = useCallback((view: ScreenMockupRunView) => apply(view), [apply]);
  const cancel = useCallback(async () => {
    const res = await cancelScreenMockupRun(projectId);
    apply(res.data);
  }, [projectId, apply]);
  const dismiss = useCallback(() => {
    seenRef.current = null;
    setRun(null);
  }, []);

  return { run, started, cancel, dismiss, running };
}
