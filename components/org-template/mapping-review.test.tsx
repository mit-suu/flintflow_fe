import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderWithIntl } from "@/test/intl";
import MappingReview from "./mapping-review";

const options = [
  { id: "unmapped", label: "Không khớp" },
  { id: "fixed:1", label: "1 Product Overview" },
  { id: "fixed:2.1", label: "2.1 Actors" },
];
const headings = [
  { index: 0, heading_text: "Introduction", section_id: "fixed:1" },
  { index: 1, heading_text: "Người dùng hệ thống", section_id: "unmapped", needs_review: true },
];

describe("MappingReview — rà mapping heading → section", () => {
  it("mục Cần xem lên đầu, đổi section báo đúng vị trí heading", () => {
    const onChange = vi.fn();
    renderWithIntl(<MappingReview headings={headings} sectionOptions={options} onChange={onChange} />);
    const rows = screen.getAllByRole("listitem");
    expect(rows[0]).toHaveTextContent("Người dùng hệ thống");
    expect(rows[0]).toHaveTextContent("Cần xem");
    fireEvent.change(screen.getByLabelText("Người dùng hệ thống"), { target: { value: "fixed:2.1" } });
    expect(onChange).toHaveBeenCalledWith(1, "fixed:2.1");
  });

  it("lọc chỉ mục cần xem", () => {
    renderWithIntl(<MappingReview headings={headings} sectionOptions={options} onChange={() => {}} />);
    fireEvent.click(screen.getByRole("checkbox", { name: /Chỉ hiện mục cần xem \(1\)/ }));
    expect(screen.queryByText("Introduction")).not.toBeInTheDocument();
    expect(screen.getByText("Người dùng hệ thống")).toBeInTheDocument();
  });
});
