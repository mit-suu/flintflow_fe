"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface ResizableWidthOptions {
  /** Khoá localStorage giữ bề rộng user đã kéo. */
  storageKey: string;
  defaultWidth: number;
  min: number;
  /** Trần tính lúc kéo — thường phụ thuộc bề rộng các khung khác nên là hàm. */
  max: () => number;
  /** Bề rộng mới theo vị trí con trỏ; `null` khi chưa đo được (khung chưa gắn DOM). */
  measure: (clientX: number) => number | null;
}

const readSaved = (key: string, fallback: number, min: number): number => {
  if (typeof window === "undefined") return fallback;
  try {
    const parsed = parseInt(localStorage.getItem(key) ?? "", 10);
    if (!isNaN(parsed) && parsed >= min) return parsed;
  } catch {}
  return fallback;
};

const save = (key: string, width: number) => {
  try {
    localStorage.setItem(key, String(width));
  } catch {}
};

/**
 * Bề rộng một khung kéo được bằng chuột (chat, rail tiến độ, panel phải): kẹp trong [min, max()], thả chuột thì
 * lưu localStorage, `reset` về mặc định. Trong lúc kéo khoá con trỏ `col-resize` và chặn bôi đen chữ toàn trang.
 */
export function useResizableWidth({ storageKey, defaultWidth, min, max, measure }: ResizableWidthOptions) {
  const [preferred, setWidth] = useState<number>(() => readSaved(storageKey, defaultWidth, min));
  /**
   * Trần tạm do bố cục áp xuống (mở panel phải thì khung khác phải nhường chỗ) — **không** ghi localStorage:
   * bỏ trần là bề rộng user đã kéo quay lại nguyên vẹn. `null` = không ép.
   */
  const [cap, setCap] = useState<number | null>(null);
  const width = cap === null ? preferred : Math.max(min, Math.min(preferred, cap));
  const [resizing, setResizing] = useState(false);
  const widthRef = useRef(width);
  // Giữ hàm đo/trần mới nhất mà không phải gỡ-gắn lại listener mỗi lần render
  const measureRef = useRef(measure);
  const maxRef = useRef(max);
  useEffect(() => {
    widthRef.current = width;
    measureRef.current = measure;
    maxRef.current = max;
  });

  useEffect(() => {
    if (!resizing) return;
    const onMove = (e: MouseEvent) => {
      const raw = measureRef.current(e.clientX);
      if (raw === null) return;
      setWidth(Math.round(Math.min(Math.max(min, raw), Math.max(min, maxRef.current()))));
    };
    const onUp = () => {
      setResizing(false);
      save(storageKey, widthRef.current);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    return () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [resizing, min, storageKey]);

  const startResize = useCallback(() => setResizing(true), []);
  const reset = useCallback(() => {
    setWidth(defaultWidth);
    save(storageKey, defaultWidth);
  }, [defaultWidth, storageKey]);
  /** Ép trần tạm (hoặc `null` để bỏ ép). Giá trị dưới `min` bị kẹp lên `min` khi tính `width`. */
  const capTo = useCallback((next: number | null) => setCap(next === null ? null : Math.round(next)), []);

  return { width, resizing, startResize, reset, capTo };
}
