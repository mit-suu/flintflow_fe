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
});
