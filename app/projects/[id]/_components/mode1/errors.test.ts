/**
 * `errorText` — mọi thông báo lỗi mode 1 đi qua đây (V6: trước đây 68% coverage). Luật của file này là
 * "không nuốt lỗi": mã lạ vẫn phải giữ chữ của BE, và hai mã có `meta` phải dựng câu chỉ đúng lối ra.
 */
import { describe, expect, it } from "vitest";
import { ApiClientError } from "@/lib/api/client";
import { errorCode, errorText } from "./errors";

const apiError = (code: string, message = "thông điệp BE", meta?: Record<string, unknown>) =>
  new ApiClientError(409, code, message, meta);

describe("errorText", () => {
  it("mã có trong bảng ⇒ câu tiếng Việt của FE, không phải chữ BE", () => {
    expect(errorText(apiError("BASELINE_BLOCKED"))).toBe("Còn cờ đỏ chưa xử lý — chưa ký baseline v1 được.");
    expect(errorText(apiError("INSUFFICIENT_CREDIT"))).toContain("nạp thêm");
    expect(errorText(apiError("RATE_LIMIT_EXCEEDED")), "L8: phải nói tới tài khoản nhà cung cấp").toContain("nhà cung cấp AI");
  });

  it("mã lạ ⇒ giữ nguyên thông điệp BE; BE không nói gì ⇒ mới dùng fallback", () => {
    expect(errorText(apiError("SOMETHING_NEW", "Lý do cụ thể từ BE"))).toBe("Lý do cụ thể từ BE");
    expect(errorText(apiError("SOMETHING_NEW", ""), "dự phòng")).toBe("dự phòng");
  });

  it("PATH_LOCKED ⇒ nêu đích danh path và CR đang giữ", () => {
    const text = errorText(apiError("PATH_LOCKED", "khoá", { locked: [{ path: "nfrs[id=NFR-01]", cr_id: "CR-003" }] }));
    expect(text).toContain("nfrs[id=NFR-01]");
    expect(text).toContain("CR-003");
  });

  it("PATH_LOCKED mà meta rỗng ⇒ lùi về chữ của BE thay vì câu cụt", () => {
    expect(errorText(apiError("PATH_LOCKED", "Đang bị khoá", { locked: [] }))).toBe("Đang bị khoá");
  });

  it("CR_NO_LOCATIONS có mục trống ⇒ chỉ sang chạy step (L3), không để người dùng tưởng nút hỏng", () => {
    const text = errorText(
      apiError("CR_NO_LOCATIONS", "không có vị trí", { empty_sections: [{ section_id: "fixed:5.2", title: "Common Requirements", step_id: "S-7.2" }] })
    );
    expect(text).toContain("Common Requirements");
    expect(text).toContain("S-7.2");
  });

  it("CR_NO_LOCATIONS không kèm mục trống ⇒ mời sửa mô tả CR cho cụ thể", () => {
    const text = errorText(apiError("CR_NO_LOCATIONS", "không có vị trí", { empty_sections: [] }));
    expect(text).toContain("UC-01");
  });

  it("lỗi thường và giá trị lạ ⇒ không vỡ", () => {
    expect(errorText(new Error("mạng hỏng"))).toBe("mạng hỏng");
    expect(errorText(new Error(""), "dự phòng")).toBe("dự phòng");
    expect(errorText(null, "dự phòng")).toBe("dự phòng");
    expect(errorText("chuỗi trần")).toBe("Đã có lỗi xảy ra");
  });
});

describe("errorCode", () => {
  it("chỉ lấy mã từ lỗi API, còn lại null", () => {
    expect(errorCode(apiError("CR_VALUE_CHANGED"))).toBe("CR_VALUE_CHANGED");
    expect(errorCode(new Error("x"))).toBeNull();
    expect(errorCode(undefined)).toBeNull();
  });
});
