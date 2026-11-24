"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { deleteProjectDocument, listProjectDocuments } from "@/lib/api/documents";
import type { ProjectDocument } from "@/types/document";

/**
 * Tài liệu tham khảo của dự án (`GET /documents`): tải khi mở workspace và mỗi lần `refreshToken` đổi (vd vừa đính kèm
 * xong ở ô chat). Dùng chung cho số trên nút "Tài liệu" và danh sách trong popup, để hai chỗ không tải đôi, không lệch số.
 */
export function useProjectDocuments(projectId: string, refreshToken = 0) {
  const [docs, setDocs] = useState<ProjectDocument[] | null>(null);
  const [error, setError] = useState<unknown>(null);

  // Hai lượt tải chồng nhau (refreshToken đổi + reload sau khi thêm) ⇒ chỉ lượt gọi sau cùng được ghi, kết quả cũ về muộn không
  // đè danh sách mới (E2E 24/11 #1)
  const seq = useRef(0);
  const reload = useCallback(async () => {
    const mine = ++seq.current;
    try {
      const res = await listProjectDocuments(projectId);
      if (mine !== seq.current) return;
      setDocs(res.data ?? []);
      setError(null);
    } catch (err) {
      if (mine === seq.current) setError(err);
    }
  }, [projectId]);

  useEffect(() => {
    // Lùi một microtask: không đặt state đồng bộ trong effect (react-hooks/set-state-in-effect)
    void Promise.resolve().then(reload);
  }, [reload, refreshToken]);

  /** Xoá trên BE rồi bỏ khỏi danh sách; lỗi ném lại cho nơi gọi hiện thông báo. */
  const remove = useCallback(
    async (documentId: string) => {
      await deleteProjectDocument(projectId, documentId);
      setDocs((prev) => (prev ?? []).filter((d) => d._id !== documentId));
    },
    [projectId],
  );

  return { docs, error, reload, remove };
}
