import { afterEach, describe, expect, it, vi } from "vitest";
import {
  clearAccessToken,
  getAccessToken,
  hasSession,
  saveAuthToken,
  setAccessToken,
  setSessionPersistence,
} from "./token-store";

// JWT giả (chỉ cần payload có role để decode)
const token = (role: string) => `h.${btoa(JSON.stringify({ role }))}.s`;

const clearCookies = () => {
  for (const name of ["accessToken", "userRole"]) {
    document.cookie = `${name}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
  }
};

afterEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  clearCookies();
  setAccessToken(null);
});

describe("saveAuthToken - token chỉ nằm trong bộ nhớ", () => {
  it("không ghi access token ra localStorage, sessionStorage hay cookie đọc được bằng JS", () => {
    saveAuthToken(token("user"));
    expect(getAccessToken()).toBe(token("user"));
    expect(localStorage.getItem("accessToken")).toBeNull();
    expect(sessionStorage.getItem("accessToken")).toBeNull();
    expect(document.cookie).not.toMatch(/(?:^|; )accessToken=/);
  });

  it("xoá token bản cũ còn nằm ở storage / cookie FE", () => {
    localStorage.setItem("accessToken", "legacy");
    sessionStorage.setItem("accessToken", "legacy");
    document.cookie = "accessToken=legacy; path=/";
    saveAuthToken(token("user"));
    expect(localStorage.getItem("accessToken")).toBeNull();
    expect(sessionStorage.getItem("accessToken")).toBeNull();
    expect(document.cookie).not.toMatch(/(?:^|; )accessToken=/);
  });

  it("clearAccessToken xoá token khỏi bộ nhớ", () => {
    saveAuthToken(token("user"));
    clearAccessToken();
    expect(getAccessToken()).toBeNull();
  });
});

describe("saveAuthToken - chế độ Ghi nhớ tài khoản (nơi cất userRole)", () => {
  it("persistent: true ⇒ localStorage", () => {
    saveAuthToken(token("user"), undefined, { persistent: true });
    expect(localStorage.getItem("userRole")).toBe("user");
    expect(sessionStorage.getItem("userRole")).toBeNull();
  });

  it("persistent: false ⇒ sessionStorage (mất khi đóng trình duyệt), xoá bản ở localStorage", () => {
    localStorage.setItem("userRole", "stale");
    saveAuthToken(token("user"), undefined, { persistent: false });
    expect(sessionStorage.getItem("userRole")).toBe("user");
    expect(localStorage.getItem("userRole")).toBeNull();
  });

  it("refresh (không truyền persistent) ⇒ giữ chế độ đã chọn lúc đăng nhập", () => {
    saveAuthToken(token("user"), undefined, { persistent: false });
    saveAuthToken(token("admin"));
    expect(sessionStorage.getItem("userRole")).toBe("admin");
    expect(localStorage.getItem("userRole")).toBeNull();

    setSessionPersistence(true);
    saveAuthToken(token("user"));
    expect(localStorage.getItem("userRole")).toBe("user");
    expect(sessionStorage.getItem("userRole")).toBeNull();
  });
});

describe("hasSession", () => {
  it("tab vừa mở chưa có token trong bộ nhớ vẫn biết đang có phiên nhờ userRole", () => {
    expect(hasSession()).toBe(false);
    localStorage.setItem("userRole", "user");
    expect(getAccessToken()).toBeNull();
    expect(hasSession()).toBe(true);
  });
});

describe("đồng bộ giữa các tab", () => {
  it("tab khác lưu token mới / đăng xuất ⇒ bộ nhớ tab này theo", async () => {
    const otherTab = new BroadcastChannel("flintflow-auth");
    try {
      otherTab.postMessage({ type: "token", token: token("admin") });
      await vi.waitFor(() => expect(getAccessToken()).toBe(token("admin")));

      otherTab.postMessage({ type: "clear" });
      await vi.waitFor(() => expect(getAccessToken()).toBeNull());
    } finally {
      otherTab.close();
    }
  });
});
