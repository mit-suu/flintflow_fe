import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderWithIntl } from "@/test/intl";
import StructurePreview from "./structure-preview";

const baseProps = {
  fileName: "SRS.docx",
  preview: null,
  estimate: null,
  credits: null,
  onStart: vi.fn(),
  onDownloadGapReport: vi.fn(),
  onPickAnother: vi.fn(),
};

describe("StructurePreview - FLF-458 báo file lấy từ dự án khác", () => {
  it("không có foreignProject ⇒ không hiện thông báo", () => {
    renderWithIntl(<StructurePreview {...baseProps} />);
    expect(screen.queryByText(/lấy từ dự án/)).not.toBeInTheDocument();
  });

  it("foreignProject có tên ⇒ hiện tên dự án gốc", () => {
    renderWithIntl(<StructurePreview {...baseProps} foreignProject={{ project_id: "p1", name: "Dự án gốc" }} />);
    expect(screen.getByRole("status", { name: "" })).toBeTruthy();
    expect(screen.getByText(/File này lấy từ dự án "Dự án gốc"/)).toBeInTheDocument();
    expect(screen.getByText(/mặc định được đặt ở trạng thái Bỏ chữ/)).toBeInTheDocument();
  });

  it("foreignProject không có tên (khác tổ chức) ⇒ câu chung, không lộ id", () => {
    renderWithIntl(<StructurePreview {...baseProps} foreignProject={{ project_id: "p2", name: null }} />);
    expect(screen.getByText(/File này lấy từ một dự án FlintFlow khác/)).toBeInTheDocument();
    expect(screen.queryByText("p2")).not.toBeInTheDocument();
  });
});
