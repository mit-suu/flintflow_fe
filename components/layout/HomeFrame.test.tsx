import { fireEvent, screen, waitFor } from "@testing-library/react";
import { renderWithIntl } from "@/test/intl";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getActiveOrgId } from "@/lib/api/token-store";
import { logoutAndRedirect } from "@/lib/auth";
import { fetchMe } from "@/lib/api/users";
import HomeFrame from "./HomeFrame";

let pathname = "/home/onboarding";
vi.mock("next/navigation", () => ({
  usePathname: () => pathname,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
}));
vi.mock("@/lib/api/token-store", () => ({ getActiveOrgId: vi.fn() }));
vi.mock("@/lib/auth", () => ({ logoutAndRedirect: vi.fn(async () => undefined) }));
// Khung đầy đủ và guard được test riêng — ở đây chỉ cần biết HomeFrame chọn khung nào
vi.mock("./AppShell", () => ({ default: ({ sidebar, children }: { sidebar: React.ReactNode; children: React.ReactNode }) => <div data-testid="app-shell">{sidebar}{children}</div> }));
vi.mock("./AppSidebar", () => ({ default: ({ user }: { user: { name: string } }) => <nav data-testid="app-sidebar">{user.name}</nav> }));
vi.mock("@/lib/api/users", () => ({ fetchMe: vi.fn() }));
vi.mock("@/lib/hooks/use-projects", () => ({ ProjectsProvider: ({ children }: { children: React.ReactNode }) => <div data-testid="projects-provider">{children}</div> }));
vi.mock("@/components/OrgGuard", () => ({
  ONBOARDING_PATH: "/home/onboarding",
  default: ({ children }: { children: React.ReactNode }) => <div data-testid="org-guard">{children}</div>,
}));

const user = { name: "tien", email: "tien@flintflow.test", isAdmin: false };

beforeEach(() => {
  vi.clearAllMocks();
  pathname = "/home/onboarding";
  vi.mocked(fetchMe).mockResolvedValue({ email: "tien@flintflow.test" } as never);
});

describe("HomeFrame", () => {
  it("chưa có tổ chức: khung tối giản — không thanh bên, không tải dự án, có Đăng xuất", () => {
    vi.mocked(getActiveOrgId).mockReturnValue(null);
    renderWithIntl(<HomeFrame user={user}><p>màn onboarding</p></HomeFrame>);

    expect(screen.getByText("màn onboarding")).toBeInTheDocument();
    expect(screen.queryByTestId("app-sidebar")).toBeNull();
    expect(screen.queryByTestId("projects-provider")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Đăng xuất" }));
    expect(logoutAndRedirect).toHaveBeenCalledOnce();
  });

  it("chưa có tổ chức mà ở trang khác: vẫn khung tối giản, OrgGuard lo đưa về onboarding", () => {
    pathname = "/home";
    vi.mocked(getActiveOrgId).mockReturnValue(null);
    renderWithIntl(<HomeFrame user={user}><p>trang chủ</p></HomeFrame>);

    expect(screen.getByTestId("org-guard")).toBeInTheDocument();
    expect(screen.queryByTestId("app-sidebar")).toBeNull();
  });

  it("có tổ chức: khung đầy đủ với thanh bên và ProjectsProvider", () => {
    pathname = "/home";
    vi.mocked(getActiveOrgId).mockReturnValue("org-1");
    renderWithIntl(<HomeFrame user={user}><p>trang chủ</p></HomeFrame>);

    expect(screen.getByTestId("app-sidebar")).toBeInTheDocument();
    expect(screen.getByTestId("projects-provider")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Đăng xuất" })).toBeNull();
  });
});

describe("HomeFrame — tên ở thanh bên", () => {
  it("hồ sơ có tên ⇒ thay tên đoán từ email bằng tên thật", async () => {
    pathname = "/home";
    vi.mocked(getActiveOrgId).mockReturnValue("org-1");
    vi.mocked(fetchMe).mockResolvedValue({ email: "tien@flintflow.test", name: "Tiến Nguyễn" } as never);
    renderWithIntl(<HomeFrame user={user}><p>trang chủ</p></HomeFrame>);

    expect(await screen.findByText("Tiến Nguyễn")).toBeInTheDocument();
  });

  it("không lấy được hồ sơ ⇒ giữ tên đoán từ email", async () => {
    pathname = "/home";
    vi.mocked(getActiveOrgId).mockReturnValue("org-1");
    vi.mocked(fetchMe).mockRejectedValue(new Error("mất mạng"));
    renderWithIntl(<HomeFrame user={user}><p>trang chủ</p></HomeFrame>);

    await waitFor(() => expect(fetchMe).toHaveBeenCalled());
    expect(screen.getByTestId("app-sidebar")).toHaveTextContent("tien");
  });
});
