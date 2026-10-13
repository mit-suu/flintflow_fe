import { fireEvent, screen } from "@testing-library/react";
import { renderWithIntl } from "@/test/intl";
import { describe, expect, it, vi } from "vitest";
import FilterSelect from "./FilterSelect";

const OPTIONS = [
  { value: "active", label: "Đang làm" },
  { value: "archived", label: "Lưu trữ" },
] as const;

describe("FilterSelect", () => {
  it("hiện nhãn của giá trị đang chọn; combobox có tên, đóng sẵn", () => {
    renderWithIntl(<FilterSelect label="Trạng thái" value="active" options={OPTIONS} onChange={() => {}} />);

    const box = screen.getByRole("combobox", { name: "Trạng thái" });
    expect(box).toHaveTextContent("Đang làm");
    expect(box).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("mặc định canh phải", () => {
    renderWithIntl(<FilterSelect label="Trạng thái" value="active" options={OPTIONS} onChange={() => {}} />);
    fireEvent.click(screen.getByRole("combobox", { name: "Trạng thái" }));
    expect(screen.getByRole("listbox")).toHaveClass("right-0");
  });

  it("align=start canh trái — nút sát mép trái khung hẹp thì menu không tràn ra ngoài rồi bị cắt", () => {
    renderWithIntl(<FilterSelect label="Loại" value="active" options={OPTIONS} onChange={() => {}} align="start" />);
    fireEvent.click(screen.getByRole("combobox", { name: "Loại" }));
    expect(screen.getByRole("listbox")).toHaveClass("left-0");
  });

  it("bấm mở danh sách; mục đang chọn được đánh dấu; chọn mục khác ⇒ onChange + đóng", () => {
    const onChange = vi.fn();
    renderWithIntl(<FilterSelect label="Trạng thái" value="active" options={OPTIONS} onChange={onChange} />);

    fireEvent.click(screen.getByRole("combobox", { name: "Trạng thái" }));
    expect(screen.getByRole("option", { name: "Đang làm" })).toHaveAttribute("aria-selected", "true");

    fireEvent.mouseDown(screen.getByRole("option", { name: "Lưu trữ" }));
    expect(onChange).toHaveBeenCalledWith("archived");
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("bàn phím: ↓ mở, ↓ xuống mục kế, Enter chọn; Esc đóng không đổi", () => {
    const onChange = vi.fn();
    renderWithIntl(<FilterSelect label="Trạng thái" value="active" options={OPTIONS} onChange={onChange} />);
    const box = screen.getByRole("combobox", { name: "Trạng thái" });

    fireEvent.keyDown(box, { key: "ArrowDown" });
    expect(box).toHaveAttribute("aria-expanded", "true");
    fireEvent.keyDown(box, { key: "Escape" });
    expect(box).toHaveAttribute("aria-expanded", "false");
    expect(onChange).not.toHaveBeenCalled();

    fireEvent.keyDown(box, { key: "ArrowDown" });
    fireEvent.keyDown(box, { key: "ArrowDown" });
    fireEvent.keyDown(box, { key: "Enter" });
    expect(onChange).toHaveBeenCalledWith("archived");
  });
});
