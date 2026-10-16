import { afterEach, describe, expect, it } from "vitest";
import { ApiClientError } from "./client";
import { currentLocale, localizeApiError, userErrorMessage } from "./error-messages";

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

  it("FILE_TOO_LARGE có meta.max_mb (upload SRS) ⇒ câu nêu giới hạn MB + cách nén ảnh; không meta ⇒ câu chung", () => {
    setPage("vi");
    expect(new ApiClientError(413, "FILE_TOO_LARGE", "File vượt giới hạn 40 MB.", { max_mb: 40 }).message).toBe(
      "File vượt giới hạn 40 MB. Hãy nén ảnh trong Word (File → Compress Pictures) hoặc tách phụ lục rồi tải lại."
    );
    expect(localizeApiError("FILE_TOO_LARGE", "File quá lớn")).toContain("File → Compress Pictures");
    setPage("en");
    expect(localizeApiError("FILE_TOO_LARGE", "x", undefined, { max_mb: 40 })).toBe(
      "The file exceeds the 40 MB limit. Compress the pictures in Word (File → Compress Pictures) or move appendices out, then upload again."
    );
  });

  it("mã mơ hồ / mang chi tiết động hoặc không có mã ⇒ giữ nguyên message BE", () => {
    setPage("en");
    expect(localizeApiError("FORBIDDEN", "Chỉ Admin mới có quyền thực hiện thao tác này")).toBe("Chỉ Admin mới có quyền thực hiện thao tác này");
    expect(localizeApiError("VALIDATION_ERROR", "from phải trước to")).toBe("from phải trước to");
  });

  it("câu BE là text kỹ thuật ⇒ câu chung theo ngôn ngữ (FLF-247)", () => {
    setPage("vi");
    expect(localizeApiError(undefined, "HTTP 500")).toBe("Có lỗi xảy ra. Vui lòng thử lại sau.");
    expect(localizeApiError("INTERNAL_SERVER_ERROR", "Cannot read properties of undefined (reading x)")).toBe(
      "Hệ thống gặp lỗi khi xử lý yêu cầu. Vui lòng thử lại sau."
    );
    for (const raw of [
      "PATH_LOCKED: actors[id=A03]",
      "Sai schema tại \"screens.0\": Unrecognized key: \"authorized_role_ids\"",
      "✖ Invalid input: expected number, received undefined → at base_version",
      "E11000 duplicate key error collection",
      "Project not found or unauthorized",
      "",
    ]) {
      expect(localizeApiError("SOME_NEW_CODE", raw)).toBe("Có lỗi xảy ra. Vui lòng thử lại sau.");
    }
    setPage("en");
    expect(localizeApiError(undefined, "HTTP 500")).toBe("Something went wrong. Please try again later.");
  });

  it("mã FE tự gán khi BE không có mã ⇒ ưu tiên câu BE nếu là câu cho người (FLF-247)", () => {
    setPage("vi");
    expect(localizeApiError("STREAM_FAILED", "Không đủ credit để chạy bước này")).toBe("Không đủ credit để chạy bước này");
    expect(localizeApiError("STREAM_FAILED", "HTTP 500: Failed to stream response")).toBe("Không nhận được phản hồi từ máy chủ. Vui lòng thử lại.");
  });

  it("userErrorMessage: lỗi mạng / JSON / JS ⇒ không lộ text kỹ thuật; câu FE giữ nguyên (FLF-247)", () => {
    setPage("vi");
    expect(userErrorMessage(new TypeError("Failed to fetch"), "dự phòng")).toBe("Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.");
    expect(userErrorMessage(new SyntaxError("Unexpected token < in JSON at position 0"), "dự phòng")).toBe("dự phòng");
    expect(userErrorMessage(new Error("Không tải được tài liệu"), "dự phòng")).toBe("Không tải được tài liệu");
    expect(userErrorMessage("chuỗi trần")).toBe("Có lỗi xảy ra. Vui lòng thử lại sau.");
    expect(userErrorMessage(new ApiClientError(500, "X_UNMAPPED", "HTTP 500"), "Không tải được danh sách cờ")).toBe("Không tải được danh sách cờ");
  });

  it("trong /admin luôn tiếng Việt dù <html lang> là en (admin chỉ tiếng Việt)", () => {
    setPage("en", "/admin/users");
    expect(currentLocale()).toBe("vi");
    expect(localizeApiError("USER_NOT_FOUND", "User not found")).toBe("Không tìm thấy người dùng.");
  });

  it("AI trả sai khuôn (SCHEMA_MISMATCH / PARSE_FAILED) ⇒ câu cho người, không lộ thông báo Zod", () => {
    setPage("vi");
    const raw = "AI response failed Zod schema validation for action 'change_instruction': [...]";
    expect(localizeApiError("SCHEMA_MISMATCH", raw)).toBe("AI trả kết quả không đúng dạng. Thử lại, hoặc nói rõ hơn yêu cầu.");
    expect(localizeApiError("PARSE_FAILED", raw)).not.toContain("Zod");
    setPage("en");
    expect(localizeApiError("SCHEMA_MISMATCH", raw)).not.toContain("Zod");
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
