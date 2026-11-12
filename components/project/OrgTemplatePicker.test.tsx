import { fireEvent, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderWithIntl } from "@/test/intl";
import { listOrgTemplatesPage } from "@/lib/api/org-library";
import Modal from "@/components/ui/Modal";
import OrgTemplatePicker from "./OrgTemplatePicker";

const BANK = {
  id: "t1",
  name: "Mẫu ngân hàng",
  source_file_name: "bank.docx",
  heading_count: 42,
  custom_count: 9,
  template_family: "ieee29148",
  uses: 2,
  created_at: "2026-10-20T00:00:00.000Z",
  latest_version: 2,
  project_count: 1,
  pending_count: 0,
  skeleton: false,
  versions: [
    { version: 3, status: "draft" },
    { version: 2, status: "published", source_file_name: "bank.docx", heading_count: 42 },
    { version: 1, status: "published", source_file_name: "bank-old.docx", heading_count: 30 },
  ],
};
const HIS = { ...BANK, id: "t2", name: "Bệnh viện - HIS", source_file_name: "his.docx", latest_version: 1, versions: [{ version: 1, status: "published", source_file_name: "his.docx", heading_count: 42 }] };
/** Họ mẫu chỉ có bản nháp (Lead thấy ở thư viện) — chưa dùng được để tạo dự án. */
const DRAFT_ONLY = { ...BANK, id: "t3", name: "Mẫu chỉ có bản nháp", latest_version: 0, versions: [{ version: 1, status: "draft" }] };

vi.mock("@/lib/api/token-store", async (importOriginal) => ({ ...(await importOriginal<object>()), getActiveOrgId: () => "o1" }));
const role = vi.hoisted(() => ({ value: "analyst" }));
vi.mock("@/lib/api/orgs", () => ({ fetchOrganization: vi.fn(async () => ({ role: role.value })) }));
vi.mock("@/lib/api/org-library", () => ({
  listOrgTemplatesPage: vi.fn(async (_org: string, query: { page: number; limit?: number; q?: string }) => {
    const all = [BANK, HIS, DRAFT_ONLY];
    const items = query.q ? all.filter((t) => t.name.toLowerCase().includes(query.q!.toLowerCase())) : all;
    return { items: items.slice(0, query.limit ?? 20), meta: { page: query.page, limit: query.limit ?? 20, total: items.length, totalPages: 1 } };
  }),
}));

describe("OrgTemplatePicker - lối phụ của ô SRS (FLF-278)", () => {
  // Chạy đầu tiên: số mẫu được nhớ theo tổ chức trong tab, các test sau đã có số sẵn
  it("nút hiện ngay khi mở hộp (chưa chờ BE), số mẫu điền vào khi BE trả về", async () => {
    renderWithIntl(<OrgTemplatePicker onPick={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Hoặc chọn từ mẫu của tổ chức" })).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "Hoặc chọn từ mẫu của tổ chức (3)" })).toBeInTheDocument();
  });

  it("trong hộp Tạo dự án chỉ là một nút; danh sách mẫu nằm ở hộp chọn riêng", async () => {
    const onPick = vi.fn();
    renderWithIntl(<OrgTemplatePicker onPick={onPick} />);
    const trigger = await screen.findByRole("button", { name: /Hoặc chọn từ mẫu của tổ chức \(3\)/ });
    expect(screen.queryByText("Mẫu ngân hàng")).not.toBeInTheDocument();

    fireEvent.click(trigger);
    expect(await screen.findByRole("dialog", { name: "Chọn mẫu của tổ chức" })).toBeInTheDocument();
    expect(await screen.findByText("bank.docx · 42 heading · đã dùng 2 lần")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Mẫu ngân hàng/ }));
    expect(onPick).toHaveBeenCalledWith(expect.objectContaining({ id: "t1", name: "Mẫu ngân hàng" }), 2);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("chọn bản cũ hơn trước khi dùng mẫu; bản nháp và họ chỉ có bản nháp không chọn được (FLF-395)", async () => {
    const onPick = vi.fn();
    renderWithIntl(<OrgTemplatePicker onPick={onPick} />);
    fireEvent.click(await screen.findByRole("button", { name: /Hoặc chọn từ mẫu của tổ chức/ }));
    const select = await screen.findByLabelText("Bản của mẫu Mẫu ngân hàng");
    expect(screen.queryByText("Mẫu chỉ có bản nháp")).not.toBeInTheDocument();
    expect(select).toHaveValue("2");
    expect(screen.queryByRole("option", { name: "Bản 3" })).not.toBeInTheDocument();
    fireEvent.change(select, { target: { value: "1" } });
    expect(screen.getByText("bank-old.docx · 30 heading · đã dùng 2 lần")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Mẫu ngân hàng/ }));
    expect(onPick).toHaveBeenCalledWith(expect.objectContaining({ id: "t1" }), 1);
  });

  it("tìm theo tên gọi BE với từ khoá; không khớp thì báo rỗng", async () => {
    renderWithIntl(<OrgTemplatePicker onPick={vi.fn()} />);
    fireEvent.click(await screen.findByRole("button", { name: /Hoặc chọn từ mẫu của tổ chức/ }));
    await screen.findByText("Mẫu ngân hàng");

    fireEvent.change(screen.getByRole("searchbox", { name: "Tìm mẫu" }), { target: { value: "bệnh" } });
    await waitFor(() => expect(screen.queryByText("Mẫu ngân hàng")).not.toBeInTheDocument());
    expect(await screen.findByText("Bệnh viện - HIS")).toBeInTheDocument();
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

describe("OrgTemplatePicker - tải mẫu mới ngay trong hộp Tạo dự án (FLF-412)", () => {
  it("chỉ Lead thấy nút Tải mẫu lên thư viện; bấm thì mở ô đặt tên + chọn file", async () => {
    role.value = "lead";
    const lead = renderWithIntl(<OrgTemplatePicker onPick={vi.fn()} />);
    fireEvent.click(await screen.findByRole("button", { name: "Tải mẫu lên thư viện" }));
    expect(screen.getByLabelText("Tên mẫu")).toBeInTheDocument();
    lead.unmount();

    role.value = "analyst";
    renderWithIntl(<OrgTemplatePicker onPick={vi.fn()} />);
    await screen.findByRole("button", { name: /Hoặc chọn từ mẫu của tổ chức/ });
    expect(screen.queryByRole("button", { name: "Tải mẫu lên thư viện" })).not.toBeInTheDocument();
  });
});
