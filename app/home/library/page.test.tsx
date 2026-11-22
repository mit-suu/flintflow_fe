import { fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithIntl, vietnameseLeftovers } from "@/test/intl";
import * as api from "@/lib/api/org-library";
import type { OrgTemplateSummary, TemplateProposal } from "@/types/org-library";
import OrgLibraryPage from "./page";

const role = vi.hoisted(() => ({ value: "analyst" }));
vi.mock("@/lib/api/orgs", () => ({ fetchOrganization: vi.fn(async () => ({ role: role.value })) }));
// Vai trò đến từ store tổ chức dùng chung ⇒ mock hook theo `role.value` của từng test
vi.mock("@/lib/hooks/use-active-org", () => ({
  useActiveOrganizationState: () => ({ org: role.value ? { id: "o1", name: "Org", role: role.value } : null, loading: false, error: false }),
}));
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
  listTemplateProposals: vi.fn(async () => []),
  getOrgTemplateProposal: vi.fn(),
  decideTemplateProposal: vi.fn(),
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
    expect(screen.getByText(/lưu cấu trúc của một dự án thành mẫu/)).toBeInTheDocument();
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

  it("Lead: tải mẫu mới (tên + file) rồi rà mapping bản nháp ngay trong hộp", async () => {
    role.value = "lead";
    vi.mocked(api.uploadOrgTemplate).mockResolvedValue({ ...template.versions[0], template_id: "t9", name: "Mẫu mới", version: 1, status: "draft", headings: [] });
    const { container } = renderWithIntl(<OrgLibraryPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Tải mẫu mới" }));
    fireEvent.change(screen.getByLabelText("Tên mẫu"), { target: { value: "Mẫu mới" } });
    const file = new File(["x"], "new.docx");
    fireEvent.change(container.ownerDocument.querySelector('input[aria-label="File .docx của mẫu mới"]')!, { target: { files: [file] } });
    await waitFor(() => expect(api.uploadOrgTemplate).toHaveBeenCalledWith("o1", "Mẫu mới", file));
    expect(await screen.findByRole("region", { name: "Rà mapping: Mẫu mới · bản 1" })).toBeInTheDocument();
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

  it("UC-85: mẫu lưu từ dự án hiện như mẫu thường kèm dòng \"Lưu từ dự án <tên>\"", async () => {
    vi.mocked(api.listOrgTemplatesPage).mockResolvedValue(onePage([{ ...template, skeleton: true, skeleton_source_project_id: "p9", skeleton_source_project_name: "Lumen" }]));
    renderWithIntl(<OrgLibraryPage />);
    expect(await screen.findByText("Lưu từ dự án Lumen")).toBeInTheDocument();
    // Analyst không thấy mục đề xuất (chỉ Lead duyệt)
    expect(api.listTemplateProposals).not.toHaveBeenCalled();
  });

  it("UC-88: Lead xem đề xuất Analyst gửi rồi duyệt ⇒ tải lại danh sách mẫu", async () => {
    role.value = "lead";
    const proposal: TemplateProposal = {
      id: "x1",
      project_id: "p9",
      project_name: "Lumen",
      status: "sent",
      headings: ["1 Introduction", "9 {Customer name} Integration"],
      replaced_names: [{ key: "B0001", original: "9 Lumen Integration", generic: "9 {Customer name} Integration", reason: null }],
      created_by: { id: "u2", name: "Bình" },
      created_at: "2026-11-17T00:00:00.000Z",
      template_id: null,
      version: null,
    };
    vi.mocked(api.listTemplateProposals).mockResolvedValueOnce([proposal]).mockResolvedValue([]);
    vi.mocked(api.decideTemplateProposal).mockResolvedValue({ ...proposal, status: "approved", version: 1 });
    renderWithIntl(<OrgLibraryPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Xem và duyệt" }));
    const dialog = await screen.findByRole("dialog", { name: "Mẫu từ dự án \"Lumen\"" });
    expect(dialog).toHaveTextContent("9 Lumen Integration");
    expect(dialog).toHaveTextContent("9 {Customer name} Integration");
    const loads = vi.mocked(api.listOrgTemplatesPage).mock.calls.length;
    fireEvent.click(screen.getByRole("button", { name: "Duyệt" }));
    expect(await screen.findByText("Đã đưa mẫu từ dự án \"Lumen\" vào thư viện.")).toBeInTheDocument();
    expect(api.decideTemplateProposal).toHaveBeenCalledWith("o1", "x1", "approve");
    await waitFor(() => expect(vi.mocked(api.listOrgTemplatesPage).mock.calls.length).toBeGreaterThan(loads));
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
