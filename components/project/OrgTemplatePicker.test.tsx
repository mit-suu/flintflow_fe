import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderWithIntl } from "@/test/intl";
import OrgTemplatePicker from "./OrgTemplatePicker";

vi.mock("@/lib/api/token-store", async (importOriginal) => ({ ...(await importOriginal<object>()), getActiveOrgId: () => "o1" }));
vi.mock("@/lib/api/org-library", () => ({
  listOrgTemplates: vi.fn(async () => [
    { id: "t1", name: "Mẫu ngân hàng", source_file_name: "bank.docx", heading_count: 42, custom_count: 9, template_family: "ieee29148", uses: 2, created_at: "2026-10-20T00:00:00.000Z" },
  ]),
}));

describe("OrgTemplatePicker — lối phụ của ô SRS (FLF-278)", () => {
  it("thu gọn một dòng; mở ra chọn mẫu đã lưu thay cho tải file", async () => {
    const onPick = vi.fn();
    renderWithIntl(<OrgTemplatePicker onPick={onPick} />);
    const toggle = await screen.findByRole("button", { name: /Hoặc chọn từ mẫu của tổ chức \(1\)/ });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("Mẫu ngân hàng")).not.toBeInTheDocument();
    fireEvent.click(toggle);
    expect(screen.getByText("bank.docx · 42 heading · đã dùng 2 lần")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Mẫu ngân hàng/ }));
    expect(onPick).toHaveBeenCalledWith(expect.objectContaining({ id: "t1", name: "Mẫu ngân hàng" }));
  });
});
