import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderWithIntl, vietnameseLeftovers } from "@/test/intl";
import LandingPage from "../page";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

describe("Landing page — song ngữ (T25)", () => {
  it("vi: giữ nguyên nội dung tiếng Việt như trước khi tách chuỗi", () => {
    renderWithIntl(<LandingPage />, "vi");
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Biến ý tưởng thô thành SRS chuẩn nghiệm thu.");
    expect(screen.getByRole("link", { name: "Đăng nhập" })).toHaveAttribute("href", "/login");
    expect(screen.getByRole("navigation", { name: "Điều hướng chính" })).toHaveTextContent("Bảng giá");
    expect(screen.getByText("Khuyên dùng")).toBeInTheDocument();
    expect(screen.getByText("0đ")).toBeInTheDocument();
    expect(screen.getByText("199k")).toBeInTheDocument();
    expect(screen.getByText("1.000")).toBeInTheDocument();
    expect(screen.getByText("100 · 500 · 1.500")).toBeInTheDocument();
    expect(screen.getByText("142 yêu cầu nhất quán")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("ban@congty.vn")).toBeInTheDocument();
    // Form cuối gửi GET /register?email=… và không còn hứa "workspace mẫu" (chưa có tính năng đó)
    const form = screen.getByPlaceholderText("ban@congty.vn").closest("form")!;
    expect(form).toHaveAttribute("action", "/register");
    expect(screen.getByRole("button", { name: /Bắt đầu/ })).toBeInTheDocument();
    expect(screen.queryByText(/workspace mẫu/)).not.toBeInTheDocument();
  });

  it("en: dịch đủ, không còn ký tự tiếng Việt nào (kể cả aria-label, placeholder)", () => {
    const { container } = renderWithIntl(<LandingPage />, "en");
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Turn rough ideas into sign-off-ready SRS.");
    expect(screen.getByRole("link", { name: "Log in" })).toHaveAttribute("href", "/login");
    expect(screen.getByText("₫199k")).toBeInTheDocument();
    expect(screen.getByText("1,000")).toBeInTheDocument();
    expect(screen.getByText("3 impacted areas")).toBeInTheDocument();
    expect(screen.getByText("1 open conflict")).toBeInTheDocument();

    expect(vietnameseLeftovers(container)).toEqual([]);
  });

  it("en: tab audit log của mockup cũng không còn tiếng Việt", () => {
    const { container } = renderWithIntl(<LandingPage />, "en");
    fireEvent.click(screen.getByRole("tab", { name: "audit_log.json" }));
    expect(vietnameseLeftovers(container)).toEqual([]);
  });

  it("nội dung tài liệu mẫu trong mockup là tiếng Anh ở cả bản vi — đúng với SRS thật", () => {
    renderWithIntl(<LandingPage />, "vi");
    expect(screen.getByText("F-S04-01 · Submit permit application")).toBeInTheDocument();
    expect(screen.getByText("UC-03 · Submit application — Preconditions")).toBeInTheDocument();
  });

  it("anchor điều hướng giữ nguyên id ở mọi ngôn ngữ", () => {
    renderWithIntl(<LandingPage />, "en");
    // Header và footer đều có hai link này.
    const hrefs = (name: string) => screen.getAllByRole("link", { name }).map((a) => a.getAttribute("href"));
    expect(hrefs("How it works")).toEqual(["#cach-hoat-dong", "#cach-hoat-dong"]);
    expect(hrefs("Pricing")).toEqual(["#bang-gia", "#bang-gia"]);
  });
});
