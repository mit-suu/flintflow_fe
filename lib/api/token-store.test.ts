import { afterEach, describe, expect, it } from "vitest";
import { getStoredAuthToken, saveAuthToken, setSessionPersistence } from "./token-store";

// JWT giả (chỉ cần payload có role để decode)
const token = (role: string) => `h.${btoa(JSON.stringify({ role }))}.s`;

const clearCookies = () => {
  for (const name of ["accessToken", "userRole"]) {
    document.cookie = `${name}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
  }
};

describe("saveAuthToken — chế độ Ghi nhớ tài khoản", () => {
  afterEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    clearCookies();
  });

  it("persistent: true ⇒ localStorage, không để token ở sessionStorage", () => {
    saveAuthToken(token("user"), undefined, { persistent: true });
    expect(localStorage.getItem("accessToken")).toBe(token("user"));
    expect(sessionStorage.getItem("accessToken")).toBeNull();
    expect(getStoredAuthToken()).toBe(token("user"));
  });

  it("persistent: false ⇒ sessionStorage (mất khi đóng trình duyệt), xoá bản cũ ở localStorage", () => {
    localStorage.setItem("accessToken", "stale");
    saveAuthToken(token("user"), undefined, { persistent: false });
    expect(sessionStorage.getItem("accessToken")).toBe(token("user"));
    expect(localStorage.getItem("accessToken")).toBeNull();
    expect(getStoredAuthToken()).toBe(token("user"));
  });

  it("refresh (không truyền persistent) ⇒ giữ chế độ đã chọn lúc đăng nhập", () => {
    saveAuthToken(token("user"), undefined, { persistent: false });
    saveAuthToken(token("admin"));
    expect(sessionStorage.getItem("accessToken")).toBe(token("admin"));
    expect(localStorage.getItem("accessToken")).toBeNull();

    setSessionPersistence(true);
    saveAuthToken(token("user"));
    expect(localStorage.getItem("accessToken")).toBe(token("user"));
    expect(sessionStorage.getItem("accessToken")).toBeNull();
  });

  it("chưa từng chọn ⇒ mặc định bền như trước", () => {
    saveAuthToken(token("user"));
    expect(localStorage.getItem("accessToken")).toBe(token("user"));
  });
});
