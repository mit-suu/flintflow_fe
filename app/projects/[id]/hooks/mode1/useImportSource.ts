"use client";

import { useEffect, useState } from "react";
import { getImportSource } from "@/lib/api/import";
import type { ImportSourceSection } from "@/types/import";

interface Cached {
  etag: string | null;
  sections: ImportSourceSection[];
}

/** Chỉ giữ lần import gần nhất: chữ gốc file lớn có thể hàng trăm nghìn ký tự. Mở lại màn ⇒ hiện ngay, hỏi BE bằng ETag. */
let cache: { key: string; value: Cached } | null = null;

/**
 * Chữ gốc của file theo mục (`GET /import/source`) cho màn đọc file. Tải MỘT lần mỗi lần import — không đi theo nhịp poll.
 * Lỗi tải ⇒ `sections = null`: màn vẫn chạy, chỉ thiếu phần chữ gốc.
 */
export function useImportSource(projectId: string, importId: string | null, enabled: boolean): { sections: ImportSourceSection[] | null } {
  const key = importId ? `${projectId}:${importId}` : null;
  const [loaded, setLoaded] = useState<{ key: string; sections: ImportSourceSection[] } | null>(null);

  useEffect(() => {
    if (!enabled || !key) return;
    const cached = cache?.key === key ? cache.value : null;
    let cancelled = false;
    getImportSource(projectId, cached?.etag)
      .then((res) => {
        if (cancelled) return;
        if (res.notModified) {
          if (cached) setLoaded({ key, sections: cached.sections });
          return;
        }
        cache = { key, value: { etag: res.etag, sections: res.data.sections } };
        setLoaded({ key, sections: res.data.sections });
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [projectId, key, enabled]);

  if (!key) return { sections: null };
  if (loaded?.key === key) return { sections: loaded.sections };
  return { sections: cache?.key === key ? cache.value.sections : null };
}
