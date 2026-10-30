"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { libraryMatches } from "@/lib/api/org-library";
import type { LibraryMatch } from "@/types/org-library";

export interface UseLibraryMatches {
  matches: LibraryMatch[];
  /** Theo `section_id` của tài liệu (`custom:CT_…`). */
  matchOf: (sectionId: string) => LibraryMatch | undefined;
  /** Gợi ý cho mục còn trống — nút "áp tất cả" chỉ dùng nhóm này. */
  emptyMatches: LibraryMatch[];
  reload: () => void;
}

/**
 * FLF-278 đợt 3: mục riêng của mẫu khách trùng tiêu đề với thư viện nội dung của tổ chức. Chỉ dự án mẫu khách mới hỏi;
 * tải lại khi tài liệu đổi (`refreshToken`). Lỗi tải ⇒ không gợi ý gì (không chặn việc khác).
 */
export function useLibraryMatches(projectId: string, enabled: boolean, refreshToken: number): UseLibraryMatches {
  const [matches, setMatches] = useState<LibraryMatch[]>([]);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    libraryMatches(projectId)
      .then((list) => !cancelled && setMatches(list))
      .catch(() => !cancelled && setMatches([]));
    return () => {
      cancelled = true;
    };
  }, [projectId, enabled, refreshToken, tick]);

  const byId = useMemo(() => new Map(matches.map((m) => [`custom:${m.custom_section_id}`, m])), [matches]);
  const matchOf = useCallback((sectionId: string) => byId.get(sectionId), [byId]);
  const emptyMatches = useMemo(() => matches.filter((m) => m.empty), [matches]);
  const reload = useCallback(() => setTick((n) => n + 1), []);
  return { matches: enabled ? matches : [], matchOf, emptyMatches: enabled ? emptyMatches : [], reload };
}
