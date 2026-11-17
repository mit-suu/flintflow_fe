import { describe, expect, it } from "vitest";
import { gateEditRoute, mentionedSections } from "./gate-edit-route";

describe("gateEditRoute (P08)", () => {
  it("hết 8 lượt gọi AI ⇒ callLimit, kể cả lệnh của chính bước", () => {
    expect(gateEditRoute("Gộp hai actor thợ cắt và thợ phụ thành Barber", "S-4.1", 8)).toBe("callLimit");
  });

  it("ở S-7.4 nhắn thêm thông báo vào mục 5.3 ⇒ otherSection", () => {
    expect(mentionedSections("Thêm thông báo dùng chung vào mục 5.3: lịch hẹn đã bị huỷ")).toEqual(["5.3"]);
    expect(gateEditRoute("Thêm thông báo dùng chung vào mục 5.3: lịch hẹn đã bị huỷ", "S-7.4", 2)).toBe("otherSection");
  });

  it("lệnh thuộc mục bước đang ghi, hoặc không nhắc mục nào ⇒ đi revision như cũ", () => {
    expect(gateEditRoute("Thêm yêu cầu về sao lưu dữ liệu vào mục 5.4", "S-7.4", 2)).toBeNull();
    expect(gateEditRoute("Thêm yêu cầu sao lưu hằng ngày", "S-7.4", 2)).toBeNull();
    expect(gateEditRoute("Mục 5.3 nhìn ổn rồi", "S-7.4", 2)).toBeNull();
  });

  it("gọi tên loại phần tử bước không ghi ⇒ otherSection; bước đang ghi loại đó ⇒ revision", () => {
    expect(gateEditRoute("Sửa toàn bộ thông báo: câu nào mở đầu bằng Please thì viết lại", "S-9.5", 0)).toBe("otherSection");
    expect(gateEditRoute("Thêm thông báo khi lịch hẹn bị huỷ", "S-7.3", 1)).toBeNull();
  });
});
