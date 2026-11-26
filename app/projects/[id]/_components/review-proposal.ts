/**
 * FLF-453: cờ của vòng rà soát (`import_review`, `import_semantic`) mang đề xuất sửa ngay trong câu của cờ:
 * "… Đề xuất: <cách sửa>" hoặc, với nghi sai nghiệp vụ, "… Phương án A: … Phương án B: … Khuyến nghị: …".
 * Tách ra để nút Chấp nhận / Chọn phương án gửi đúng đoạn đó vào đường sửa qua chat.
 */
export type ReviewProposal =
  | { kind: "fix"; proposal: string }
  | { kind: "options"; options: { key: "A" | "B"; text: string }[]; recommendation: string | null };

const REVIEW_RULES: ReadonlySet<string> = new Set(["import_review", "import_semantic"]);

const FIX = /(?:Đề xuất|Proposal|Suggested fix)\s*:\s*([\s\S]+)$/i;
const OPTIONS = /(?:Phương án|Option)\s*A\s*:\s*([\s\S]*?)\s*(?:Phương án|Option)\s*B\s*:\s*([\s\S]*?)(?:\s*(?:Khuyến nghị|Recommendation)\s*:\s*([\s\S]*))?$/i;

export const parseReviewProposal = (ruleId: string, message: string): ReviewProposal | null => {
  if (!REVIEW_RULES.has(ruleId)) return null;
  const opts = OPTIONS.exec(message);
  if (opts?.[1]?.trim() && opts[2]?.trim()) {
    return {
      kind: "options",
      options: [
        { key: "A", text: opts[1].trim() },
        { key: "B", text: opts[2].trim() },
      ],
      recommendation: opts[3]?.trim() || null,
    };
  }
  const fix = FIX.exec(message);
  return fix?.[1]?.trim() ? { kind: "fix", proposal: fix[1].trim() } : null;
};
