import { waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { updateMyLocale } from "@/lib/api/users";
import { renderHookWithIntl } from "@/test/intl";
import { markAccountLocaleSettled, resetAccountLocaleSync, useAccountLocaleSync } from "./use-account-locale";

const router = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("@/lib/api/users", () => ({ updateMyLocale: vi.fn(async () => ({})) }));

const clearCookie = () => {
  document.cookie = "NEXT_LOCALE=; path=/; max-age=0";
};

beforeEach(() => {
  vi.clearAllMocks();
  resetAccountLocaleSync();
  clearCookie();
});
afterEach(clearCookie);

describe("useAccountLocaleSync", () => {
  it("chưa có hồ sơ ⇒ không làm gì", () => {
    renderHookWithIntl(() => useAccountLocaleSync(null), "vi");
    expect(router.refresh).not.toHaveBeenCalled();
    expect(updateMyLocale).not.toHaveBeenCalled();
    expect(document.cookie).not.toContain("NEXT_LOCALE");
  });

  it("tài khoản chọn en, đang hiển thị vi ⇒ ghi cookie en rồi refresh để server render lại", () => {
    renderHookWithIntl(() => useAccountLocaleSync({ locale: "en" }), "vi");
    expect(document.cookie).toContain("NEXT_LOCALE=en");
    expect(router.refresh).toHaveBeenCalledOnce();
    expect(updateMyLocale).not.toHaveBeenCalled();
  });

  it("tài khoản trùng ngôn ngữ đang hiển thị ⇒ ghim cookie, không refresh", () => {
    renderHookWithIntl(() => useAccountLocaleSync({ locale: "vi" }), "vi");
    expect(document.cookie).toContain("NEXT_LOCALE=vi");
    expect(router.refresh).not.toHaveBeenCalled();
  });

  it.each([{}, { locale: null }, { locale: "fr" as never }])(
    "tài khoản chưa chọn (%o) ⇒ lưu ngôn ngữ đang hiển thị, không refresh",
    (account) => {
      renderHookWithIntl(() => useAccountLocaleSync(account), "en");
      expect(updateMyLocale).toHaveBeenCalledWith("en");
      expect(router.refresh).not.toHaveBeenCalled();
    }
  );

  it("lưu lỗi ⇒ ghi console.error, không ném lỗi", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.mocked(updateMyLocale).mockRejectedValueOnce(new Error("400"));
    renderHookWithIntl(() => useAccountLocaleSync({ locale: null }), "vi");
    await waitFor(() =>
      expect(consoleError).toHaveBeenCalledWith(expect.stringContaining("[useAccountLocaleSync]"), expect.any(Error))
    );
    consoleError.mockRestore();
  });

  it("chỉ chạy một lần mỗi lần tải trang — rerender hay remount không refresh / lưu lại", () => {
    const first = renderHookWithIntl(({ account }) => useAccountLocaleSync(account), "vi", {
      initialProps: { account: { locale: "en" as const } },
    });
    first.rerender({ account: { locale: "en" as const } });
    first.unmount();
    renderHookWithIntl(() => useAccountLocaleSync({ locale: null }), "vi");
    expect(router.refresh).toHaveBeenCalledOnce();
    expect(updateMyLocale).not.toHaveBeenCalled();
  });

  it("user đã tự chọn trước khi hồ sơ về ⇒ không ghi đè lựa chọn đó", () => {
    markAccountLocaleSettled();
    renderHookWithIntl(() => useAccountLocaleSync({ locale: "en" }), "vi");
    expect(document.cookie).not.toContain("NEXT_LOCALE");
    expect(router.refresh).not.toHaveBeenCalled();
    expect(updateMyLocale).not.toHaveBeenCalled();
  });
});
