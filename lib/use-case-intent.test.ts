import { describe, expect, it } from "vitest";
import { describeConversation, editUseCaseIntent } from "./use-case-intent";

describe("editUseCaseIntent (FLF-318) — cùng luật BE", () => {
  it("thêm / xoá theo động từ đứng trước; không nhắc use case ⇒ null", () => {
    expect(editUseCaseIntent("thêm UC phúc khảo điểm cho học sinh")).toBe("add");
    expect(editUseCaseIntent("xoá UC phúc khảo điểm")).toBe("remove");
    expect(editUseCaseIntent("bỏ use case vừa tạo")).toBe("remove");
    expect(editUseCaseIntent("bổ sung use case xem trạng thái")).toBe("add");
    expect(editUseCaseIntent("Thêm yêu cầu hiệu năng cho màn tra cứu")).toBeNull();
    expect(editUseCaseIntent("xoá màn Login")).toBeNull();
    // sửa use case (luật 3h): động từ sửa đứng trước thắng
    expect(editUseCaseIntent("sửa UC phúc khảo điểm: thêm bước phòng đào tạo duyệt")).toBe("edit");
    expect(editUseCaseIntent("đổi actor của use case Request Grade Review sang Lecturer")).toBe("edit");
    expect(editUseCaseIntent("rename use case UC26 to Submit Grade Appeal")).toBe("edit");
    expect(editUseCaseIntent("thêm use case X, sửa màn Y")).toBe("add");
  });
});

describe("describeConversation", () => {
  it("lệnh đầu + từng câu trả lời; chỉ có lệnh ⇒ đúng lệnh đó", () => {
    expect(describeConversation(["thêm UC phúc khảo điểm", "Lecturer rồi Academic Management Office duyệt", "Màn hình riêng"])).toBe(
      "thêm UC phúc khảo điểm\n\nTrả lời làm rõ:\n- Lecturer rồi Academic Management Office duyệt\n- Màn hình riêng"
    );
    expect(describeConversation(["xoá UC phúc khảo điểm"])).toBe("xoá UC phúc khảo điểm");
  });
});
