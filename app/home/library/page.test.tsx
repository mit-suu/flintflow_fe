import { fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithIntl, vietnameseLeftovers } from "@/test/intl";
import * as api from "@/lib/api/org-library";
import type { OrgTemplateSummary } from "@/types/org-library";
import OrgLibraryPage from "./page";

const role = vi.hoisted(() => ({ value: "analyst" }));
vi.mock("@/lib/api/orgs", () => ({ fetchOrganization: vi.fn(async () => ({ role: role.value })) }));
vi.mock("@/lib/api/token-store", () => ({ getActiveOrgId: () => "o1" }));
vi.mock("@/components/layout/TopBar", () => ({ default: () => null }));
vi.mock("@/lib/api/org-library", () => ({
  listOrgTemplatesPage: vi.fn(),
  deleteOrgTemplate: vi.fn(async () => undefined),
}));

const template = { id: "t1", name: "IEEE ngân hàng", source_file_name: "bank.docx", heading_count: 42, custom_count: 19, template_family: "ieee29148", uses: 3, created_at: "2026-10-20T00:00:00.000Z" };
const onePage = (items: OrgTemplateSummary[]) => ({ items, meta: { page: 1, limit: 20, total: items.length, totalPages: 1 } });

beforeEach(() => {
  role.value = "analyst";
  vi.clearAllMocks();
  vi.mocked(api.listOrgTemplatesPage).mockResolvedValue(onePage([template]));
});

describe("Thư viện mẫu của tổ chức", () => {
  it("hiện dòng mẫu với tên file, cấu trúc và lượt dùng; gọi BE trang 1 sắp theo lượt dùng", async () => {
    renderWithIntl(<OrgLibraryPage />);
    expect(await screen.findByText("IEEE ngân hàng")).toBeInTheDocument();
    expect(screen.getByText("bank.docx")).toBeInTheDocument();
    expect(screen.getByText(/42 heading/)).toBeInTheDocument();
    expect(screen.getByText(/19 giữ nguyên văn/)).toBeInTheDocument();
    expect(screen.getByText("Dùng 3 lần")).toBeInTheDocument();
    expect(api.listOrgTemplatesPage).toHaveBeenCalledWith("o1", { page: 1, limit: 20, q: undefined, sort: "uses" });
  });

  it("tìm gửi từ khoá lên BE (BE tìm không dấu); không khớp thì báo", async () => {
    renderWithIntl(<OrgLibraryPage />);
    await screen.findByText("IEEE ngân hàng");
    vi.mocked(api.listOrgTemplatesPage).mockResolvedValue(onePage([]));
    fireEvent.change(screen.getByRole("searchbox", { name: "Tìm mẫu" }), { target: { value: "xyz" } });
    await waitFor(() => expect(api.listOrgTemplatesPage).toHaveBeenLastCalledWith("o1", { page: 1, limit: 20, q: "xyz", sort: "uses" }));
    expect(await screen.findByText("Không có mẫu nào khớp “xyz”.")).toBeInTheDocument();
  });

  it("chưa có mẫu: trạng thái rỗng chỉ chỗ tạo mẫu", async () => {
    vi.mocked(api.listOrgTemplatesPage).mockResolvedValue(onePage([]));
    renderWithIntl(<OrgLibraryPage />);
    expect(await screen.findByText("Tổ chức chưa lưu mẫu nào.")).toBeInTheDocument();
    expect(screen.getByText(/Lưu làm mẫu của tổ chức/)).toBeInTheDocument();
  });

  it("Analyst: xoá mẫu qua menu ⋮ rồi xác nhận trong hộp thoại; tải lại danh sách", async () => {
    renderWithIntl(<OrgLibraryPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Thao tác cho “IEEE ngân hàng”" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Xoá" }));
    expect(api.deleteOrgTemplate).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog", { name: "Xoá mẫu SRS?" })).toBeInTheDocument();
    vi.mocked(api.listOrgTemplatesPage).mockResolvedValue(onePage([]));
    fireEvent.click(screen.getByRole("button", { name: "Xác nhận xoá" }));
    await waitFor(() => expect(api.deleteOrgTemplate).toHaveBeenCalledWith("o1", "t1"));
    expect(await screen.findByText("Tổ chức chưa lưu mẫu nào.")).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("Viewer: chỉ xem, không có menu thao tác", async () => {
    role.value = "viewer";
    renderWithIntl(<OrgLibraryPage />);
    expect(await screen.findByText("IEEE ngân hàng")).toBeInTheDocument();
    expect(await screen.findByText(/vai trò chỉ xem/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Thao tác cho/ })).not.toBeInTheDocument();
  });

  it("tiếng Anh: không sót chuỗi tiếng Việt ngoài dữ liệu của tổ chức", async () => {
    const { container } = renderWithIntl(<OrgLibraryPage />, "en");
    await screen.findByText("IEEE ngân hàng");
    // Tên mẫu là dữ liệu của tổ chức — bỏ khỏi chữ hiển thị, title và aria-label của nút ⋮ trước khi quét
    screen.getByText("IEEE ngân hàng").remove();
    // IconButton đặt tên vào cả aria-label lẫn title (tooltip) — gỡ tên mẫu ở cả hai
    const actions = screen.getByRole("button", { name: /Actions for/ });
    actions.setAttribute("aria-label", "Actions");
    actions.setAttribute("title", "Actions");
    expect(vietnameseLeftovers(container)).toEqual([]);
  });
});
