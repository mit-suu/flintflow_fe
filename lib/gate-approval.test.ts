import { describe, expect, it } from "vitest";
import { isGateApproval } from "./gate-approval";

/**
 * Phép so này quyết định một bước có được chốt hay không, nên hai chiều sai nặng khác nhau: bỏ sót một
 * tiếng "ừ" chỉ làm user mất thêm một lượt, còn nhận nhầm một lời nhắn sửa thành duyệt là chốt nhầm nội
 * dung. Vì vậy phần lớn ca ở đây là ca **không được nhận**.
 */
describe("isGateApproval", () => {
  it("nhận một tiếng ừ đứng một mình, kể cả có đuôi thân mật", () => {
    for (const text of ["oke", "OK", "ok.", "Ổn", "ừ", "đồng ý", "duyệt", "chốt", "được rồi", "ổn rồi nhé", "đúng rồi", "chuẩn luôn"])
      expect(isGateApproval(text), text).toBe(true);
  });

  it("nhận cả phiên tiếng Anh", () => {
    for (const text of ["yes", "Sure", "approved", "lgtm", "looks good", "ok!"]) expect(isGateApproval(text), text).toBe(true);
  });

  it("KHÔNG nhận khi tin nhắn còn mang nội dung — đây là lời nhắn sửa", () => {
    for (const text of [
      "ok nhưng đổi vai trò phòng đào tạo",
      "được, thêm vai trò kế toán",
      "duyệt phần luồng, còn vai trò thì sửa lại",
      "ổn không?",
      "ok vậy còn phần tổng kết?",
      "approved but drop the admin role",
    ])
      expect(isGateApproval(text), text).toBe(false);
  });

  it("KHÔNG nhận lời phủ định", () => {
    for (const text of ["chưa ổn", "không duyệt", "ko ok", "chưa đồng ý", "not ok", "nope"]) expect(isGateApproval(text), text).toBe(false);
  });

  it("KHÔNG nhận chuỗi rỗng hay chữ không liên quan", () => {
    for (const text of ["", "   ", "tiếp đi", "rồi", "👍", "xem lại giúp tôi"]) expect(isGateApproval(text), text).toBe(false);
  });
});
