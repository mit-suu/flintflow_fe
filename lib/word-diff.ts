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

/**
 * FLF-480 (B18): so theo **dòng** trước, rồi theo từ trong cặp dòng đổi — giữ được xuống dòng (bảng 5.3 là mỗi hàng một
 * dòng `ô | ô`). Trả mỗi dòng của `b` (và dòng chỉ có ở `a` dạng `del`) là một dãy token.
 */
export const diffLines = (a: string, b: string): DiffToken[][] => {
  const x = a.split("\n");
  const y = b.split("\n");
  const n = x.length;
  const m = y.length;
  const lcs: Uint16Array[] = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) lcs[i][j] = x[i] === y[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
  const out: DiffToken[][] = [];
  let i = 0;
  let j = 0;
  const flush = (dels: string[], inss: string[]) => {
    const k = Math.max(dels.length, inss.length);
    for (let r = 0; r < k; r++) {
      if (r < dels.length && r < inss.length) out.push(diffTokens(dels[r], inss[r]));
      else if (r < inss.length) out.push(diffTokens("", inss[r]));
      else out.push(diffTokens(dels[r], ""));
    }
  };
  let dels: string[] = [];
  let inss: string[] = [];
  while (i < n || j < m) {
    if (i < n && j < m && x[i] === y[j]) {
      flush(dels, inss);
      dels = [];
      inss = [];
      out.push(diffTokens(x[i], y[j]));
      i++;
      j++;
    } else if (j < m && (i >= n || lcs[i][j + 1] >= lcs[i + 1][j])) {
      inss.push(y[j]);
      j++;
    } else {
      dels.push(x[i]);
      i++;
    }
  }
  flush(dels, inss);
  return out;
};
