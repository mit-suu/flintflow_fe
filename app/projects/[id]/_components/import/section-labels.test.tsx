import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderWithIntl } from "@/test/intl";
import type { StructurePreview } from "@/types/import";
import SectionLabels from "./section-labels";

const sections: StructurePreview["sections"] = [
  { section_id: "fixed:3.2", title: "Những gì hệ thống làm", status: "present", order: 0, block_id: "B0003", uncertain: true, matched_title: "3.2 Functional Requirements" },
  { section_id: "fixed:1", title: "1 Overview", status: "present", order: 1, block_id: "B0001" },
  { section_id: "custom:CS01", title: "Chi phí dự kiến", status: "out_of_scope", order: 2, block_id: "B0004", scope_label: "out_of_scope" },
];

describe("SectionLabels - FLF-460 dấu chưa chắc và đổi nhãn", () => {
  it("mục khớp độ tin thấp hiện dấu chưa chắc, cờ Cần xem và gợi ý mục khớp; mục chắc không có dấu", () => {
    renderWithIntl(<SectionLabels sections={sections} onRelabel={vi.fn()} />);
    expect(screen.getByText("Những gì hệ thống làm")).toBeInTheDocument();
    expect(screen.getByText("Chưa chắc")).toBeInTheDocument();
    expect(screen.getByText("Cần xem")).toBeInTheDocument();
    expect(screen.getByText(/Có thể là 3\.2 Functional Requirements\?/)).toBeInTheDocument();
    // chỉ một dấu: mục "1 Overview" nằm trong phần các mục khác
    expect(screen.getAllByText("Chưa chắc")).toHaveLength(1);
  });

  it("đưa mục ra Ngoài phạm vi / vào lại / bỏ nhãn tay gọi onRelabel đúng khoá", () => {
    const onRelabel = vi.fn();
    renderWithIntl(<SectionLabels sections={sections} onRelabel={onRelabel} />);
    fireEvent.click(screen.getAllByText("Đưa ra Ngoài phạm vi")[0]);
    expect(onRelabel).toHaveBeenLastCalledWith({ block_id: "B0003", scope: "out_of_scope" });
    fireEvent.click(screen.getByText("Đưa vào phạm vi"));
    expect(onRelabel).toHaveBeenLastCalledWith({ block_id: "B0004", scope: "in_scope" });
    fireEvent.click(screen.getByText("Để hệ thống tự phân loại"));
    expect(onRelabel).toHaveBeenLastCalledWith({ block_id: "B0004", scope: "auto" });
  });

  it("đổi mục khớp qua ô chọn", () => {
    const onRelabel = vi.fn();
    renderWithIntl(<SectionLabels sections={sections} onRelabel={onRelabel} />);
    fireEvent.change(screen.getByLabelText("Đổi mục khớp của Những gì hệ thống làm"), { target: { value: "fixed:2.1" } });
    expect(onRelabel).toHaveBeenCalledWith({ block_id: "B0003", section_id: "fixed:2.1" });
  });

  it("bản sơ bộ không có heading nào ⇒ không hiện khối", () => {
    const { container } = renderWithIntl(<SectionLabels sections={[{ section_id: "fixed:1", title: "1", status: "present", order: 0 }]} onRelabel={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });
});
