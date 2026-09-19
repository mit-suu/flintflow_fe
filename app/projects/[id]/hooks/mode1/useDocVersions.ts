"use client";

import { useCallback, useEffect, useState } from "react";
import { listFlags } from "@/lib/api/flags";
import { listVersions } from "@/lib/api/versions";
import type { DocVersion } from "@/types/doc-version";
import { errorText } from "../../_components/mode1/errors";

/**
 * Version tài liệu mode 1 (UC-57): danh sách (mới nhất trước) + số cờ đỏ đang mở (chặn Release — BR-04, mode 1 không
 * waive). Mode 1 v2 (FLF-185): nội dung tài liệu xem ở `DocumentPane` (render từ Spine), không còn xem theo block.
 */
export function useDocVersions(projectId: string) {
  const [versions, setVersions] = useState<DocVersion[]>([]);
  const [redOpen, setRedOpen] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(
    () =>
      Promise.all([
        listVersions(projectId).then((res) => setVersions(res.data ?? [])),
        listFlags(projectId, { level: "red", open: true }).then((res) => setRedOpen((res.data ?? []).filter((f) => f.level === "red").length)),
      ])
        .then(() => setError(null))
        .catch((err: unknown) => setError(errorText(err, "Không tải được danh sách version"))),
    [projectId]
  );

  useEffect(() => {
    void reload();
  }, [reload]);

  return { versions, redOpen, error, reload };
}
