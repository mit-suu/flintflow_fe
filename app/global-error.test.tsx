import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import GlobalError from "./global-error";

// File riêng: `<html>` dựng thẳng vào `document` làm root React thứ hai trên `document`. Cùng file với test khác
// thì React đã đánh dấu `document` là "đã gắn listener" từ root trước ⇒ sự kiện click của root này không chạy.
const boom = Object.assign(new Error("render hỏng"), { digest: "abc123" });

describe("app/global-error.tsx — lỗi ở root layout", () => {
  beforeEach(() => vi.spyOn(console, "error").mockImplementation(() => undefined));
  afterEach(() => {
    vi.restoreAllMocks();
    document.cookie = "NEXT_LOCALE=; path=/; max-age=0";
  });

  // `<html>` không lồng được trong `<div>` của RTL ⇒ dựng thẳng vào `document`
  const renderGlobal = (reset = vi.fn()) => {
    render(<GlobalError error={boom} reset={reset} />, { container: document });
    return reset;
  };

  it("tự bọc i18n (không cần provider của layout), Thử lại gọi reset()", () => {
    document.cookie = "NEXT_LOCALE=vi; path=/";
    const reset = renderGlobal();
    expect(screen.getByRole("heading", { name: "Đã có lỗi xảy ra" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Thử lại" }));
    expect(reset).toHaveBeenCalledTimes(1);
  });

  it("đọc ngôn ngữ từ cookie NEXT_LOCALE", () => {
    document.cookie = "NEXT_LOCALE=en; path=/";
    renderGlobal();
    expect(screen.getByRole("heading", { name: "Something went wrong" })).toBeInTheDocument();
    expect(document.documentElement).toHaveAttribute("lang", "en");
  });
});
