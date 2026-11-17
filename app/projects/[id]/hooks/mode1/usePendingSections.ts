"use client";

import { useEffect, useState } from "react";
import { getPendingSections } from "@/lib/api/change-requests";
import { getPreviewPendingSections } from "@/lib/api/spine";
import type { PendingSection } from "@/types/change-request";

/** Làm mới định kỳ: đề xuất của người khác đổi mà tab này không có tín hiệu nào khác. */
const POLL_MS = 30_000;

/**
 * BF §3.2 "Người khác mở chỗ đó thấy dòng *BA1 có bản sửa chưa xác nhận ở mục này*": mục nào của tài liệu đang có
 * đề xuất của CR chưa đóng, ai giữ — theo `section_id`. Chỉ tải ở project mode 1 (`enabled`).
 */
export function usePendingSections(projectId: string, enabled: boolean, refreshToken = 0, source: "cr" | "preview" = "cr"): Map<string, PendingSection> {
  const [map, setMap] = useState<Map<string, PendingSection>>(() => new Map());
  useEffect(() => {
    if (!enabled || !projectId) return;
    let alive = true;
    const load = () =>
      // Trước baseline (`preview`): bản xem trước sửa qua chat chưa áp của người khác — BE không trả `title`
      (source === "cr" ? getPendingSections(projectId) : getPreviewPendingSections(projectId).then((r) => ({ ...r, data: r.data?.map((s) => ({ ...s, title: "" })) })))
        .then((r) => {
          if (alive && r.data) setMap(new Map(r.data.map((s) => [s.section_id, s])));
        })
        .catch(() => undefined);
    void load();
    const timer = window.setInterval(() => void load(), POLL_MS);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, [projectId, enabled, refreshToken, source]);
  return map;
}
