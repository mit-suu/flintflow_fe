import { fireEvent, screen } from "@testing-library/react";
import { renderWithIntl } from "@/test/intl";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import Tabs from "./Tabs";

function Harness() {
  const [value, setValue] = useState<"a" | "b" | "c">("a");
  return (
    <Tabs
      label="Xem theo"
      idBase="t"
      value={value}
      onChange={setValue}
      options={[
        { value: "a", label: "Tất cả" },
        { value: "b", label: "Thư mục", count: 2 },
        { value: "c", label: "Dự án", count: 5 },
      ]}
    />
  );
}

describe("Tabs", () => {
  it("tablist có tên; tab đang chọn aria-selected + tabindex 0, còn lại -1", () => {
    renderWithIntl(<Harness />);
    expect(screen.getByRole("tablist", { name: "Xem theo" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Tất cả" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: /Thư mục/ })).toHaveAttribute("tabindex", "-1");
    expect(screen.getByRole("tab", { name: /Dự án/ })).toHaveTextContent("5");
  });

  it("bấm và mũi tên/Home/End đổi tab, focus theo", () => {
    renderWithIntl(<Harness />);
    fireEvent.click(screen.getByRole("tab", { name: /Thư mục/ }));
    expect(screen.getByRole("tab", { name: /Thư mục/ })).toHaveAttribute("aria-selected", "true");

    fireEvent.keyDown(screen.getByRole("tab", { name: /Thư mục/ }), { key: "ArrowRight" });
    expect(screen.getByRole("tab", { name: /Dự án/ })).toHaveFocus();
    fireEvent.keyDown(screen.getByRole("tab", { name: /Dự án/ }), { key: "ArrowRight" });
    expect(screen.getByRole("tab", { name: "Tất cả" })).toHaveAttribute("aria-selected", "true");
    fireEvent.keyDown(screen.getByRole("tab", { name: "Tất cả" }), { key: "End" });
    expect(screen.getByRole("tab", { name: /Dự án/ })).toHaveAttribute("aria-selected", "true");
  });

  it("layout mặc định một hàng (inline-flex); layout grid dựng lưới để nơi gọi đặt số cột (FLF-436)", () => {
    const options = [
      { value: "a", label: "A" },
      { value: "b", label: "B" },
    ] as const;
    const { rerender } = renderWithIntl(<Tabs label="Mặc định" idBase="d" value="a" onChange={() => {}} options={options} />);
    expect(screen.getByRole("tablist")).toHaveClass("inline-flex");
    expect(screen.getByRole("tablist")).not.toHaveClass("grid");

    rerender(<Tabs label="Lưới" idBase="g" value="a" onChange={() => {}} options={options} layout="grid" className="grid-cols-2" />);
    expect(screen.getByRole("tablist")).toHaveClass("grid", "grid-cols-2");
    expect(screen.getByRole("tablist")).not.toHaveClass("inline-flex");
  });
});
