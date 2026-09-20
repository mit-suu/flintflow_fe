import { fireEvent, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithIntl } from "@/test/intl";
import LocaleSwitcher from "./LocaleSwitcher";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

const account = vi.hoisted(() => ({ token: null as string | null, updateMyLocale: vi.fn(async () => ({ data: null, error: null })) }));
vi.mock("@/lib/api/token-store", () => ({ getStoredAuthToken: () => account.token }));
vi.mock("@/lib/api/users", () => ({ updateMyLocale: account.updateMyLocale }));

const clearCookie = () => {
  document.cookie = "NEXT_LOCALE=; path=/; max-age=0";
};

describe("LocaleSwitcher", () => {
  beforeEach(() => {
    refresh.mockClear();
    account.updateMyLocale.mockClear();
    account.token = null;
    clearCookie();
  });

  it("đánh dấu ngôn ngữ đang dùng", () => {
    renderWithIntl(<LocaleSwitcher />, "vi");
    expect(screen.getByRole("button", { name: "Tiếng Việt" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "English" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("group", { name: "Ngôn ngữ" })).toBeInTheDocument();
  });

  it("chọn ngôn ngữ khác ⇒ ghi cookie NEXT_LOCALE rồi refresh để server render lại", () => {
    renderWithIntl(<LocaleSwitcher />, "vi");
    fireEvent.click(screen.getByRole("button", { name: "English" }));
    expect(document.cookie).toContain("NEXT_LOCALE=en");
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("trình duyệt có View Transitions ⇒ cross-fade quanh lần refresh", async () => {
    let captured: (() => void | Promise<void>) | null = null;
    const startViewTransition = vi.fn((cb: () => void | Promise<void>) => {
      captured = cb;
      return { finished: Promise.resolve() };
    });
    Object.defineProperty(document, "startViewTransition", { value: startViewTransition, configurable: true });

    renderWithIntl(<LocaleSwitcher />, "vi");
    fireEvent.click(screen.getByRole("button", { name: "English" }));

    expect(startViewTransition).toHaveBeenCalledOnce();
    // Refresh chạy TRONG callback: ảnh chụp "trước" phải lấy xong rồi cây mới được tráo
    expect(refresh).not.toHaveBeenCalled();
    const done = captured!();
    expect(refresh).toHaveBeenCalledOnce();
    // startTransition trong test chạy đồng bộ ⇒ promise chốt ngay, không chờ hết timeout dự phòng
    await expect(done).resolves.toBeUndefined();

    Reflect.deleteProperty(document, "startViewTransition");
  });

  it("trình duyệt không có View Transitions ⇒ vẫn đổi, chỉ không có hiệu ứng", () => {
    expect((document as { startViewTransition?: unknown }).startViewTransition).toBeUndefined();
    renderWithIntl(<LocaleSwitcher />, "vi");
    fireEvent.click(screen.getByRole("button", { name: "English" }));
    expect(refresh).toHaveBeenCalledOnce();
    expect(document.cookie).toContain("NEXT_LOCALE=en");
  });

  it("chưa đăng nhập ⇒ chỉ ghi cookie, không gọi BE", () => {
    renderWithIntl(<LocaleSwitcher />, "vi");
    fireEvent.click(screen.getByRole("button", { name: "English" }));
    expect(account.updateMyLocale).not.toHaveBeenCalled();
  });

  it("đã đăng nhập ⇒ lưu luôn vào tài khoản (PATCH /users/me)", () => {
    account.token = "jwt";
    renderWithIntl(<LocaleSwitcher />, "vi");
    fireEvent.click(screen.getByRole("button", { name: "English" }));
    expect(account.updateMyLocale).toHaveBeenCalledWith("en");
    expect(document.cookie).toContain("NEXT_LOCALE=en");
  });

  it("bấm lại ngôn ngữ đang dùng thì không làm gì", () => {
    renderWithIntl(<LocaleSwitcher />, "en");
    fireEvent.click(screen.getByRole("button", { name: "English" }));
    expect(document.cookie).not.toContain("NEXT_LOCALE");
    expect(refresh).not.toHaveBeenCalled();
  });
});
