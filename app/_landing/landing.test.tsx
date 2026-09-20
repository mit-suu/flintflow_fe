import { render, screen, within } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import LandingPage from "../page";

// jsdom không có IntersectionObserver; `whileInView` của motion và scroll-spy của header cần nó.
// Stub không bao giờ báo giao cắt ⇒ phần tử giữ trạng thái ban đầu, vẫn nằm trong DOM để truy vấn.
beforeAll(() => {
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
      takeRecords() {
        return [];
      }
    }
  );
});

describe("LandingPage", () => {
  it("dẫn các CTA chính tới đăng ký / đăng nhập", () => {
    render(<LandingPage />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(/Hiểu đúng sản phẩm\s*trước khi viết code\./);
    expect(screen.getByRole("link", { name: "Đăng nhập" })).toHaveAttribute("href", "/login");
    expect(screen.getByRole("link", { name: /Tạo dự án đầu tiên/ })).toHaveAttribute("href", "/register");
  });

  it("nav trỏ tới đúng section có trên trang", () => {
    const { container } = render(<LandingPage />);
    const nav = screen.getByRole("navigation", { name: "Điều hướng chính" });
    for (const link of within(nav).getAllByRole("link")) {
      const id = link.getAttribute("href")!.slice(1);
      expect(container.querySelector(`#${id}`)).not.toBeNull();
    }
  });

  it("bảng giá khớp plan.config của BE (Free 100 credit, Pro 199k)", () => {
    render(<LandingPage />);
    const pricing = screen.getByRole("region", { name: "Dùng thử không tốn gì." });
    expect(within(pricing).getByText(/^100 credit mỗi tháng/)).toBeInTheDocument();
    expect(within(pricing).getByText("199k")).toBeInTheDocument();
  });
});
