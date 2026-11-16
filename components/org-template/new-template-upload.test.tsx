import { fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithIntl } from "@/test/intl";
import * as api from "@/lib/api/org-library";
import type { TemplateVersionDetail } from "@/types/org-library";
import NewTemplateUpload from "./new-template-upload";

vi.mock("@/lib/api/org-library", () => ({ uploadOrgTemplate: vi.fn(), publishTemplateVersion: vi.fn() }));

const draft: TemplateVersionDetail = {
  template_id: "t9",
  name: "Mẫu kho",
  version: 1,
  status: "draft",
  source_file_name: "kho.docx",
  heading_count: 2,
  custom_count: 0,
  language: "vi",
  template_family: null,
  project_count: 0,
  pending_count: 0,
  created_at: "2026-11-12T00:00:00.000Z",
  headings: [
    { index: 0, heading_text: "1 Giới thiệu", section_id: "fixed:1", has_text: true },
    { index: 1, heading_text: "2 Tác nhân", section_id: "fixed:2.1" },
  ],
};

beforeEach(() => vi.clearAllMocks());

describe("NewTemplateUpload - Lead tải mẫu mới ngay trong hộp Tạo dự án", () => {
  it("đặt tên + chọn file ⇒ rà mapping có cảnh báo chữ cũ ⇒ đăng ⇒ báo bản vừa đăng", async () => {
    vi.mocked(api.uploadOrgTemplate).mockResolvedValue(draft);
    vi.mocked(api.publishTemplateVersion).mockResolvedValue({ ...draft, status: "published" });
    const onPublished = vi.fn();
    renderWithIntl(<NewTemplateUpload orgId="o1" onPublished={onPublished} onCancel={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Tên mẫu"), { target: { value: "Mẫu kho" } });
    const file = new File(["x"], "kho.docx");
    fireEvent.change(screen.getByLabelText("File .docx của mẫu mới"), { target: { files: [file] } });
    await waitFor(() => expect(api.uploadOrgTemplate).toHaveBeenCalledWith("o1", "Mẫu kho", file));
    expect(await screen.findByRole("status")).toHaveTextContent("1/2");
    fireEvent.click(screen.getByRole("button", { name: "Đăng bản này" }));
    await waitFor(() => expect(api.publishTemplateVersion).toHaveBeenCalledWith("o1", "t9", 1, []));
    expect(onPublished).toHaveBeenCalledWith(expect.objectContaining({ template_id: "t9", status: "published" }));
  });
});
