import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderWithIntl } from "@/test/intl";
import OrgTemplatePicker from "./OrgTemplatePicker";
import SaveOrgTemplateCard from "./SaveOrgTemplateCard";
import * as api from "@/lib/api/org-library";

vi.mock("@/lib/api/token-store", async (importOriginal) => ({ ...(await importOriginal<object>()), getActiveOrgId: () => "o1" }));
vi.mock("@/lib/api/org-library", () => ({
  listOrgTemplates: vi.fn(async () => [
    { id: "t1", name: "Mẫu ngân hàng", source_file_name: "bank.docx", heading_count: 42, custom_count: 9, template_family: "ieee830", uses: 2, created_at: "2026-10-20T00:00:00.000Z" },
  ]),
  saveImportToOrg: vi.fn(async () => ({ id: "t2" })),
}));

describe("Mẫu của tổ chức trong wizard import (FLF-278 trên FLF-335/336)", () => {
  it("chọn mẫu đã lưu thay cho tải file", async () => {
    const onPick = vi.fn();
    renderWithIntl(<OrgTemplatePicker busy={false} onPick={onPick} />);
    expect(await screen.findByText("Mẫu ngân hàng")).toBeInTheDocument();
    expect(screen.getByText("bank.docx · 42 heading · đã dùng 2 lần")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Dùng mẫu này" }));
    expect(onPick).toHaveBeenCalledWith("t1");
  });

  it("lưu file mẫu + mapping làm mẫu của tổ chức", async () => {
    renderWithIntl(<SaveOrgTemplateCard projectId="p1" defaultName="BMB_SRS" />);
    const name = screen.getByLabelText("Tên mẫu");
    expect(name).toHaveValue("BMB_SRS");
    fireEvent.change(name, { target: { value: "Mẫu ngân hàng" } });
    fireEvent.click(screen.getByRole("button", { name: "Lưu làm mẫu của tổ chức" }));
    expect(await screen.findByText(/Đã lưu. Dự án mới của tổ chức/)).toBeInTheDocument();
    expect(api.saveImportToOrg).toHaveBeenCalledWith("p1", "Mẫu ngân hàng");
  });
});
