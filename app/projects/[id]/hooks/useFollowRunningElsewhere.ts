"use client";

import { useEffect } from "react";
import { getActiveRunState } from "@/lib/api/pipeline";
import type { RunState } from "@/types/pipeline";

/** Nhịp hỏi BE khi bước đang chạy ở lượt không do tab này mở — cùng nhịp với watchdog của `useStepRunner`. */
export const FOLLOW_TICK_MS = 5_000;
/**
 * BE nói "không có lượt sống" liên tiếp chừng này nhịp mà `running` vẫn bật ⇒ run-state và `/steps` lệch nhau; dừng hỏi để
 * không tải lại trang mỗi 5 giây mãi. `active` tắt rồi bật lại (bước khác chạy) thì hook bắt đầu đếm lại.
 */
export const MAX_SETTLED_STREAK = 3;

export interface UseFollowRunningElsewhereOptions {
  /** Bước đang xem `running` nhưng runner của tab này `idle` (`stepRunningElsewhere`). */
  active: boolean;
  projectId: string;
  /** `useStepRunner.restore` — dựng lại lượt còn sống; runner hết `idle` thì hook tự dừng. */
  restore: () => Promise<RunState | null>;
  /** Không còn lượt sống ⇒ BE đã xong: tải lại steps / tiến độ / Spine để `running` tắt và cổng hoặc câu hỏi hiện ra. */
  onSettled: () => void;
}

/**
 * Tab mở giữa lượt chạy (tải lại, tab thứ hai, chuỗi giai đoạn chạy nền) chỉ biết bước `running` qua `GET /steps`, mà
 * `/steps` chỉ tải lại khi `spine_version` đổi — không stream, không poll ⇒ ô chat đứng "AI đang làm…" tới khi user tự tải
 * lại (FLF-235). Hook này hỏi `GET /run-state/active` mỗi nhịp khi `active`:
 * - lượt còn sống ⇒ `restore()` (runner thành `busy`/`restored`, watchdog sẵn có theo tiếp; `active` tắt nên hook dừng);
 * - không có lượt sống ⇒ `onSettled()` tải lại; `running` tắt thì `active` tắt. Quá `MAX_SETTLED_STREAK` lần liên tiếp ⇒ dừng;
 * - lỗi mạng ⇒ không biết gì, chờ nhịp sau (không tải lại).
 * Không tạo lượt chạy mới, không tốn credit. Hook chỉ chạy khi runner `idle`, watchdog chỉ khi `busy` — không gọi API đôi.
 */
export function useFollowRunningElsewhere({ active, projectId, restore, onSettled }: UseFollowRunningElsewhereOptions): void {
  useEffect(() => {
    if (!active || !projectId) return;
    let cancelled = false;
    let inFlight = false;
    let settledStreak = 0;
    const timer = setInterval(() => {
      if (inFlight || cancelled) return;
      inFlight = true;
      void getActiveRunState(projectId)
        .then((res) => res.data)
        .then(
          async (run) => {
            if (cancelled) return;
            if (run?.alive) {
              settledStreak = 0;
              await restore();
              return;
            }
            settledStreak += 1;
            onSettled();
            if (settledStreak >= MAX_SETTLED_STREAK) clearInterval(timer);
          },
          () => undefined
        )
        .finally(() => {
          inFlight = false;
        });
    }, FOLLOW_TICK_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [active, projectId, restore, onSettled]);
}
