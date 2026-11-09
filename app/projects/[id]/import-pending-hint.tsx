"use client";

import { createContext, useContext } from "react";

/**
 * Gợi ý "dự án đang ở màn đọc file" mà server đọc từ cookie (`layout.tsx`) — làm snapshot server cho skeleton của trang dự án,
 * để HTML đầu tiên và lần hydrate đã đúng skeleton màn đọc file (không chớp skeleton workspace).
 */
const ImportPendingHint = createContext(false);

export function ImportPendingHintProvider({ value, children }: { value: boolean; children: React.ReactNode }) {
  return <ImportPendingHint.Provider value={value}>{children}</ImportPendingHint.Provider>;
}

export const useImportPendingHint = () => useContext(ImportPendingHint);
