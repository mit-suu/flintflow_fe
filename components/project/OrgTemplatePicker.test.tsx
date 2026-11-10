import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderWithIntl } from "@/test/intl";
import OrgTemplatePicker from "./OrgTemplatePicker";

vi.mock("@/lib/api/token-store", async (importOriginal) => ({ ...(await importOriginal<object>()), getActiveOrgId: () => "o1" }));
vi.mock("@/lib/api/org-library", () => ({
  listOrgTemplates: vi.fn(async () => [
    {
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
    },
    {
      id: "t2",
      name: "Mẫu chỉ có bản nháp",
      source_file_name: "draft.docx",
      heading_count: 5,
      custom_count: 0,
      template_family: null,
      uses: 0,
      created_at: "2026-10-20T00:00:00.000Z",
      latest_version: 0,
      project_count: 0,
      pending_count: 0,
      skeleton: false,
      versions: [{ version: 1, status: "draft" }],
    },
  ]),
}));

describe("OrgTemplatePicker — lối phụ của ô SRS (FLF-278)", () => {
  it("thu gọn một dòng; mở ra chọn mẫu đã đăng (mặc định bản mới nhất), không hiện họ chỉ có bản nháp", async () => {
    const onPick = vi.fn();
    renderWithIntl(<OrgTemplatePicker onPick={onPick} />);
    const toggle = await screen.findByRole("button", { name: /Hoặc chọn từ mẫu của tổ chức \(1\)/ });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("Mẫu ngân hàng")).not.toBeInTheDocument();
    fireEvent.click(toggle);
    expect(screen.getByText("bank.docx · 42 heading · đã dùng 2 lần")).toBeInTheDocument();
    expect(screen.queryByText("Mẫu chỉ có bản nháp")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Mẫu ngân hàng/ }));
    expect(onPick).toHaveBeenCalledWith(expect.objectContaining({ id: "t1", name: "Mẫu ngân hàng" }), 2);
  });

  it("chọn bản cũ hơn trước khi dùng mẫu; bản nháp không chọn được", async () => {
    const onPick = vi.fn();
    renderWithIntl(<OrgTemplatePicker onPick={onPick} />);
    fireEvent.click(await screen.findByRole("button", { name: /Hoặc chọn từ mẫu của tổ chức \(1\)/ }));
    const select = screen.getByLabelText("Bản của mẫu Mẫu ngân hàng");
    expect(select).toHaveValue("2");
    expect(screen.queryByRole("option", { name: "Bản 3" })).not.toBeInTheDocument();
    fireEvent.change(select, { target: { value: "1" } });
    expect(screen.getByText("bank-old.docx · 30 heading · đã dùng 2 lần")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Mẫu ngân hàng/ }));
    expect(onPick).toHaveBeenCalledWith(expect.objectContaining({ id: "t1" }), 1);
  });
});
