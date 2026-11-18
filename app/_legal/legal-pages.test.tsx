import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderWithIntl, vietnameseLeftovers } from "@/test/intl";
import PrivacyPage from "../privacy/page";
import TermsPage from "../terms/page";

vi.mock("next-intl/server", () => ({ getTranslations: vi.fn() }));
// Header có LocaleSwitcher - dùng router để làm mới trang sau khi đổi ngôn ngữ
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }) }));

describe("trang pháp lý /privacy và /terms", () => {
  it("privacy nêu quyền drive.file, cam kết Limited Use và link tới chính sách của Google", () => {
    renderWithIntl(<PrivacyPage />);
    expect(screen.getByRole("heading", { level: 1, name: "Chính sách quyền riêng tư" })).toBeInTheDocument();
    expect(screen.getByText(/chỉ xin quyền drive\.file/)).toBeInTheDocument();
    expect(screen.getByText(/Sử dụng có giới hạn \(Limited Use\)/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Google API Services User Data Policy" })).toHaveAttribute(
      "href",
      "https://developers.google.com/terms/api-services-user-data-policy"
    );
  });

  it("footer trỏ chéo giữa hai trang và về trang chủ", () => {
    renderWithIntl(<TermsPage />);
    expect(screen.getByRole("heading", { level: 1, name: "Điều khoản sử dụng" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Chính sách quyền riêng tư" })).toHaveAttribute("href", "/privacy");
    expect(screen.getByRole("link", { name: "Về trang chủ" })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: "trantuanhiep28122003@gmail.com" })).toHaveAttribute(
      "href",
      "mailto:trantuanhiep28122003@gmail.com"
    );
  });

  it("tiếng Anh: không sót chữ tiếng Việt", () => {
    const privacy = renderWithIntl(<PrivacyPage />, "en");
    expect(screen.getByRole("heading", { level: 1, name: "Privacy Policy" })).toBeInTheDocument();
    expect(vietnameseLeftovers(privacy.container)).toEqual([]);
    privacy.unmount();

    const terms = renderWithIntl(<TermsPage />, "en");
    expect(screen.getByRole("heading", { level: 1, name: "Terms of Service" })).toBeInTheDocument();
    expect(vietnameseLeftovers(terms.container)).toEqual([]);
  });
});
