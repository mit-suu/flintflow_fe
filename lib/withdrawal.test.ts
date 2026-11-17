import { describe, expect, it } from "vitest";
import { answersWithdraw, isWithdrawal } from "./withdrawal";

describe("isWithdrawal (FLF-439)", () => {
  it("lời rút lại", () => {
    for (const t of ["thôi không cần nữa", "Bỏ qua", "huỷ", "never mind", "không đổi nữa", "ko sửa gì nữa đâu", "khỏi", "khỏi sửa nữa nha", "No more changes", "drop it"])
      expect(isWithdrawal(t), t).toBe(true);
  });

  it("câu trả lời thật không tính", () => {
    for (const t of ["không đổi", "không đổi tên, chỉ đổi mô tả", "giữ nguyên", "Giữ như cũ, không áp dụng phần này của CR", "để như cũ", "Lecturer", "leave it as is"])
      expect(isWithdrawal(t), t).toBe(false);
  });
});

describe("answersWithdraw", () => {
  it("mọi câu có chữ đều là lời rút lại ⇒ true; câu trống bỏ qua", () => {
    expect(answersWithdraw(["không đổi nữa"])).toBe(true);
    expect(answersWithdraw(["không đổi nữa", "  "])).toBe(true);
  });

  it("có câu trả lời thật, hoặc toàn trống ⇒ false", () => {
    expect(answersWithdraw(["không đổi nữa", "Lecturer"])).toBe(false);
    expect(answersWithdraw(["", " "])).toBe(false);
    expect(answersWithdraw([])).toBe(false);
  });
});
