import { describe, expect, it } from "vitest";
import { parseReviewProposal } from "./review-proposal";

describe("parseReviewProposal", () => {
  it("tách đề xuất sửa sau nhãn Đề xuất", () => {
    expect(parseReviewProposal("import_review", "Mơ hồ: \"nhanh\" chưa đo được. Đề xuất: ghi rõ phản hồi dưới 2 giây.")).toEqual({
      kind: "fix",
      proposal: "ghi rõ phản hồi dưới 2 giây.",
    });
  });

  it("tách hai phương án và khuyến nghị", () => {
    const r = parseReviewProposal("import_review", "Quy trình duyệt bỏ qua Trưởng phòng. Phương án A: thêm bước duyệt, chậm hơn. Phương án B: giữ nguyên, rủi ro. Khuyến nghị: A vì an toàn hơn.");
    expect(r).toEqual({
      kind: "options",
      options: [
        { key: "A", text: "thêm bước duyệt, chậm hơn." },
        { key: "B", text: "giữ nguyên, rủi ro." },
      ],
      recommendation: "A vì an toàn hơn.",
    });
  });

  it("không áp cho luật khác hoặc câu không có đề xuất", () => {
    expect(parseReviewProposal("array_empty", "Đề xuất: x")).toBeNull();
    expect(parseReviewProposal("import_review", "Chỉ nêu vấn đề")).toBeNull();
  });
});
