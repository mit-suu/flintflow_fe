import type { Page } from "@playwright/test";

/**
 * Đăng nhập qua form rồi CHỜ PHIÊN ỔN ĐỊNH trước khi trả về.
 *
 * Đăng nhập xong trang login chuyển hẳn trang (`window.location.href`) ⇒ token trong bộ nhớ mất, `/home` gọi
 * `POST /auth/refresh` để lấy lại. Nếu test `page.goto` sang trang khác trong lúc lượt refresh đó còn bay, request bị huỷ
 * nhưng BE đã xoay refresh token; trang sau gửi token cũ ⇒ BE coi là dùng lại token ⇒ 401 ⇒ đăng xuất. Người dùng thật
 * không chuyển trang trong vài trăm mili-giây đầu, nên chờ lượt refresh xong mới là đúng hành vi cần kiểm.
 */
export const loginThroughUi = async (
  page: Page,
  email: string,
  password: string,
  options: { timeout?: number } = {}
): Promise<void> => {
  const timeout = options.timeout ?? 30_000;
  await page.goto("/login");
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(password);
  // Đăng ký chờ TRƯỚC khi bấm: lượt refresh có thể xong ngay khi trang đích vừa tải
  const sessionRefreshed = page.waitForResponse(
    (res) => res.url().includes("/auth/refresh") && res.request().method() === "POST" && res.ok(),
    { timeout }
  );
  await Promise.all([page.waitForURL(/\/home/, { timeout }), page.locator('form button[type="submit"]').click()]);
  await sessionRefreshed;
};
