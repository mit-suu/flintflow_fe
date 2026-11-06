/**
 * Nhãn mode 1 theo ngôn ngữ giao diện: mọi helper trả câu cho người dùng (path Spine, mã luật, trạng thái, lỗi API…) được
 * gom vào một object `Mode1Labels` đã gắn translator của namespace `mode1`. Component lấy bằng `useMode1Labels()`;
 * test / code ngoài React dựng bằng `mode1Labels(t, locale)` với `createTranslator` của next-intl.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef } from "react";
import { useLocale, useTranslations } from "next-intl";
import { errorText } from "./errors";
import { statusLabels } from "./labels";
import { spineLabels } from "./spine-labels";
import { tableFields } from "./table-fields";
import { valueDiff } from "./value-diff";

/**
 * Translator của namespace `mode1` dạng lỏng: helper tra key động (`spine.rules.<mã>`) nên không dùng được kiểu key chặt
 * của next-intl. Có `has` để mã lạ (BE thêm sau) lùi về mã gốc thay vì in key.
 */
export interface Mode1T {
  (key: string, values?: Record<string, string | number>): string;
  has(key: string): boolean;
}

/**
 * Tên mục theo **chính tài liệu đang xem** (`section_id` ⇒ "3.1.2 Software Interfaces"): mẫu cố định / file có sẵn đặt tên mục
 * khác mẫu FPT, nên nhãn mục ở panel cờ, CR, gap report lấy tên này trước, không có mới rơi về số + tên FPT.
 */
export const SectionNamesContext = createContext<ReadonlyMap<string, string> | null>(null);

export const mode1Labels = (t: Mode1T, locale: string, sectionNames?: ReadonlyMap<string, string> | null) => {
  const spine = spineLabels(t, locale, sectionNames ?? undefined);
  const base = { t, locale, ...spine, ...tableFields(t, spine), ...statusLabels(t, locale), ...valueDiff(t, spine) };
  return { ...base, errorText: (err: unknown, fallback?: string) => errorText(err, base, fallback) };
};

export type Mode1Labels = ReturnType<typeof mode1Labels>;
/** Phần `Mode1Labels` mà `errorText` cần — tách ra để `errors.ts` không phụ thuộc vòng vào chính `errorText`. */
export type Mode1BaseLabels = Omit<Mode1Labels, "errorText">;

/** Nhãn mode 1 theo ngôn ngữ đang chọn — giữ nguyên object giữa các lần render cùng ngôn ngữ. */
export function useMode1Labels(): Mode1Labels {
  const t = useTranslations("mode1") as unknown as Mode1T;
  const locale = useLocale();
  const sectionNames = useContext(SectionNamesContext);
  return useMemo(() => mode1Labels(t, locale, sectionNames), [t, locale, sectionNames]);
}

/**
 * `errorText` cho hook ghi lỗi trong callback của effect: trả hàm **ổn định** (đọc nhãn mới nhất qua ref) — đưa nhãn vào
 * dependency sẽ tải lại dữ liệu mỗi lần đổi ngôn ngữ. Câu dự phòng là key trong `mode1.errors.fallback`.
 */
export type Mode1ErrorFallback =
  | "loadImport"
  | "loadVersions"
  | "loadProject"
  | "loadCr"
  | "loadCrList"
  | "loadGapReport";

/** Mã `@…` (mẫu `lib/hook-errors.ts`) đi qua nguyên văn để component dịch lúc render. */
type ErrorFallbackArg = Mode1ErrorFallback | `@${string}`;

export function useErrorText(): (err: unknown, fallback?: ErrorFallbackArg) => string {
  const L = useMode1Labels();
  const ref = useRef(L);
  useEffect(() => {
    ref.current = L;
  }, [L]);
  return useCallback((err: unknown, fallback?: ErrorFallbackArg) => {
    const fb = fallback === undefined ? undefined : fallback.startsWith("@") ? fallback : ref.current.t(`errors.fallback.${fallback}`);
    return ref.current.errorText(err, fb);
  }, []);
}
