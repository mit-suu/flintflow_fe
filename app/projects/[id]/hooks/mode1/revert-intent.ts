/**
 * Câu "hoàn tác CR-014" / "revert CR-14" gõ ở khung chat (business-flow §3.2 C-7: hoàn tác cũng là một CR mới) ⇒ mã CR cần
 * hoàn tác; không phải ý hoàn tác ⇒ `null`. Cùng luật với `parseRevertIntent` ở BE (`change-request/revert-cr.service.ts`).
 */
export const parseRevertIntent = (text: string): string | null => {
  const m = /(?:ho[aà]n\s*t[aá]c|undo|revert|roll\s*back)\s+(?:l[aạ]i\s+)?(?:change request\s+|cr\s*)?-?\s*0*(\d{1,6})\b/i.exec(text.normalize("NFC"));
  return m ? `CR-${m[1].padStart(3, "0")}` : null;
};
