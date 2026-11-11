/**
 * Điền sẵn change request — FLF-375: CR chỉ tạo bằng chat, nên lối vào (gap report, re-upload diff, comment, cờ, chat bị
 * chặn `409 CHANGE_REQUIRES_CR`) mở khung chat với câu yêu cầu + nguồn điền sẵn (`crPrefillHref`).
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
  /** UC-49 "Tạo CR từ comment": người yêu cầu = tác giả comment (BR-22). */
  requester?: string;
  /** UC-49: comment còn mở được chuyển thành CR này (nguồn "Góp ý của người xem"). */
  comment_id?: string;
}

/** Tiêu đề CR từ câu lệnh sửa: dòng đầu, tối đa 80 ký tự (như BE `prefillFrom`). */
export const titleFromInstruction = (instruction: string): string => {
  const first = instruction.trim().split(/\r?\n/)[0] ?? "";
  return first.length > 80 ? `${first.slice(0, 77)}…` : first;
};

/**
 * Mode 1: gap report và change request là popup trên màn "Tài liệu & version" (`/projects/:id`), mở bằng query
 * `panel=gap` / `panel=cr` (+ `cr=<id>` cho chi tiết) — link từ mọi nơi (gap report, cờ, chat, re-upload) mở đúng popup.
 */
export const gapReportHref = (projectId: string): string => `/projects/${projectId}?panel=gap`;
export const crListHref = (projectId: string): string => `/projects/${projectId}?panel=cr`;
/** So sánh 2 version (UC-55) — cùng khuôn popup với gap report và CR, nên cũng là một query trên màn tài liệu. */
export const compareHref = (projectId: string): string => `/projects/${projectId}?panel=compare`;
/** Re-upload file đã sửa ngoài FlintFlow (UC-25) — popup so khác biệt theo block với version mới nhất. */
export const reuploadHref = (projectId: string): string => `/projects/${projectId}?panel=reupload`;
export const crHref = (projectId: string, crId: string): string => `/projects/${projectId}?panel=cr&cr=${encodeURIComponent(crId)}`;

/**
 * FLF-375 — CR chỉ tạo bằng chat (BF C-1): lối vào khác mở **khung chat** của màn tài liệu với câu yêu cầu đặt sẵn trong ô
 * chat (`text`) và nguồn điền sẵn cho thẻ chọn nguồn — người dùng đọc / sửa câu rồi gửi. Không còn form tạo CR.
 */
export const crPrefillHref = (projectId: string, prefill: CrPrefill): string => {
  const params = new URLSearchParams({ crdraft: "1" });
  const text = [prefill.title, prefill.description].filter((x) => x && x.trim()).filter((x, i, all) => all.indexOf(x) === i).join("\n");
  if (text) params.set("text", text);
  for (const key of ["source", "ref", "requester", "preview_id", "comment_id"] as const) if (prefill[key]) params.set(key, prefill[key]!);
  return `/projects/${projectId}?${params.toString()}`;
};

/** FLF-375: đọc câu + nguồn điền sẵn cho khung chat (`crPrefillHref`); không phải link điền sẵn ⇒ `null`. */
export const readChatCrDraft = (params: URLSearchParams): { text: string; source?: SourceKind; ref?: string; requester?: string; preview_id?: string; comment_id?: string } | null => {
  if (params.get("crdraft") !== "1" && params.get("new") !== "1") return null;
  const source = params.get("source");
  const text = params.get("text") ?? [params.get("title"), params.get("description")].filter(Boolean).join("\n");
  return {
    text,
    source: (CR_SOURCE_KINDS as readonly string[]).includes(source ?? "") ? (source as SourceKind) : undefined,
    ref: params.get("ref") ?? undefined,
    requester: params.get("requester") ?? undefined,
    preview_id: params.get("preview_id") ?? undefined,
    comment_id: params.get("comment_id") ?? undefined,
  };
};
