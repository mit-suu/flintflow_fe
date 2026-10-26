/**
 * Nhãn trạng thái và mã của mode 1 theo ngôn ngữ (`mode1.labels.*`) — chỉ hiển thị, không suy diễn trạng thái ở FE.
 * Lấy qua `useMode1Labels()`: `L.importStatus(s)`, `L.crStatus(s)`, `L.crSource(k)`…
 */
import { NEW_CR_SOURCE_KINDS, type CrSourceKind, type CrStatus, type LocationConclusion, type LocationFoundBy } from "@/types/change-request";
import type { DocVersionKind } from "@/types/doc-version";
import type { DocBlockKind, ImportStatus } from "@/types/import";
import type { Mode1T } from "./i18n";

/** Import đã có baseline v0 ⇒ tài liệu, gap report và change request dùng được. */
export const IMPORT_DONE_STATUSES: readonly ImportStatus[] = ["gap_review", "delivered", "change_requested"];

/** Nguồn chọn được khi tạo CR — đúng 6 nguồn BPMN 3.1 (mode 1 v3: không còn `chat`). */
export const CR_SOURCE_KINDS = NEW_CR_SOURCE_KINDS;

/** Các kết luận của một vị trí CR, theo thứ tự hiển thị. */
export const CONCLUSION_KINDS: readonly LocationConclusion[] = ["edit", "comment", "not_related"];

const DATE_LOCALES: Readonly<Record<string, string>> = { vi: "vi-VN", en: "en-GB" };

export const formatDateTime = (iso: string | null | undefined, locale = "vi"): string => {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString(DATE_LOCALES[locale] ?? locale, { dateStyle: "short", timeStyle: "short" });
};

export const formatPercent = (value: number): string => `${Math.round(value * 100)}%`;

export const statusLabels = (t: Mode1T, locale: string) => {
  /** Mã lạ (BE thêm sau) ⇒ giữ mã thay vì in key. */
  const label = (group: string, code: string) => (t.has(`labels.${group}.${code}`) ? t(`labels.${group}.${code}`) : code);
  return {
    importStatus: (s: ImportStatus) => label("importStatus", s),
    crStatus: (s: CrStatus) => label("crStatus", s),
    crSource: (k: CrSourceKind) => label("crSource", k),
    foundBy: (f: LocationFoundBy) => label("foundBy", f),
    conclusion: (c: LocationConclusion) => label("conclusion", c),
    versionKind: (k: DocVersionKind) => label("versionKind", k),
    /** FLF-318: bản 1.0 của dự án tạo SRS đã chốt baseline (kind `imported`, không có file upload). */
    signedBaseline: () => label("versionKind", "signed_baseline"),
    blockKind: (k: DocBlockKind) => label("blockKind", k),
    formatDateTime: (iso: string | null | undefined) => formatDateTime(iso, locale),
  };
};
