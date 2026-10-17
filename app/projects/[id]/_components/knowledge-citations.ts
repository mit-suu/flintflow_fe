/**
 * Trích dẫn trong câu trả lời tri thức (`pipeline-contract.md` §1.2). Model viết nhãn `[K1]`, `[K2]`…
 * trong `reply`, còn `citations[]` nói mỗi nhãn trỏ vào chunk nào.
 */
import type { KnowledgeCitation, KnowledgeSourceKind } from "@/types/chat";

export const SOURCE_KIND_LABELS: Record<KnowledgeSourceKind, string> = {
  internal_skill: "Hướng dẫn nội bộ FlintFlow",
  standard: "Chuẩn ngoài",
};

/** Nhãn trích dẫn: đúng `K` + số, để chữ thường như `[Key]` hay `[K]` không bị nhận lầm. */
const REF_PATTERN = /\[(K\d+)\]/g;

/**
 * Tách `reply` thành các đoạn chữ và các trích dẫn bấm được, giữ đúng thứ tự xuất hiện.
 *
 * Nhãn không khớp phần tử nào trong `citations` thì giữ nguyên làm chữ thường: BE đã bỏ nhãn model bịa
 * trước khi trả về, nhưng tin cũ trong transcript có thể lệch — và một chip rỗng chữ, bấm vào không ra
 * gì, tệ hơn là để nguyên `[K3]`.
 */
export const splitCitationRefs = (
  reply: string,
  citations: readonly KnowledgeCitation[]
): (string | KnowledgeCitation)[] => {
  const byRef = new Map(citations.map((c) => [c.ref, c]));
  const parts: (string | KnowledgeCitation)[] = [];
  let cursor = 0;

  for (const match of reply.matchAll(REF_PATTERN)) {
    const cited = byRef.get(match[1]);
    if (!cited) continue; // nhãn lạ: để vòng sau gộp nó vào đoạn chữ
    if (match.index > cursor) parts.push(reply.slice(cursor, match.index));
    parts.push(cited);
    cursor = match.index + match[0].length;
  }
  if (cursor < reply.length) parts.push(reply.slice(cursor));
  return parts;
};
