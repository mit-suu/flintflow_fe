import { fireEvent, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithIntl, vietnameseLeftovers } from "@/test/intl";
import ErrorPage from "./error";
import MaintenancePage from "./maintenance/page";

vi.mock("next-intl/server", () => ({ getTranslations: vi.fn() }));

const boom = Object.assign(new Error("render hỏng"), { digest: "abc123" });

describe("app/error.tsx — trang lỗi FlintFlow", () => {
  beforeEach(() => vi.spyOn(console, "error").mockImplementation(() => undefined));
  afterEach(() => vi.restoreAllMocks());

  it("hiện thẻ lỗi theo ngôn ngữ, nút Thử lại gọi reset(), có link về trang chủ và mã lỗi", () => {
    const reset = vi.fn();
    renderWithIntl(<ErrorPage error={boom} reset={reset} />);
    expect(screen.getByRole("heading", { name: "Đã có lỗi xảy ra" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Về trang chủ" })).toHaveAttribute("href", "/");
    expect(screen.getByText("Mã lỗi: abc123")).toBeInTheDocument();
    // Không lộ message kỹ thuật cho người dùng
    expect(screen.queryByText(/render hỏng/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Thử lại" }));
    expect(reset).toHaveBeenCalledTimes(1);
  });

  it("có unstable_retry (Next 16) thì Thử lại dùng nó", () => {
    const reset = vi.fn();
    const retry = vi.fn();
    renderWithIntl(<ErrorPage error={boom} reset={reset} unstable_retry={retry} />);
    fireEvent.click(screen.getByRole("button", { name: "Thử lại" }));
    expect(retry).toHaveBeenCalledTimes(1);
    expect(reset).not.toHaveBeenCalled();
  });

  it("tiếng Anh: không sót chữ tiếng Việt", () => {
    const { container } = renderWithIntl(<ErrorPage error={new Error("x")} reset={vi.fn()} />, "en");
    expect(screen.getByRole("heading", { name: "Something went wrong" })).toBeInTheDocument();
    expect(vietnameseLeftovers(container)).toEqual([]);
  });
});

describe("/maintenance", () => {
  it("trang bảo trì FlintFlow, có đường về trang chủ", () => {
    renderWithIntl(<MaintenancePage />);
    expect(screen.getByRole("heading", { name: "FlintFlow đang bảo trì" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Về trang chủ" })).toHaveAttribute("href", "/");
  });

  it("tiếng Anh: không sót chữ tiếng Việt", () => {
    const { container } = renderWithIntl(<MaintenancePage />, "en");
    expect(screen.getByRole("heading", { name: "FlintFlow is under maintenance" })).toBeInTheDocument();
    expect(vietnameseLeftovers(container)).toEqual([]);
  });
});
