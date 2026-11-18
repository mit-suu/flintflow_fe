"use client";

import { useCallback, useRef, useState } from "react";
import type { CreditGateRequest } from "../_components/CreditGateCard";

/**
 * Cổng cứng xác nhận credit (FLF-332): `confirm(request)` treo thẻ `CreditGateCard` và chờ người dùng — resolve `true` khi
 * bấm Chạy, `false` khi Huỷ. Gọi lần hai khi thẻ đang treo thì thẻ cũ bị huỷ (`false`). Nơi gọi tự quyết có gọi AI hay không.
 */
export function useCreditGate() {
  const [pending, setPending] = useState<CreditGateRequest | null>(null);
  const resolveRef = useRef<((ok: boolean) => void) | null>(null);

  const settle = useCallback((ok: boolean) => {
    const resolve = resolveRef.current;
    resolveRef.current = null;
    setPending(null);
    resolve?.(ok);
  }, []);

  const confirm = useCallback(
    (request: CreditGateRequest): Promise<boolean> =>
      new Promise<boolean>((resolve) => {
        resolveRef.current?.(false);
        resolveRef.current = resolve;
        setPending(request);
      }),
    []
  );

  return { pending, confirm, run: () => settle(true), cancel: () => settle(false) };
}
