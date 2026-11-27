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

/**
 * Khoảng trắng, chữ / số, và từng dấu câu là token riêng: "stock," và "stock" khớp nhau ở "stock" — dính dấu vào từ thì sửa
 * một dấu phẩy cũng thành bỏ cả từ rồi thêm lại.
 */
const tokenize = (s: string): string[] => s.match(/\s+|[\p{L}\p{N}_]+|[^\s\p{L}\p{N}_]/gu) ?? [];

const push = (out: WordPart[], op: WordOp, text: string): void => {
  if (!text) return;
  const last = out[out.length - 1];
  if (last?.op === op) last.text += text;
  else out.push({ op, text });
};

/** Trọng số khớp của token: chữ tính theo độ dài, khoảng trắng gần như không đáng kể (chỉ để giữ chỗ). */
const weight = (token: string): number => (token.trim() ? token.length * 4 : 1);

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
  // LCS có trọng số theo độ dài chữ: hai cách khớp cùng số token thì chọn cách giữ được chữ dài hơn — "stock, specifications and
  // reviews." → "stock and specifications." giữ "specifications" (không bỏ rồi thêm lại) thay vì giữ "and"
  const dp: Uint32Array[] = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
  for (let i = n - 1; i >= 0; i--)
    for (let j = m - 1; j >= 0; j--) {
      const skip = Math.max(dp[i + 1][j], dp[i][j + 1]);
      dp[i][j] = a[i] === b[j] ? Math.max(skip, dp[i + 1][j + 1] + weight(a[i])) : skip;
    }
  const out: WordPart[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j] && dp[i][j] === dp[i + 1][j + 1] + weight(a[i])) {
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
