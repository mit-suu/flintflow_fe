import { describe, expect, it } from "vitest";
import { displayUserText } from "../user-text";

describe("displayUserText", () => {
  it("bỏ tiền tố cũ 'Yêu cầu sửa: '", () => {
    expect(displayUserText("Yêu cầu sửa: à không, cả web và app")).toBe("à không, cả web và app");
  });
  it("đổi câu duyệt cũ về lời thường", () => {
    expect(displayUserText("Duyệt, sang bước tiếp")).toBe("Đúng rồi, đi tiếp");
    expect(displayUserText("Làm lại bước này")).toBe("Làm lại giúp tôi");
  });
  it("giữ nguyên tin khác", () => {
    expect(displayUserText("Yêu cầu sửa tài liệu giúp tôi")).toBe("Yêu cầu sửa tài liệu giúp tôi");
    expect(displayUserText("Đúng rồi, đi tiếp")).toBe("Đúng rồi, đi tiếp");
  });
});
