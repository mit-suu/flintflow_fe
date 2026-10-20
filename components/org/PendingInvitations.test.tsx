import { fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithIntl } from "@/test/intl";
import { acceptMyInvitation, declineMyInvitation, fetchMyInvitations } from "@/lib/api/orgs";
import type { MyInvitation } from "@/types/organization";
import PendingInvitations from "./PendingInvitations";

vi.mock("@/lib/api/orgs", () => ({
  fetchMyInvitations: vi.fn(),
  acceptMyInvitation: vi.fn(),
  declineMyInvitation: vi.fn(),
}));

const assign = vi.fn();

const invitation = (over: Partial<MyInvitation> = {}): MyInvitation => ({
  id: "inv-1",
  organizationId: "org-1",
  organizationName: "Nhóm A",
  role: "analyst",
  roleLabel: "Analyst",
  inviterName: "Lan",
  expiresAt: "2026-10-25T00:00:00Z",
  createdAt: "2026-10-18T00:00:00Z",
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  Object.defineProperty(window, "location", { value: { ...window.location, assign }, writable: true });
});

describe("lời mời đang chờ (như lời mời collaborator GitHub)", () => {
  it("không có lời mời thì không hiện gì", async () => {
    vi.mocked(fetchMyInvitations).mockResolvedValue([]);
    const { container } = renderWithIntl(<PendingInvitations />);
    await waitFor(() => expect(fetchMyInvitations).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  it("hiện tên tổ chức, người mời, vai trò; chấp nhận thì vào app", async () => {
    vi.mocked(fetchMyInvitations).mockResolvedValue([invitation()]);
    vi.mocked(acceptMyInvitation).mockResolvedValue({
      accessToken: "token-moi",
      organization: { id: "org-1", name: "Nhóm A", role: "analyst" },
    });

    renderWithIntl(<PendingInvitations />);
    expect(await screen.findByText("Nhóm A")).toBeInTheDocument();
    expect(screen.getByText(/Lan mời bạn với vai trò Analyst/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Chấp nhận" }));
    await waitFor(() => expect(assign).toHaveBeenCalledWith("/home"));
    expect(acceptMyInvitation).toHaveBeenCalledWith("inv-1");
  });

  it("từ chối thì lời mời biến khỏi danh sách, không rời trang", async () => {
    vi.mocked(fetchMyInvitations).mockResolvedValue([invitation(), invitation({ id: "inv-2", organizationName: "Nhóm B" })]);
    vi.mocked(declineMyInvitation).mockResolvedValue({} as never);

    renderWithIntl(<PendingInvitations />);
    await screen.findByText("Nhóm A");
    fireEvent.click(screen.getAllByRole("button", { name: "Từ chối" })[0]);

    await waitFor(() => expect(screen.queryByText("Nhóm A")).not.toBeInTheDocument());
    expect(screen.getByText("Nhóm B")).toBeInTheDocument();
    expect(declineMyInvitation).toHaveBeenCalledWith("inv-1");
    expect(assign).not.toHaveBeenCalled();
  });

  it("chấp nhận lỗi thì báo lỗi, lời mời vẫn còn để thử lại", async () => {
    vi.mocked(fetchMyInvitations).mockResolvedValue([invitation()]);
    vi.mocked(acceptMyInvitation).mockRejectedValue(new Error("Tổ chức đã đạt trần"));

    renderWithIntl(<PendingInvitations />);
    fireEvent.click(await screen.findByRole("button", { name: "Chấp nhận" }));

    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(screen.getByText("Nhóm A")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Chấp nhận" })).not.toBeDisabled();
  });

  it("không tải được danh sách thì im lặng — vẫn nhập mã từ email được", async () => {
    vi.mocked(fetchMyInvitations).mockRejectedValue(new Error("network"));
    const { container } = renderWithIntl(<PendingInvitations />);
    await waitFor(() => expect(fetchMyInvitations).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });
});
