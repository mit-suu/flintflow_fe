/**
 * Điền sẵn form tạo change request qua query của `/projects/:id/change-requests?new=1&…` — dùng từ gap report,
 * re-upload diff và chat bị chặn (`409 CHANGE_REQUIRES_CR`, BR-03).
 */
import { CR_SOURCE_KINDS } from "./labels";
import type { NEW_CR_SOURCE_KINDS } from "@/types/change-request";

type SourceKind = (typeof NEW_CR_SOURCE_KINDS)[number];

export interface CrPrefill {
  title?: string;
  description?: string;
  source?: SourceKind;
  ref?: string;
  /** Mode 1 v3: bản xem trước của panel "Sửa tài liệu có xem trước" đính kèm CR (gợi ý cho AI, sống 15 phút). */
  preview_id?: string;
}

/** Tiêu đề CR từ câu lệnh sửa: dòng đầu, tối đa 80 ký tự (như BE `prefillFrom`). */
export const titleFromInstruction = (instruction: string): string => {
  const first = instruction.trim().split(/\r?\n/)[0] ?? "";
  return first.length > 80 ? `${first.slice(0, 77)}…` : first;
};

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
    source: (CR_SOURCE_KINDS as readonly string[]).includes(source ?? "") ? (source as SourceKind) : undefined,
    ref: params.get("ref") ?? undefined,
    preview_id: params.get("preview_id") ?? undefined,
  };
};
