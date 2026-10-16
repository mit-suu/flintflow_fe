"use client";

import { useCallback, useEffect, useState } from "react";
import { listFlags } from "@/lib/api/flags";
import { listVersions } from "@/lib/api/versions";
import type { DocVersion } from "@/types/doc-version";
import { errorText } from "../../_components/mode1/errors";

interface Options {
  /**
   * Đếm cờ đỏ đang mở hay không. Chỉ panel Release cần (BR-04 chặn release); popup so sánh version thì
   * không — bật thừa là thêm một `GET /flags` và gộp lỗi của nó vào `error` của danh sách version.
   */
  redFlags?: boolean;
}

/**
 * Version tài liệu mode 1 (UC-57): danh sách (mới nhất trước) + số cờ đỏ đang mở (chặn Release — BR-04, mode 1 không
 * waive). Mode 1 v2 (FLF-185): nội dung tài liệu xem ở `DocumentPane` (render từ Spine), không còn xem theo block.
 *
 * `loading` là **lượt tải đầu chưa xong**, khác với "tải xong mà không có version nào". Chỗ gọi nào dựng
 * state khởi tạo từ `versions` phải chờ `loading === false`, nếu không nó khởi tạo từ mảng rỗng và giữ
 * nguyên giá trị rỗng đó (`useState` chỉ đọc initializer ở lần render đầu).
 */
export function useDocVersions(projectId: string, { redFlags = true }: Options = {}) {
  const [versions, setVersions] = useState<DocVersion[]>([]);
  const [redOpen, setRedOpen] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // `loading` chỉ hạ một lần, ở lượt tải đầu: không nâng lại đầu mỗi `reload` vì `reload` chạy trong
  // effect, mà đặt state đồng bộ trong effect là cascading render (`react-hooks/set-state-in-effect`).
  const reload = useCallback(
    () =>
      Promise.all([
        listVersions(projectId).then((res) => setVersions(res.data ?? [])),
        redFlags
          ? listFlags(projectId, { level: "red", open: true }).then((res) => setRedOpen((res.data ?? []).filter((f) => f.level === "red").length))
          : Promise.resolve(),
      ])
        .then(() => setError(null))
        .catch((err: unknown) => setError(errorText(err, "Không tải được danh sách version")))
        .finally(() => setLoading(false)),
    [projectId, redFlags]
  );

  useEffect(() => {
    void reload();
  }, [reload]);

  return { versions, redOpen, loading, error, reload };
}
