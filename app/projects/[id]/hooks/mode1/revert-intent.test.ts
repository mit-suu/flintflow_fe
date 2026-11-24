import { describe, expect, it } from "vitest";
import { parseRevertIntent } from "./revert-intent";

describe("parseRevertIntent", () => {
  it("nhận câu hoàn tác tiếng Việt / tiếng Anh, chuẩn hoá mã CR", () => {
    expect(parseRevertIntent("hoàn tác CR-014")).toBe("CR-014");
    expect(parseRevertIntent("Hoàn tác lại cr 7 giúp mình")).toBe("CR-007");
    expect(parseRevertIntent("revert CR-12")).toBe("CR-012");
  });

  it("câu sửa thường không phải ý hoàn tác", () => {
    expect(parseRevertIntent("Thêm bước kiểm tra PCCC vào UC-03")).toBeNull();
    expect(parseRevertIntent("CR-014 cần sửa lại tên actor")).toBeNull();
  });
});
