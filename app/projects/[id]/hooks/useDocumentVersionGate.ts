"use client";

import { useCallback, useRef, useState } from "react";
import type { DocumentUploadChoice, DocumentVersionCandidate } from "@/types/document";

export interface DocumentVersionRequest {
  fileName: string;
  candidates: DocumentVersionCandidate[];
}

/**
 * FLF-398: tài liệu đính kèm có vẻ là bản mới của tài liệu đã có ⇒ `choose(file, candidates)` treo thẻ `DocumentVersionCard`
 * trong khung chat và chờ người dùng — resolve lựa chọn (Thay bản cũ / Giữ cả hai) hoặc `null` (Bỏ qua). Gọi lần hai khi thẻ
 * đang treo thì thẻ cũ coi như Bỏ qua. Cùng khuôn với `useCreditGate`.
 */
export function useDocumentVersionGate() {
  const [pending, setPending] = useState<DocumentVersionRequest | null>(null);
  const resolveRef = useRef<((choice: DocumentUploadChoice | null) => void) | null>(null);

  const answer = useCallback((choice: DocumentUploadChoice | null) => {
    const resolve = resolveRef.current;
    resolveRef.current = null;
    setPending(null);
    resolve?.(choice);
  }, []);

  const choose = useCallback(
    (file: File, candidates: DocumentVersionCandidate[]): Promise<DocumentUploadChoice | null> =>
      new Promise((resolve) => {
        resolveRef.current?.(null);
        resolveRef.current = resolve;
        setPending({ fileName: file.name, candidates });
      }),
    []
  );

  return { pending, choose, answer };
}
