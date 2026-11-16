"use client";

import { useEffect, useRef } from "react";

/**
 * FLF-416: chạy `onRun` đúng một lần khi được hiển thị — lượt mở lời tự động của Luồng 2 sau import (AI tự hỏi phần thiếu,
 * BF §3.1.2). Tách thành component để hook không nằm sau lệnh return sớm của workspace.
 */
export function RunOnce({ onRun }: { onRun: () => void }) {
  const done = useRef(false);
  useEffect(() => {
    if (done.current) return;
    done.current = true;
    onRun();
  }, [onRun]);
  return null;
}
