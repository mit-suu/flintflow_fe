"use client";

import { useEffect } from "react";

/**
 * Khi `active`: tải lại trang (F5, nút ⟳), đóng tab, gõ địa chỉ khác… thì trình duyệt hỏi "Rời trang?" trước — dùng khi tab đang
 * giữ thứ chỉ có trong bộ nhớ (file vừa chọn, file đang tải lên) mà rời trang là mất.
 *
 * Chữ trong hộp do trình duyệt quyết, không đổi được. Chuyển trang bên trong app (Next router) không qua `beforeunload` nên không hỏi.
 */
export function useLeaveGuard(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      // Chrome/Edge cũ chỉ hiện hộp khi `returnValue` được gán
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [active]);
}
