/**
 * Điền sẵn form tạo change request qua query của `/projects/:id/change-requests?new=1&…` — dùng từ gap report,
 * re-upload diff và chat bị chặn (`409 CHANGE_REQUIRES_CR`, BR-03).
 */
import { CR_SOURCE_KINDS } from "./labels";
import type { CrSourceKind } from "@/types/change-request";

export interface CrPrefill {
  title?: string;
  description?: string;
  source?: CrSourceKind;
  ref?: string;
}

export const crPrefillHref = (projectId: string, prefill: CrPrefill): string => {
  const params = new URLSearchParams({ new: "1" });
  for (const [key, value] of Object.entries(prefill)) if (value) params.set(key, value);
  return `/projects/${projectId}/change-requests?${params.toString()}`;
};

/** Đọc lại prefill từ query; nguồn lạ bị bỏ (người dùng tự chọn). */
export const readCrPrefill = (params: URLSearchParams): CrPrefill | null => {
  if (params.get("new") !== "1") return null;
  const source = params.get("source");
  return {
    title: params.get("title") ?? undefined,
    description: params.get("description") ?? undefined,
    source: (CR_SOURCE_KINDS as readonly CrSourceKind[]).includes(source as CrSourceKind) ? (source as CrSourceKind) : undefined,
    ref: params.get("ref") ?? undefined,
  };
};
