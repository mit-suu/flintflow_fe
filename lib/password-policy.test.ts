import { describe, expect, it } from "vitest";
import { checkPassword, passwordLevel, PASSWORD_MAX_LENGTH } from "./password-policy";

/**
 * Bộ ca này cố tình TRÙNG với `flintflow_be/src/shared/utils/password-policy.test.ts`: hai bản sao lệch
 * nhau là kiểu lỗi FE cho qua rồi BE mới từ chối. Sửa một bên thì chạy lại cả hai.
 */
describe("password-policy — luật cứng", () => {
  it("mật khẩu đạt chuẩn ⇒ không lỗi", () => {
    expect(checkPassword("Mua2Roi!")).toBeNull(); // 8 ký tự, đủ 4 nhóm
    expect(checkPassword("bien-xanh-2026")).toBeNull(); // 14 ký tự, 3 nhóm
  });

  it("ngắn hơn 8 ký tự ⇒ too_short, kể cả khi đủ phức tạp", () => {
    expect(checkPassword("Ab1!xy")).toBe("too_short");
  });

  it(`dài hơn ${PASSWORD_MAX_LENGTH} ký tự ⇒ too_long, vì bcrypt lặng lẽ cắt phần dư`, () => {
    expect(checkPassword(`A1!${"a".repeat(PASSWORD_MAX_LENGTH)}`)).toBe("too_long");
  });

  it("tiếng Việt có dấu ⇒ not_ascii", () => {
    expect(checkPassword("Đườngxưa1!")).toBe("not_ascii");
    expect(checkPassword("Muaroi2026ữ!")).toBe("not_ascii");
  });

  it("khoảng trắng và emoji cũng không được ⇒ not_ascii", () => {
    expect(checkPassword("Mua Roi 2026!")).toBe("not_ascii");
    expect(checkPassword("Muaroi2026!🙂")).toBe("not_ascii");
  });

  it("chỉ 2 nhóm ký tự ⇒ not_complex", () => {
    expect(checkPassword("matkhaudai")).toBe("not_complex");
    expect(checkPassword("matkhau2026")).toBe("not_complex");
  });

  it("mật khẩu kiểu 'đúng khuôn mẫu' vẫn được nhận — không còn danh sách chặn", () => {
    expect(checkPassword("Password1!")).toBeNull();
    expect(checkPassword("Flintflow2026")).toBeNull();

    // Các mục trong danh sách cũ vẫn bị chặn, chỉ là bằng luật khác
    expect(checkPassword("password")).toBe("not_complex");
    expect(checkPassword("123456")).toBe("too_short");
    expect(checkPassword("flintflow123")).toBe("not_complex");
  });
});

describe("password-policy — ngưỡng 'Khá' trở lên mới được dùng", () => {
  it("qua hết luật cứng nhưng mới mức 1 ⇒ not_strong_enough", () => {
    expect(passwordLevel("muaroi2!")).toBe(1); // 8 ký tự, đúng 3 nhóm
    expect(checkPassword("muaroi2!")).toBe("not_strong_enough");
  });

  it("mức 2 (Khá) ⇒ được dùng: hoặc từ 12 ký tự, hoặc đủ 4 nhóm", () => {
    expect(passwordLevel("muaroi2026!x")).toBe(2); // 12 ký tự, 3 nhóm
    expect(passwordLevel("Mua2Roi!")).toBe(2); // 8 ký tự nhưng đủ 4 nhóm
    expect(checkPassword("muaroi2026!x")).toBeNull();
    expect(checkPassword("Mua2Roi!")).toBeNull();
  });

  it("mức 3 (Mạnh) ⇒ từ 12 ký tự VÀ đủ 4 nhóm", () => {
    expect(passwordLevel("Binh1211!xyz")).toBe(3); // 12 ký tự — ngay mốc
    expect(passwordLevel("Binh1211!xy")).toBe(2); // 11 ký tự — chưa tới
  });

  it("vi phạm luật cứng ⇒ mức 0 dù dài bao nhiêu", () => {
    expect(passwordLevel("matkhaudaithoodai")).toBe(0);
  });
});

describe("password-policy — KHÔNG còn đối chiếu với tên / email", () => {
  it("mật khẩu trùng tên hay phần email vẫn được chấp nhận", () => {
    expect(checkPassword("Minhhoang2026")).toBeNull();
    expect(checkPassword("Quangvinh!9")).toBeNull();
  });
});
