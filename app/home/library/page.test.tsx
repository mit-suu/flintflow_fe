import { fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithIntl, vietnameseLeftovers } from "@/test/intl";
import * as api from "@/lib/api/org-library";
import OrgLibraryPage from "./page";

const role = vi.hoisted(() => ({ value: "analyst" }));
vi.mock("@/lib/api/orgs", () => ({ fetchOrganization: vi.fn(async () => ({ role: role.value })) }));
vi.mock("@/lib/api/token-store", () => ({ getActiveOrgId: () => "o1" }));
vi.mock("@/components/layout/TopBar", () => ({ default: () => null }));
vi.mock("@/lib/api/org-library", () => ({
  listOrgTemplates: vi.fn(),
  listContentLibrary: vi.fn(),
  deleteOrgTemplate: vi.fn(async () => ({ deleted: true, project_count: 2 })),
  deleteTemplateVersion: vi.fn(async () => ({ deleted: true, project_count: 2, template_deleted: true })),
  uploadOrgTemplate: vi.fn(),
  uploadTemplateVersion: vi.fn(),
  getTemplateVersion: vi.fn(),
  publishTemplateVersion: vi.fn(),
  upsertContentEntry: vi.fn(async () => undefined),
  updateContentEntry: vi.fn(async () => undefined),
  deleteContentEntry: vi.fn(async () => undefined),
}));

const template = { id: "t1", name: "IEEE ngân hàng", source_file_name: "bank.docx", heading_count: 42, custom_count: 19, template_family: "ieee29148", uses: 3, created_at: "2026-10-20T00:00:00.000Z", latest_version: 1, project_count: 2, pending_count: 0, skeleton: false, versions: [{ version: 1, status: "published" as const, source_file_name: "bank.docx", heading_count: 42, custom_count: 19, language: "en", template_family: "ieee29148", project_count: 2, pending_count: 0, created_at: "2026-10-20T00:00:00.000Z" }] };
const entry = {
  id: "e1",
  title: "References",
  blocks: [{ kind: "list_item" as const, text: "IEEE 830-1998", rows: null, image_ref: null }],
  updated_at: "2026-10-21T00:00:00.000Z",
};

beforeEach(() => {
  role.value = "analyst";
  vi.clearAllMocks();
  vi.mocked(api.listOrgTemplates).mockResolvedValue([template]);
  vi.mocked(api.listContentLibrary).mockResolvedValue([entry]);
});

describe("Thư viện mẫu của tổ chức (FLF-278 đợt 3)", () => {
  it("Analyst: thêm nội dung (đoạn + gạch đầu dòng), sửa, xoá hai bước; không có nút xoá mẫu", async () => {
    renderWithIntl(<OrgLibraryPage />);
    expect(await screen.findByText("IEEE ngân hàng")).toBeInTheDocument();
    expect(screen.getByText(/bank.docx · 42 heading · 19 mục giữ nguyên văn · 2 dự án · đã dùng 3 lần/)).toBeInTheDocument();
    expect(screen.getByText("- IEEE 830-1998")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Thêm nội dung" }));
    fireEvent.change(screen.getByLabelText(/Tiêu đề mục/), { target: { value: "Document Conventions" } });
    fireEvent.change(screen.getByLabelText("Nội dung"), { target: { value: "Terms are bold.\n\n- Must = mandatory" } });
    fireEvent.click(screen.getByRole("button", { name: "Lưu" }));
    await waitFor(() =>
      expect(api.upsertContentEntry).toHaveBeenCalledWith("o1", {
        title: "Document Conventions",
        blocks: [
          { kind: "paragraph", text: "Terms are bold." },
          { kind: "list_item", text: "Must = mandatory" },
        ],
      })
    );

    fireEvent.click(await screen.findByRole("button", { name: "Sửa" }));
    expect(screen.getByLabelText("Nội dung")).toHaveValue("- IEEE 830-1998");
    fireEvent.click(screen.getByRole("button", { name: "Huỷ" }));

    expect(screen.queryByRole("button", { name: "Xoá mẫu" })).not.toBeInTheDocument();
    const deletes = screen.getAllByRole("button", { name: "Xoá" });
    fireEvent.click(deletes[0]);
    expect(api.deleteContentEntry).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Xác nhận xoá" }));
    await waitFor(() => expect(api.deleteContentEntry).toHaveBeenCalledWith("o1", "e1"));

  });

  it("Lead: xoá mẫu có xác nhận kèm số dự án; xoá một bản", async () => {
    role.value = "lead";
    renderWithIntl(<OrgLibraryPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Xoá mẫu" }));
    expect(screen.getByText(/Đang có 2 dự án theo mẫu này/)).toBeInTheDocument();
    expect(api.deleteOrgTemplate).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Xác nhận xoá" }));
    await waitFor(() => expect(api.deleteOrgTemplate).toHaveBeenCalledWith("o1", "t1"));

    fireEvent.click(await screen.findByRole("button", { name: "Xoá bản" }));
    expect(screen.getByText(/Đang có 2 dự án theo bản này/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Xác nhận xoá" }));
    await waitFor(() => expect(api.deleteTemplateVersion).toHaveBeenCalledWith("o1", "t1", 1));
  });

  it("Analyst / Viewer không thấy nút đăng bản mới", async () => {
    renderWithIntl(<OrgLibraryPage />);
    await screen.findByText("IEEE ngân hàng");
    expect(screen.queryByRole("button", { name: "Đăng bản mới" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Tải mẫu mới" })).not.toBeInTheDocument();
  });

  it("Viewer: chỉ xem, không có nút thêm/sửa/xoá", async () => {
    role.value = "viewer";
    renderWithIntl(<OrgLibraryPage />);
    expect(await screen.findByText("References")).toBeInTheDocument();
    expect(screen.getByText(/vai trò chỉ xem/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Thêm nội dung" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Xoá" })).not.toBeInTheDocument();
  });

  it("tiếng Anh: không sót chuỗi tiếng Việt ngoài dữ liệu của tổ chức", async () => {
    const { container } = renderWithIntl(<OrgLibraryPage />, "en");
    await screen.findByText("Saved SRS templates");
    screen.getByText("IEEE ngân hàng").remove();
    // Tên mẫu cũng nằm trong aria-label danh sách bản — vẫn là dữ liệu của tổ chức
    container.querySelectorAll("[aria-label*=\"IEEE ngân hàng\"]").forEach((el) => el.removeAttribute("aria-label"));
    expect(vietnameseLeftovers(container)).toEqual([]);
  });
});
