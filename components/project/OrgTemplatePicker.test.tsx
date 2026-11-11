import { fireEvent, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderWithIntl } from "@/test/intl";
import { listOrgTemplatesPage } from "@/lib/api/org-library";
import Modal from "@/components/ui/Modal";
import OrgTemplatePicker from "./OrgTemplatePicker";

const BANK = { id: "t1", name: "Mẫu ngân hàng", source_file_name: "bank.docx", heading_count: 42, custom_count: 9, template_family: "ieee29148", uses: 2, created_at: "2026-10-20T00:00:00.000Z" };
const HIS = { ...BANK, id: "t2", name: "Bệnh viện — HIS", source_file_name: "his.docx" };

vi.mock("@/lib/api/token-store", async (importOriginal) => ({ ...(await importOriginal<object>()), getActiveOrgId: () => "o1" }));
vi.mock("@/lib/api/org-library", () => ({
  listOrgTemplatesPage: vi.fn(async (_org: string, query: { page: number; limit?: number; q?: string }) => {
    const items = query.q ? [BANK, HIS].filter((t) => t.name.toLowerCase().includes(query.q!.toLowerCase())) : [BANK, HIS];
    return { items: items.slice(0, query.limit ?? 20), meta: { page: query.page, limit: query.limit ?? 20, total: items.length, totalPages: 1 } };
  }),
}));

describe("OrgTemplatePicker — lối phụ của ô SRS (FLF-278)", () => {
  // Chạy đầu tiên: số mẫu được nhớ theo tổ chức trong tab, các test sau đã có số sẵn
  it("nút hiện ngay khi mở hộp (chưa chờ BE), số mẫu điền vào khi BE trả về", async () => {
    renderWithIntl(<OrgTemplatePicker onPick={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Hoặc chọn từ mẫu của tổ chức" })).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "Hoặc chọn từ mẫu của tổ chức (2)" })).toBeInTheDocument();
  });

  it("trong hộp Tạo dự án chỉ là một nút; danh sách mẫu nằm ở hộp chọn riêng", async () => {
    const onPick = vi.fn();
    renderWithIntl(<OrgTemplatePicker onPick={onPick} />);
    const trigger = await screen.findByRole("button", { name: /Hoặc chọn từ mẫu của tổ chức \(2\)/ });
    expect(screen.queryByText("Mẫu ngân hàng")).not.toBeInTheDocument();

    fireEvent.click(trigger);
    expect(await screen.findByRole("dialog", { name: "Chọn mẫu của tổ chức" })).toBeInTheDocument();
    expect(await screen.findByText("bank.docx · 42 heading · đã dùng 2 lần")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Mẫu ngân hàng/ }));
    expect(onPick).toHaveBeenCalledWith(expect.objectContaining({ id: "t1", name: "Mẫu ngân hàng" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("tìm theo tên gọi BE với từ khoá; không khớp thì báo rỗng", async () => {
    renderWithIntl(<OrgTemplatePicker onPick={vi.fn()} />);
    fireEvent.click(await screen.findByRole("button", { name: /Hoặc chọn từ mẫu của tổ chức/ }));
    await screen.findByText("Mẫu ngân hàng");

    fireEvent.change(screen.getByRole("searchbox", { name: "Tìm mẫu" }), { target: { value: "bệnh" } });
    await waitFor(() => expect(screen.queryByText("Mẫu ngân hàng")).not.toBeInTheDocument());
    expect(screen.getByText("Bệnh viện — HIS")).toBeInTheDocument();
    expect(listOrgTemplatesPage).toHaveBeenCalledWith("o1", expect.objectContaining({ q: "bệnh" }));

    fireEvent.change(screen.getByRole("searchbox", { name: "Tìm mẫu" }), { target: { value: "xyz" } });
    expect(await screen.findByText("Không có mẫu nào khớp “xyz”")).toBeInTheDocument();
  });

  it("Escape chỉ đóng hộp chọn mẫu, không đóng luôn hộp Tạo dự án phía dưới", async () => {
    const closeOuter = vi.fn();
    renderWithIntl(
      <Modal open onClose={closeOuter} title="Tạo dự án mới">
        <OrgTemplatePicker onPick={vi.fn()} />
      </Modal>
    );
    fireEvent.click(await screen.findByRole("button", { name: /Hoặc chọn từ mẫu của tổ chức/ }));
    await screen.findByRole("dialog", { name: "Chọn mẫu của tổ chức" });

    fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" });
    expect(screen.queryByRole("dialog", { name: "Chọn mẫu của tổ chức" })).not.toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "Tạo dự án mới" })).toBeInTheDocument();
    expect(closeOuter).not.toHaveBeenCalled();
  });
});
