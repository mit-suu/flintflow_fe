import { fireEvent, screen, waitFor } from "@testing-library/react";
import { renderWithIntl } from "@/test/intl";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchAdminFeedback, type AdminFeedbackItem } from "@/lib/api/admin";
import AdminFeedbackPage from "./page";

vi.mock("@/lib/api/admin", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/admin")>()),
  fetchAdminFeedback: vi.fn(),
}));
// Thanh trên của admin cần context SidebarProvider của layout — ngoài phạm vi test này
vi.mock("../_components/AdminHeader", () => ({ default: () => null }));

const page = (items: AdminFeedbackItem[], meta = { page: 1, limit: 20, total: items.length, totalPages: 1 }) => ({ items, meta });

beforeEach(() => vi.clearAllMocks());

describe("AdminFeedbackPage", () => {
  it("hiện góp ý thật: loại, người gửi, nội dung; gọi BE trang 1", async () => {
    vi.mocked(fetchAdminFeedback).mockResolvedValue(
      page([
        { _id: "f1", category: "bug", message: "Nút lưu không chạy", createdAt: "2026-09-19T03:00:00Z", user: { _id: "u1", email: "a@x.vn", name: "An" } },
        { _id: "f2", category: "other", message: "Hi", createdAt: "2026-09-18T03:00:00Z", user: null },
      ])
    );
    renderWithIntl(<AdminFeedbackPage />);

    expect(await screen.findByText("Nút lưu không chạy")).toBeInTheDocument();
    expect(screen.getByText("Báo lỗi")).toBeInTheDocument();
    expect(screen.getByText("An")).toBeInTheDocument();
    expect(screen.getByText("Tài khoản đã xoá")).toBeInTheDocument();
    expect(fetchAdminFeedback).toHaveBeenCalledWith({ page: 1, limit: 20, q: undefined });
  });

  it("rỗng ⇒ thông báo chưa có phản hồi", async () => {
    vi.mocked(fetchAdminFeedback).mockResolvedValue(page([]));
    renderWithIntl(<AdminFeedbackPage />);
    expect(await screen.findByText("Chưa có phản hồi nào.")).toBeInTheDocument();
  });

  it("nhiều trang ⇒ thanh số trang, bấm trang 2 hỏi BE trang 2 (FLF-404)", async () => {
    const item: AdminFeedbackItem = { _id: "f1", category: "bug", message: "Một", createdAt: "2026-09-19T03:00:00Z", user: null };
    vi.mocked(fetchAdminFeedback).mockImplementation(async ({ page: n = 1 } = {}) =>
      page([{ ...item, _id: `f${n}`, message: `Trang ${n}` }], { page: n, limit: 20, total: 45, totalPages: 3 })
    );
    renderWithIntl(<AdminFeedbackPage />);
    await screen.findByText("Trang 1");
    fireEvent.click(screen.getByRole("button", { name: "Tới trang 2" }));
    expect(await screen.findByText("Trang 2")).toBeInTheDocument();
    expect(fetchAdminFeedback).toHaveBeenLastCalledWith({ page: 2, limit: 20, q: undefined });
  });

  it("tìm gửi từ khoá lên BE, về trang 1; không khớp thì báo", async () => {
    vi.mocked(fetchAdminFeedback).mockResolvedValue(page([]));
    renderWithIntl(<AdminFeedbackPage />);
    await screen.findByText("Chưa có phản hồi nào.");
    fireEvent.change(screen.getByRole("searchbox", { name: "Tìm phản hồi" }), { target: { value: " dang nhap " } });
    await waitFor(() => expect(fetchAdminFeedback).toHaveBeenLastCalledWith({ page: 1, limit: 20, q: "dang nhap" }));
    expect(await screen.findByText("Không có phản hồi nào khớp “dang nhap”.")).toBeInTheDocument();
  });
});
