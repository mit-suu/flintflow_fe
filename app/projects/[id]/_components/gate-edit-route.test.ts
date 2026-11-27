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

  it("câu trả lời nhiều dòng cho câu hỏi đang chờ (E2E nha khoa #3) ⇒ không bao giờ sang Sửa tài liệu", () => {
    const answers = [
      "1. Quá 15 phút không đến thì lịch tự huỷ, hệ thống báo cho khách qua thông báo là lịch đã huỷ.",
      "2. Bác sĩ ghi chung vào hoá đơn các thủ thuật đã làm trong buổi.",
      "3. Đổi giá thì chỉ áp dụng cho lịch đặt sau đó.",
      "4. Huỷ lịch trước 24 giờ thì không mất cọc.",
    ].join("\n");
    expect(gateEditRoute(answers, "S-1.4", 2)).toBeNull();
    expect(gateEditRoute("Mình trả lời: quá 15 phút thì báo khách qua thông báo, ghi vào hoá đơn.", "S-1.4", 2)).toBeNull();
    expect(gateEditRoute("Câu 3: đổi giá thì báo bằng thông báo cho khách", "S-1.4", 2)).toBeNull();
  });

  it("câu kể có chữ thông báo / ghi / đổi nhưng không phải lệnh ⇒ revision", () => {
    expect(gateEditRoute("Quá 15 phút thì hệ thống báo cho khách qua thông báo là lịch đã huỷ", "S-1.4", 1)).toBeNull();
    expect(gateEditRoute("Bác sĩ ghi chung vào hoá đơn, đổi giá thì thông báo cho khách", "S-1.4", 1)).toBeNull();
  });

  it("lệnh đổi phạm vi (E2E nha khoa #20) ⇒ otherSection ở bước không ghi phạm vi", () => {
    expect(gateEditRoute("Bản 1.0 mình bỏ hai nhóm Quản lý chi nhánh và Quản trị chuỗi nhé, để bản sau", "S-5.5@S12", 1)).toBe("otherSection");
    expect(gateEditRoute("Không làm đặt lịch online ở bản 1.0", "S-5.5@S12", 1)).toBe("otherSection");
    expect(gateEditRoute("Drop the reporting module from release 1", "S-5.5@S12", 1)).toBe("otherSection");
  });
});
