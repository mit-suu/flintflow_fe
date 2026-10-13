"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createComment, listComments, resolveComment } from "@/lib/api/comments";
import type { Comment, CommentResolutionInput, CreateCommentInput } from "@/types/comment";
import { userErrorMessage } from "@/lib/api/error-messages";

export interface UseCommentsResult {
  /** Luôn là danh sách `status=all` — panel tự lọc, khỏi gọi lại BE mỗi lần đổi tab. */
  comments: Comment[];
  loading: boolean;
  error: string | null;
  busy: boolean;
  reload: () => Promise<void>;
  create: (input: CreateCommentInput) => Promise<Comment | null>;
  resolve: (commentId: string, resolution: CommentResolutionInput) => Promise<void>;
  /** Số comment đang mở theo `anchor.section_id` — `DocumentPane` vẽ chấm số trên từng mục. */
  openCountBySection: ReadonlyMap<string, number>;
}

/**
 * Nguồn comment duy nhất của workspace (UC-49), sống ở `page.tsx` rồi truyền xuống — cùng lối với
 * `useFlags`, để `DocumentPane` và panel không giữ hai bản state lệch nhau.
 *
 * Tải lại khi `spineVersion` đổi: lô op mới có thể làm chỗ ghim không còn trong bản đang đọc.
 */
export function useComments(projectId: string, spineVersion: number | null): UseCommentsResult {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Chỉ response của lần gọi mới nhất được áp (cùng pattern `useFlags.ts` / `useSpine.ts`).
  const requestRef = useRef(0);

  const reload = useCallback(() => {
    const request = ++requestRef.current;
    setLoading(true);
    return listComments(projectId, "all")
      .then((res) => {
        if (request !== requestRef.current) return;
        setComments(res.data ?? []);
        setError(null);
      })
      .catch((err: unknown) => {
        if (request === requestRef.current) setError(userErrorMessage(err, "Không tải được danh sách góp ý"));
      })
      .finally(() => {
        if (request === requestRef.current) setLoading(false);
      });
  }, [projectId]);

  useEffect(() => {
    if (!projectId || spineVersion === null) return;
    // Lùi một microtask: `reload()` gọi `setLoading(true)` đồng bộ, gọi thẳng trong effect bị
    // `react-hooks/set-state-in-effect` chặn (cùng cách `useFlags.ts` làm).
    queueMicrotask(() => void reload());
  }, [projectId, spineVersion, reload]);

  const create = useCallback(
    async (input: CreateCommentInput) => {
      setBusy(true);
      try {
        const res = await createComment(projectId, input);
        if (res.data) setComments((prev) => [...prev, res.data as Comment]);
        setError(null);
        return res.data ?? null;
      } catch (err) {
        // 422 COMMENT_ANCHOR_NOT_FOUND: chỗ ghim không còn trong bản đang đọc ⇒ đọc lại rồi báo,
        // không tự thử lại vào một chỗ khác. Đọc lại TRƯỚC khi set error: `reload()` xoá error khi
        // thành công, gọi sau sẽ nuốt mất câu báo cho người dùng.
        await reload();
        setError(userErrorMessage(err, "Chưa ghim được góp ý. Vui lòng thử lại."));
        throw err;
      } finally {
        setBusy(false);
      }
    },
    [projectId, reload]
  );

  const resolve = useCallback(
    async (commentId: string, resolution: CommentResolutionInput) => {
      setBusy(true);
      try {
        const res = await resolveComment(projectId, commentId, resolution);
        if (res.data) {
          const updated = res.data;
          setComments((prev) => prev.map((c) => (c.comment_id === updated.comment_id ? updated : c)));
        }
        setError(null);
      } catch (err) {
        // 409 COMMENT_NOT_OPEN: người khác vừa xử lý ⇒ đọc lại để thấy trạng thái thật (trước khi set
        // error, xem `create`).
        await reload();
        setError(userErrorMessage(err, "Chưa xử lý được góp ý này. Vui lòng thử lại."));
        throw err;
      } finally {
        setBusy(false);
      }
    },
    [projectId, reload]
  );

  const openCountBySection = useMemo(() => {
    const counts = new Map<string, number>();
    for (const c of comments) {
      if (c.status !== "open") continue;
      counts.set(c.anchor.section_id, (counts.get(c.anchor.section_id) ?? 0) + 1);
    }
    return counts;
  }, [comments]);

  return { comments, loading, error, busy, reload, create, resolve, openCountBySection };
}
