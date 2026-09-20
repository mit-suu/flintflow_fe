import { describe, expect, it, vi } from "vitest";

/*
 * Cấu hình locale mỗi request. Test chạy thẳng hàm callback (bỏ lớp bọc của next-intl) với cookie `en`.
 * Bug đã gặp: bỏ qua `locale` do nơi gọi xin ⇒ `getMessages({ locale: "vi" })` ở layout admin nhận bản `en`.
 */

const request = vi.hoisted(() => ({ cookie: "en" as string | undefined, acceptLanguage: "en-US,en;q=0.9" }));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => (request.cookie ? { value: request.cookie } : undefined) }),
  headers: async () => new Headers({ "accept-language": request.acceptLanguage }),
}));
vi.mock("next-intl/server", () => ({ getRequestConfig: <T,>(fn: T) => fn }));

const { default: requestConfig } = await import("./request");
const run = (locale?: "vi" | "en") => requestConfig({ locale, requestLocale: Promise.resolve(undefined) });

describe("i18n/request", () => {
  it("nơi gọi xin locale cụ thể ⇒ dùng đúng locale đó, bỏ qua cookie", async () => {
    const config = await run("vi");
    expect(config.locale).toBe("vi");
    expect((config.messages as { app: { authGuard: { checking: string } } }).app.authGuard.checking).toBe(
      "Đang kiểm tra quyền truy cập..."
    );
  });

  it("không xin gì ⇒ theo cookie", async () => {
    request.cookie = "en";
    expect((await run()).locale).toBe("en");
  });

  it("không cookie ⇒ theo Accept-Language, rồi mới tới vi", async () => {
    request.cookie = undefined;
    request.acceptLanguage = "en-US";
    expect((await run()).locale).toBe("en");
    request.acceptLanguage = "fr-FR";
    expect((await run()).locale).toBe("vi");
  });
});
