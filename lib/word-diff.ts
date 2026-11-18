/**
 * FLF-375 (business-flow §3.2): so hai bản theo **từ** để tô màu như Track Changes trên màn so sánh 3 cột
 * (① lúc AI soạn · ② hiện tại · ③ đề xuất của bạn). LCS theo từ, cùng thuật toán với BE `change-request/word-diff.ts`.
 */

export type DiffToken = { text: string; kind: "same" | "del" | "ins" };

const MAX_TOKENS = 1500;

const tokenize = (text: string): string[] => text.split(/\s+/).filter(Boolean).slice(0, MAX_TOKENS);

/** Dãy từ của `b` so với `a`: từ giữ nguyên, từ của `a` bị bỏ (`del`), từ `b` thêm vào (`ins`). */
export const diffTokens = (a: string, b: string): DiffToken[] => {
  const x = tokenize(a);
  const y = tokenize(b);
  const n = x.length;
  const m = y.length;
  const lcs: Uint16Array[] = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) lcs[i][j] = x[i] === y[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
  const out: DiffToken[] = [];
  let i = 0;
  let j = 0;
  while (i < n || j < m) {
    if (i < n && j < m && x[i] === y[j]) {
      out.push({ text: x[i], kind: "same" });
      i++;
      j++;
    } else if (j < m && (i >= n || lcs[i][j + 1] >= lcs[i + 1][j])) {
      out.push({ text: y[j], kind: "ins" });
      j++;
    } else {
      out.push({ text: x[i], kind: "del" });
      i++;
    }
  }
  return out;
};
