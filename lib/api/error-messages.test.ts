import { afterEach, describe, expect, it } from "vitest";
import { ApiClientError } from "./client";
import { currentLocale, localizeApiError } from "./error-messages";

const setPage = (lang: string, path = "/home") => {
  document.documentElement.lang = lang;
  window.history.replaceState(null, "", path);
};

afterEach(() => setPage("", "/"));

describe("localizeApiError (T25 · P6)", () => {
  it("mã có bản dịch ⇒ câu theo ngôn ngữ đang hiển thị (<html lang>)", () => {
    setPage("vi");
    expect(localizeApiError("INVALID_CREDENTIALS", "Invalid credentials")).toBe("Email hoặc mật khẩu không đúng.");
    setPage("en");
    expect(localizeApiError("EMAIL_NOT_VERIFIED", "Email chưa được xác thực.")).toBe("Your email isn't verified yet. Please check your inbox.");
  });

  it("mã mơ hồ / mang chi tiết động hoặc không có mã ⇒ giữ nguyên message BE", () => {
    setPage("en");
    expect(localizeApiError("FORBIDDEN", "Chỉ Admin mới có quyền thực hiện thao tác này")).toBe("Chỉ Admin mới có quyền thực hiện thao tác này");
    expect(localizeApiError("VALIDATION_ERROR", "from phải trước to")).toBe("from phải trước to");
    expect(localizeApiError(undefined, "HTTP 500")).toBe("HTTP 500");
  });

  it("trong /admin luôn tiếng Việt dù <html lang> là en (admin chỉ tiếng Việt)", () => {
    setPage("en", "/admin/users");
    expect(currentLocale()).toBe("vi");
    expect(localizeApiError("USER_NOT_FOUND", "User not found")).toBe("Không tìm thấy người dùng.");
  });

  it("lang lạ ⇒ mặc định vi", () => {
    setPage("fr");
    expect(currentLocale()).toBe("vi");
  });

  it("ApiClientError dịch sẵn message, giữ câu gốc ở rawMessage", () => {
    setPage("en");
    const err = new ApiClientError(409, "SPINE_VERSION_CONFLICT", "Tài liệu vừa được thay đổi ở phiên khác.");
    expect(err.message).toBe("The document just changed in another session. Please reload and try again.");
    expect(err.rawMessage).toBe("Tài liệu vừa được thay đổi ở phiên khác.");
    expect(err.code).toBe("SPINE_VERSION_CONFLICT");
  });
});
