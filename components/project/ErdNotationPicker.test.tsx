import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderWithIntl } from "@/test/intl";
import ErdNotationPicker from "./ErdNotationPicker";

describe("ErdNotationPicker (FLF-324)", () => {
  it("radiogroup 3 lựa chọn kèm mô tả; chỉ nút đang chọn nhận Tab", () => {
    renderWithIntl(<ErdNotationPicker value="crowsfoot" onChange={() => {}} />);
    expect(screen.getByRole("radiogroup", { name: "Ký pháp ERD" })).toBeInTheDocument();
    expect(screen.getAllByRole("radio")).toHaveLength(3);
    expect(screen.getByRole("radio", { name: /^Crow's foot/ })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("radio", { name: /^Crow's foot/ })).toHaveAttribute("tabindex", "0");
    expect(screen.getByRole("radio", { name: /^Chen/ })).toHaveAttribute("tabindex", "-1");
    expect(screen.getByRole("radio", { name: /^IDEF1X/ })).toHaveTextContent("chấm đặc");
  });

  it("bấm, mũi tên (vòng lại) và Space đều gọi onChange", () => {
    const onChange = vi.fn();
    renderWithIntl(<ErdNotationPicker value="chen" onChange={onChange} />);
    fireEvent.click(screen.getByRole("radio", { name: /^IDEF1X/ }));
    expect(onChange).toHaveBeenLastCalledWith("idef1x");
    fireEvent.keyDown(screen.getByRole("radio", { name: /^Chen/ }), { key: "ArrowLeft" });
    expect(onChange).toHaveBeenLastCalledWith("idef1x");
    fireEvent.keyDown(screen.getByRole("radio", { name: /^Chen/ }), { key: " " });
    expect(onChange).toHaveBeenLastCalledWith("chen");
  });

  it("disabled ⇒ không đổi được; giao diện tiếng Anh dịch mô tả", () => {
    const onChange = vi.fn();
    renderWithIntl(<ErdNotationPicker value="chen" onChange={onChange} disabled />, "en");
    fireEvent.click(screen.getByRole("radio", { name: /^IDEF1X/ }));
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole("radiogroup", { name: "ERD notation" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /^Chen/ })).toHaveTextContent("diamonds");
  });
});
