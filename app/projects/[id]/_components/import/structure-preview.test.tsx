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

describe("StructurePreview - FLF-458 credit đọc tài liệu tham khảo gộp ở màn đọc khung", () => {
  const estimate = { text_batches: 2, diagram_images: 0, ai_calls: 4, credits: 9, available_credits: 50, reference_documents: 2, reference_credits: 2 };
  it("có tài liệu tham khảo chờ đọc ⇒ báo số tài liệu và credit cùng lượt", () => {
    renderWithIntl(<StructurePreview {...baseProps} estimate={estimate} />);
    expect(screen.getByText(/Đã gồm 2 tài liệu tham khảo đọc cùng lượt này \(2 credit\)/)).toBeInTheDocument();
  });
  it("không có tài liệu tham khảo ⇒ không hiện dòng đó", () => {
    renderWithIntl(<StructurePreview {...baseProps} estimate={{ ...estimate, reference_documents: 0, reference_credits: 0 }} />);
    expect(screen.queryByText(/tài liệu tham khảo đọc cùng lượt/)).not.toBeInTheDocument();
  });
});
