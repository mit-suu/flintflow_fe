/**
 * Diff theo từ cho đoạn văn bị sửa (so sánh version / tải lại file) — hàm thuần. Tách chữ thành từ + khoảng trắng, LCS trên token;
 * token chung ⇒ `same`, chỉ ở bản cũ ⇒ `del`, chỉ ở bản mới ⇒ `add`. Token liền nhau cùng loại được gộp. Đoạn quá dài (LCS tốn bộ nhớ)
 * ⇒ trả cả đoạn cũ là `del` và cả đoạn mới là `add`.
 */
export type WordOp = "same" | "add" | "del";
export interface WordPart {
  op: WordOp;
  text: string;
}

/** Trần số token mỗi bên để LCS (n × m ô) không làm treo trình duyệt. */
export const WORD_DIFF_MAX_TOKENS = 1500;

const tokenize = (s: string): string[] => s.match(/\s+|[^\s]+/g) ?? [];

const push = (out: WordPart[], op: WordOp, text: string): void => {
  if (!text) return;
  const last = out[out.length - 1];
  if (last?.op === op) last.text += text;
  else out.push({ op, text });
};

export const diffWords = (before: string, after: string): WordPart[] => {
  const a = tokenize(before);
  const b = tokenize(after);
  if (a.length > WORD_DIFF_MAX_TOKENS || b.length > WORD_DIFF_MAX_TOKENS) {
    const out: WordPart[] = [];
    push(out, "del", before);
    push(out, "add", after);
    return out;
  }
  const n = a.length;
  const m = b.length;
  const dp: Uint16Array[] = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const out: WordPart[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      push(out, "same", a[i]);
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) push(out, "del", a[i++]);
    else push(out, "add", b[j++]);
  }
  while (i < n) push(out, "del", a[i++]);
  while (j < m) push(out, "add", b[j++]);
  return out;
};
