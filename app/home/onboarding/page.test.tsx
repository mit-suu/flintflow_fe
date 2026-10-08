import { fireEvent, screen, waitFor } from "@testing-library/react";
import { renderWithIntl } from "@/test/intl";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  acceptInvitation,
  createOrganization,
  previewInvitation,
  switchOrganization,
} from "@/lib/api/orgs";
import { fetchMe } from "@/lib/api/users";
import OnboardingPage from "./page";

const replace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, push: vi.fn() }),
  usePathname: () => "/home/onboarding",
}));
vi.mock("@/lib/api/orgs", () => ({
  createOrganization: vi.fn(),
  switchOrganization: vi.fn(),
  previewInvitation: vi.fn(),
  acceptInvitation: vi.fn(),
}));
vi.mock("@/lib/api/users", () => ({ fetchMe: vi.fn() }));

const assign = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  Object.defineProperty(window, "location", { value: { ...window.location, assign }, writable: true });
  vi.mocked(fetchMe).mockResolvedValue({ id: "u1", email: "tien@flintflow.test", name: "Tien" } as never);
});

describe("onboarding tổ chức (BPMN Flow 8)", () => {
  it("tạo tổ chức rồi mở luôn org vừa tạo và vào /home", async () => {
    vi.mocked(createOrganization).mockResolvedValue({
      id: "org-1",
      name: "Nhóm A",
      role: "lead",
      joinedAt: "2026-09-25T00:00:00Z",
    });
    vi.mocked(switchOrganization).mockResolvedValue({
      accessToken: "token-moi",
      organization: { id: "org-1", name: "Nhóm A", role: "lead", joinedAt: "2026-09-25T00:00:00Z" },
    });

    renderWithIntl(<OnboardingPage />);
    fireEvent.change(screen.getByLabelText("Tên tổ chức"), { target: { value: "  Nhóm A  " } });
    fireEvent.click(screen.getByRole("button", { name: "Tạo tổ chức" }));

    await waitFor(() => expect(createOrganization).toHaveBeenCalledWith("Nhóm A"));
    // Token vừa tạo chưa mang orgId ⇒ phải đổi sang org mới trước khi vào app
    await waitFor(() => expect(switchOrganization).toHaveBeenCalledWith("org-1"));
    // Tải lại hẳn chứ không router.replace — nếu không ProjectsProvider ở layout giữ lỗi 409 cũ
    await waitFor(() => expect(assign).toHaveBeenCalledWith("/home"));
    expect(replace).not.toHaveBeenCalled();
  });

  it("tên rỗng thì báo lỗi, không gọi BE", async () => {
    renderWithIntl(<OnboardingPage />);
    const input = screen.getByLabelText("Tên tổ chức");
    await waitFor(() => expect(input).toHaveValue("Tien's Organization"));
    fireEvent.change(input, { target: { value: "   " } });
    fireEvent.click(screen.getByRole("button", { name: "Tạo tổ chức" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Hãy đặt tên cho tổ chức.");
    expect(createOrganization).not.toHaveBeenCalled();
  });

  it("nhập mã mời: xem trước rồi mới tham gia", async () => {
    vi.mocked(previewInvitation).mockResolvedValue({
      organizationName: "Nhóm B",
      role: "viewer",
      roleLabel: "Viewer",
      expiresAt: "2026-10-01T00:00:00Z",
    });
    vi.mocked(acceptInvitation).mockResolvedValue({
      accessToken: "token-moi",
      organization: { id: "org-2", name: "Nhóm B", role: "viewer" },
    });

    renderWithIntl(<OnboardingPage />);
    fireEvent.click(screen.getByRole("tab", { name: "Nhập mã mời" }));
    fireEvent.change(screen.getByLabelText("Mã mời"), { target: { value: "abcd-2345" } });
    fireEvent.click(screen.getByRole("button", { name: "Kiểm tra mã" }));

    expect(await screen.findByText("Lời mời hợp lệ")).toBeInTheDocument();
    expect(screen.getByText(/Nhóm B/)).toHaveTextContent("Viewer");
    expect(acceptInvitation).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Tham gia tổ chức" }));
    await waitFor(() => expect(acceptInvitation).toHaveBeenCalledWith("abcd-2345"));
    await waitFor(() => expect(assign).toHaveBeenCalledWith("/home"));
  });

  it("mã hỏng thì hiện lỗi của BE và không vào app", async () => {
    vi.mocked(previewInvitation).mockRejectedValue(new Error("Mã mời không dùng được"));

    renderWithIntl(<OnboardingPage />);
    fireEvent.click(screen.getByRole("tab", { name: "Nhập mã mời" }));
    fireEvent.change(screen.getByLabelText("Mã mời"), { target: { value: "SAI" } });
    fireEvent.click(screen.getByRole("button", { name: "Kiểm tra mã" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Mã mời không dùng được");
    expect(assign).not.toHaveBeenCalled();
  });

  it("đổi mã sau khi xem trước thì phải kiểm tra lại", async () => {
    vi.mocked(previewInvitation).mockResolvedValue({
      organizationName: "Nhóm B",
      role: "analyst",
      roleLabel: "Analyst",
      expiresAt: "2026-10-01T00:00:00Z",
    });

    renderWithIntl(<OnboardingPage />);
    fireEvent.click(screen.getByRole("tab", { name: "Nhập mã mời" }));
    fireEvent.change(screen.getByLabelText("Mã mời"), { target: { value: "MA-DUNG" } });
    fireEvent.click(screen.getByRole("button", { name: "Kiểm tra mã" }));
    expect(await screen.findByText("Lời mời hợp lệ")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Mã mời"), { target: { value: "MA-KHAC" } });
    expect(screen.queryByText("Lời mời hợp lệ")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Kiểm tra mã" })).toBeInTheDocument();
  });
});

describe("tên tổ chức gợi ý", () => {
  it("điền sẵn \"<tên>'s Organization\" từ hồ sơ", async () => {
    renderWithIntl(<OnboardingPage />);
    await waitFor(() => expect(screen.getByLabelText("Tên tổ chức")).toHaveValue("Tien's Organization"));
  });

  it("chưa đặt tên hiển thị thì lấy phần trước @ của email", async () => {
    vi.mocked(fetchMe).mockResolvedValue({ id: "u1", email: "hiep@fpt.vn" } as never);
    renderWithIntl(<OnboardingPage />);
    await waitFor(() => expect(screen.getByLabelText("Tên tổ chức")).toHaveValue("hiep's Organization"));
  });

  it("người dùng sửa tên gợi ý rồi tạo thì dùng tên đã sửa", async () => {
    vi.mocked(createOrganization).mockResolvedValue({ id: "org-1", name: "Nhóm SRS", role: "lead", joinedAt: "2026-09-26T00:00:00Z" });
    vi.mocked(switchOrganization).mockResolvedValue({
      accessToken: "t",
      organization: { id: "org-1", name: "Nhóm SRS", role: "lead", joinedAt: "2026-09-26T00:00:00Z" },
    });
    renderWithIntl(<OnboardingPage />);
    const input = screen.getByLabelText("Tên tổ chức");
    await waitFor(() => expect(input).toHaveValue("Tien's Organization"));

    fireEvent.change(input, { target: { value: "Nhóm SRS" } });
    fireEvent.click(screen.getByRole("button", { name: "Tạo tổ chức" }));
    await waitFor(() => expect(createOrganization).toHaveBeenCalledWith("Nhóm SRS"));
  });

  it("không đè lên chữ người dùng đã gõ trong lúc chờ hồ sơ", async () => {
    let resolveMe: (value: unknown) => void = () => undefined;
    vi.mocked(fetchMe).mockReturnValue(new Promise((resolve) => (resolveMe = resolve)) as never);
    renderWithIntl(<OnboardingPage />);

    const input = screen.getByLabelText("Tên tổ chức");
    fireEvent.change(input, { target: { value: "Tên tự gõ" } });
    resolveMe({ id: "u1", email: "tien@flintflow.test", name: "Tien" });

    await waitFor(() => expect(fetchMe).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 0));
    expect(input).toHaveValue("Tên tự gõ");
  });
});
