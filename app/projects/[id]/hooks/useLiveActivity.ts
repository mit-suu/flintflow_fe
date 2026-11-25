"use client";

import { useCallback, useState } from "react";
import type { SpineWrittenEvent } from "@/types/project-events";

/** Giữ tối đa chừng này dòng trong phiên — lịch sử đầy đủ đã có ở lịch sử version / Record of Changes. */
export const LIVE_ACTIVITY_LIMIT = 50;

export interface LiveActivity {
  /** Mới nhất đứng đầu. */
  items: readonly SpineWrittenEvent[];
  /** Số dòng nhận sau lần mở chuông gần nhất. */
  unseen: number;
  push: (event: SpineWrittenEvent) => void;
  markSeen: () => void;
}

/**
 * Hoạt động ghi của người khác trong phiên đang mở (FLF-487, tab "Dự án này" của chuông workspace). Chỉ nằm trong state:
 * tải lại trang là mất (user chốt 25/11: không lưu DB).
 */
export function useLiveActivity(): LiveActivity {
  const [items, setItems] = useState<readonly SpineWrittenEvent[]>([]);
  const [unseen, setUnseen] = useState(0);
  const push = useCallback((event: SpineWrittenEvent) => {
    setItems((current) => [event, ...current].slice(0, LIVE_ACTIVITY_LIMIT));
    setUnseen((n) => Math.min(n + 1, LIVE_ACTIVITY_LIMIT));
  }, []);
  const markSeen = useCallback(() => setUnseen(0), []);
  return { items, unseen, push, markSeen };
}
