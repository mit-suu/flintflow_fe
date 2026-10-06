import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { renderWithIntl } from "@/test/intl";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchAdminOrgs, type AdminOrg } from "@/lib/api/admin";
import AdminOrgsPage from "./page";

vi.mock("@/lib/api/admin", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/admin")>()),
  fetchAdminOrgs: vi.fn(),
}));
// TopBar của admin cần context layout — ngoài phạm vi test UC-90
vi.mock("../_components/AdminPage", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../_components/AdminPage")>()),
  AdminTopBar: () => null,
}));

const ORGS: AdminOrg[] = [
  {
    id: "o1",
    name: "Alpha Studio",
    owner: { id: "u1", email: "alpha@flintflow.vn", name: "Alpha" },
    plan: "free",
    planLabel: "Free",
    wallet: { balance: 1500, reserved: 20, available: 1480 },
    membersCount: 3,
    projectsCount: 2,
    createdAt: "2026-09-01T00:00:00.000Z",
  },
  {
    id: "o2",
    name: "Beta Labs",
    owner: null,
    plan: "pro",
    planLabel: "Pro",
    wallet: null,
    membersCount: 7,
    projectsCount: 12,
    createdAt: "2026-09-02T00:00:00.000Z",
  },
];

const META = { page: 1, limit: 20, total: 2, totalPages: 1 };

describe("AdminOrgsPage — UC-90 danh sách tổ chức", () => {
  beforeEach(() => {
    vi.mocked(fetchAdminOrgs).mockReset().mockResolvedValue({ items: ORGS, meta: META });
  });

  it("hiện gói, số dư ví, số thành viên và số dự án của từng tổ chức", async () => {
    renderWithIntl(<AdminOrgsPage />);

    const alpha = (await screen.findByText("Alpha Studio")).closest("tr")!;
    expect(within(alpha).getByText("Free")).toBeInTheDocument();
    expect(within(alpha).getByText("1.500")).toBeInTheDocument();
    expect(within(alpha).getByText("đang giữ 20")).toBeInTheDocument();
    expect(within(alpha).getByText("alpha@flintflow.vn")).toBeInTheDocument();

    const beta = screen.getByText("Beta Labs").closest("tr")!;
    expect(within(beta).getByText("Pro")).toBeInTheDocument();
    expect(within(beta).getByText("Chưa có ví")).toBeInTheDocument();
    expect(within(beta).getByText("12")).toBeInTheDocument();
  });

  it("lọc theo gói và tìm kiếm gửi tham số xuống API, quay về trang 1", async () => {
    renderWithIntl(<AdminOrgsPage />);
    await screen.findByText("Alpha Studio");

    fireEvent.change(screen.getByLabelText("Lọc theo gói"), { target: { value: "pro" } });
    await waitFor(() => expect(fetchAdminOrgs).toHaveBeenLastCalledWith({ page: 1, limit: 20, plan: "pro" }));

    fireEvent.change(screen.getByLabelText("Tìm tổ chức"), { target: { value: "  beta " } });
    fireEvent.click(screen.getByRole("button", { name: "Tìm" }));
    await waitFor(() =>
      expect(fetchAdminOrgs).toHaveBeenLastCalledWith({ page: 1, limit: 20, plan: "pro", q: "beta" })
    );
  });
});
