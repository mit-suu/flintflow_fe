import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import FilterSelect from "./FilterSelect";

const OPTIONS = [
  { value: "active", label: "Đang làm" },
  { value: "archived", label: "Lưu trữ" },
] as const;

describe("FilterSelect", () => {
  it("hiện nhãn của giá trị đang chọn; select gốc có tên để dùng bàn phím", () => {
    render(<FilterSelect label="Trạng thái" value="active" options={OPTIONS} onChange={() => {}} />);

    expect(screen.getByText("Đang làm", { selector: "span" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Trạng thái" })).toHaveValue("active");
  });

  it("đổi lựa chọn ⇒ gọi onChange với value", () => {
    const onChange = vi.fn();
    render(<FilterSelect label="Trạng thái" value="active" options={OPTIONS} onChange={onChange} />);

    fireEvent.change(screen.getByRole("combobox", { name: "Trạng thái" }), { target: { value: "archived" } });

    expect(onChange).toHaveBeenCalledWith("archived");
  });
});
