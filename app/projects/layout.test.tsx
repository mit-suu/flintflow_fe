import { screen, waitFor } from "@testing-library/react";
import { renderWithIntl } from "@/test/intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchMe } from "@/lib/api/users";
import {
  markAccountLocaleSettled,
  resetAccountLocaleSync,
} from "@/lib/hooks/use-account-locale";
// `layout.tsx` là server component (đọc cookie bản nhớ); phần client — AuthGuard + đồng bộ ngôn ngữ tài khoản — nằm ở đây
import ProjectsLayoutClient from "./workspace-boot";

const BOOT = { memory: null, importPendingIds: [], profileName: null, orgRole: null };

const router = vi.hoisted(() => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router, usePathname: () => "/projects" }));
vi.mock("@/lib/api/users", () => ({
  fetchMe: vi.fn(),
  updateMyLocale: vi.fn(async () => ({})),
}));
vi.mock("@/lib/auth", () => ({
  isAuthenticated: () => true,
  getUserRole: () => "member",
  logoutAndRedirect: vi.fn(),
}));

const clearCookie = () => {
  document.cookie = "NEXT_LOCALE=; path=/; max-age=0";
};

beforeEach(() => {
  vi.clearAllMocks();
  resetAccountLocaleSync();
  clearCookie();
});
afterEach(clearCookie);

describe("ProjectsLayout", () => {
  it("vào thẳng trang dự án trên thiết bị mới: UI vi, tài khoản en ⇒ ghi cookie NEXT_LOCALE=en và refresh", async () => {
    vi.mocked(fetchMe).mockResolvedValue({
      id: "u-1",
      email: "member@flintflow.vn",
      name: "Thành viên",
      locale: "en",
    } as never);

    renderWithIntl(
      <ProjectsLayoutClient boot={BOOT}>
        <p>project content</p>
      </ProjectsLayoutClient>,
      "vi"
    );

    expect(await screen.findByText("project content")).toBeInTheDocument();
    await waitFor(() => {
      expect(document.cookie).toContain("NEXT_LOCALE=en");
      expect(router.refresh).toHaveBeenCalledOnce();
    });
  });

  it("nếu trước đó đã đồng bộ (isAccountLocaleSettled) ⇒ không gọi lại fetchMe", async () => {
    markAccountLocaleSettled();

    renderWithIntl(
      <ProjectsLayoutClient boot={BOOT}>
        <p>project content</p>
      </ProjectsLayoutClient>,
      "vi"
    );

    expect(await screen.findByText("project content")).toBeInTheDocument();
    expect(fetchMe).not.toHaveBeenCalled();
    expect(document.cookie).not.toContain("NEXT_LOCALE");
    expect(router.refresh).not.toHaveBeenCalled();
  });

  it("lỗi fetchMe khi tải layout dự án ⇒ bỏ qua lỗi im lặng, vẫn hiển thị children", async () => {
    vi.mocked(fetchMe).mockRejectedValueOnce(new Error("Network error"));

    renderWithIntl(
      <ProjectsLayoutClient boot={BOOT}>
        <p>project content</p>
      </ProjectsLayoutClient>,
      "vi"
    );

    expect(await screen.findByText("project content")).toBeInTheDocument();
    await waitFor(() => expect(fetchMe).toHaveBeenCalled());
  });
});
