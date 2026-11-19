/**
 * Nhãn mã đoạn của nguồn tài liệu (FLF-292): `D1-P03` ⇒ "đoạn 3". Dùng ở chip "Nguồn" (FLF-443).
 */

/** Translator của `workspace.sources` — truyền thẳng `useTranslations("workspace.sources")`. */
export type SourceLabelsTranslator = (key: "paragraph", values: { n: number }) => string;

/** `D1-P03` ⇒ `đoạn 3` / `paragraph 3`; sai khuôn ⇒ nguyên mã. */
export function paragraphLabel(paraId: string, t: SourceLabelsTranslator): string {
  const m = /^D\d+-P(\d+)$/.exec(paraId);
  return m ? t("paragraph", { n: Number(m[1]) }) : paraId;
}
