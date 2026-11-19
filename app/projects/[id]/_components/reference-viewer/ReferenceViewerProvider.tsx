"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import ReferenceDocumentViewer, { type ReferenceViewerTarget } from "./ReferenceDocumentViewer";

interface ReferenceViewerApi {
  openDocument: (target: ReferenceViewerTarget) => void;
}

const ReferenceViewerContext = createContext<ReferenceViewerApi | null>(null);

/**
 * Một trình xem tài liệu tham khảo cho cả workspace: chip "Nguồn" (tài liệu, Hồ sơ) và popup Tài liệu cùng mở một dialog.
 * Ngoài provider (vd trang `/view`) ⇒ `useReferenceViewer()` trả `null`, nơi gọi ẩn nút mở.
 */
export function ReferenceViewerProvider({ projectId, children }: { projectId: string; children: ReactNode }) {
  const [target, setTarget] = useState<ReferenceViewerTarget | null>(null);
  const openDocument = useCallback((next: ReferenceViewerTarget) => setTarget(next), []);
  const api = useMemo(() => ({ openDocument }), [openDocument]);
  return (
    <ReferenceViewerContext.Provider value={api}>
      {children}
      {/* `key` theo tài liệu: mở tài liệu khác thì dựng lại, không loé chữ của tài liệu trước */}
      <ReferenceDocumentViewer key={target ? `${target.documentId}:${target.focusParaId ?? ""}` : "none"} projectId={projectId} target={target} onClose={() => setTarget(null)} />
    </ReferenceViewerContext.Provider>
  );
}

export const useReferenceViewer = (): ReferenceViewerApi | null => useContext(ReferenceViewerContext);
