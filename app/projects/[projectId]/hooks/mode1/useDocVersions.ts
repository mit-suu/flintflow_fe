"use client";

import { useCallback, useEffect, useState } from "react";
import { listFlags } from "@/lib/api/flags";
import { getVersionBlocks, listVersions } from "@/lib/api/versions";
import type { DocVersion } from "@/types/doc-version";
import type { DocBlock } from "@/types/import";
import { errorText } from "../../_components/mode1/errors";

/**
 * Version tài liệu mode 1 (UC-54): danh sách (mới nhất trước), block của version đang xem, số cờ đỏ đang mở
 * (chặn Release — BR-04, mode 1 không waive). Mặc định xem version mới nhất.
 */
export function useDocVersions(projectId: string) {
  const [versions, setVersions] = useState<DocVersion[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [blocks, setBlocks] = useState<DocBlock[] | null>(null);
  const [redOpen, setRedOpen] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(
    () =>
      Promise.all([
        listVersions(projectId).then((res) => {
          const list = res.data ?? [];
          setVersions(list);
          // Giữ version đang xem nếu còn; không thì nhảy về bản mới nhất
          setSelected((cur) => (cur && list.some((v) => v.version === cur) ? cur : (list[0]?.version ?? null)));
        }),
        listFlags(projectId, { level: "red", open: true }).then((res) => setRedOpen((res.data ?? []).filter((f) => f.level === "red").length)),
      ])
        .then(() => setError(null))
        .catch((err: unknown) => setError(errorText(err, "Không tải được danh sách version"))),
    [projectId]
  );

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    if (!selected) return;
    let cancelled = false;
    getVersionBlocks(projectId, selected)
      .then((res) => !cancelled && setBlocks(res.data ?? []))
      .catch((err: unknown) => !cancelled && setError(errorText(err, `Không tải được bản ${selected}`)));
    return () => {
      cancelled = true;
    };
  }, [projectId, selected]);

  return {
    versions,
    selected,
    select: (version: string) => {
      setBlocks(null);
      setSelected(version);
    },
    blocks,
    redOpen,
    error,
    reload,
    /** Sau release/CR: về bản mới nhất. */
    showLatest: async () => {
      setSelected(null);
      await reload();
    },
  };
}
