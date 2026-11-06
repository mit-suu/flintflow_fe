"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { startGapFillCr } from "@/lib/api/change-requests";
import { useErrorText } from "../../_components/mode1/i18n";
import { crHref } from "../../_components/mode1/prefill";

/**
 * FLF-382 (luồng B): nút "Soạn mục còn trống" — mở CR "Bổ sung mục còn thiếu" (BE tạo mới hoặc trả CR đang mở) rồi chuyển
 * tới trang CR đó. 409 `NO_MISSING_SECTIONS` ⇒ câu thân thiện "tài liệu không còn mục trống" (`mode1.errors.codes`).
 */
export function useGapFill(projectId: string) {
  const router = useRouter();
  const errText = useErrorText();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  /** Trả câu lỗi (đã dịch) nếu không mở được CR, `null` khi đã chuyển trang — chỗ gọi tự chọn cách hiện lỗi. */
  const start = useCallback(async (): Promise<string | null> => {
    setBusy(true);
    setError(null);
    try {
      const res = await startGapFillCr(projectId);
      const crId = res.data?.change_request.cr_id;
      if (!crId) throw new Error("gap-fill: no cr_id");
      router.push(crHref(projectId, crId));
      return null;
    } catch (err) {
      const message = errText(err);
      if (alive.current) setError(message);
      return message;
    } finally {
      if (alive.current) setBusy(false);
    }
  }, [projectId, router, errText]);

  return { start, busy, error, clearError: () => setError(null) };
}
