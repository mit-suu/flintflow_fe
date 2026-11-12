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
  deleteOrgTemplate: vi.fn(async () => ({ deleted: true, project_count: 2 })),
  uploadTemplateVersion: vi.fn(),
  uploadOrgTemplate: vi.fn(),
  getTemplateVersion: vi.fn(),
  publishTemplateVersion: vi.fn(),
  deleteTemplateVersion: vi.fn(),
  getSkeletonPending: vi.fn(async () => ({ template_id: "t1", name: "Khung", version: 1, pending_count: 1, headings: [], suggest_credit_cost: 1 })),
  decideSkeletonPending: vi.fn(),
  suggestSkeletonNames: vi.fn(),
}));

const template: OrgTemplateSummary = {
  id: "t1",
  name: "IEEE ngân hàng",
  source_file_name: "bank.docx",
  heading_count: 42,
  custom_count: 19,
  template_family: "ieee29148",
  uses: 3,
  created_at: "2026-10-20T00:00:00.000Z",
  latest_version: 1,
  project_count: 2,
  pending_count: 0,
  skeleton: false,
  skeleton_source_project_id: null,
  versions: [
    { version: 1, status: "published", source_file_name: "bank.docx", heading_count: 42, custom_count: 19, language: "en", template_family: null, project_count: 2, pending_count: 0, created_at: "2026-10-20T00:00:00.000Z" },
  ],
};
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

  it("Lead: xoá mẫu qua menu ⋮ rồi xác nhận (kèm số dự án đang theo); tải lại danh sách", async () => {
    role.value = "lead";
    renderWithIntl(<OrgLibraryPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Thao tác cho “IEEE ngân hàng”" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Xoá mẫu" }));
    expect(api.deleteOrgTemplate).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog", { name: "Xoá mẫu SRS?" })).toBeInTheDocument();
    expect(screen.getByText(/Đang có 2 dự án theo mẫu này/)).toBeInTheDocument();
    vi.mocked(api.listOrgTemplatesPage).mockResolvedValue(onePage([]));
    fireEvent.click(screen.getByRole("button", { name: "Xác nhận xoá" }));
    await waitFor(() => expect(api.deleteOrgTemplate).toHaveBeenCalledWith("o1", "t1"));
    expect(await screen.findByText("Tổ chức chưa lưu mẫu nào.")).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("Lead: tải mẫu mới (tên + file) rồi mở ngay hộp rà mapping của bản nháp", async () => {
    role.value = "lead";
    vi.mocked(api.uploadOrgTemplate).mockResolvedValue({ ...template.versions[0], template_id: "t9", name: "Mẫu mới", version: 1, status: "draft", headings: [] });
    const { container } = renderWithIntl(<OrgLibraryPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Tải mẫu mới" }));
    fireEvent.change(screen.getByLabelText("Tên mẫu"), { target: { value: "Mẫu mới" } });
    const file = new File(["x"], "new.docx");
    fireEvent.change(container.ownerDocument.querySelector('input[aria-label="File .docx của mẫu mới"]')!, { target: { files: [file] } });
    await waitFor(() => expect(api.uploadOrgTemplate).toHaveBeenCalledWith("o1", "Mẫu mới", file));
    expect(await screen.findByRole("dialog", { name: "Rà mapping: Mẫu mới · bản 1" })).toBeInTheDocument();
  });

  it("Analyst / Viewer: chỉ xem các bản, không tải / đăng / xoá", async () => {
    for (const r of ["analyst", "viewer"]) {
      role.value = r;
      const { unmount } = renderWithIntl(<OrgLibraryPage />);
      expect(await screen.findByText(/Chỉ Lead được tải, đăng và xoá mẫu/)).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Tải mẫu mới" })).not.toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "Thao tác cho “IEEE ngân hàng”" }));
      expect(screen.queryByRole("menuitem", { name: "Xoá mẫu" })).not.toBeInTheDocument();
      expect(screen.queryByRole("menuitem", { name: "Đăng bản mới" })).not.toBeInTheDocument();
      fireEvent.click(screen.getByRole("menuitem", { name: "Các bản" }));
      expect(await screen.findByRole("dialog", { name: "Các bản của mẫu IEEE ngân hàng" })).toBeInTheDocument();
      expect(screen.getByText("Bản 1")).toBeInTheDocument();
      unmount();
    }
  });

  it("Analyst mở duyệt mục chờ của mẫu khung qua dự án nguồn", async () => {
    vi.mocked(api.listOrgTemplatesPage).mockResolvedValue(onePage([{ ...template, skeleton: true, pending_count: 1, skeleton_source_project_id: "p9" }]));
    renderWithIntl(<OrgLibraryPage />);
    expect(await screen.findByText("1 mục chờ duyệt")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Thao tác cho “IEEE ngân hàng”" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Duyệt mục chờ" }));
    await waitFor(() => expect(api.getSkeletonPending).toHaveBeenCalledWith("p9"));
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
