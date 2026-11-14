import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderWithIntl } from "@/test/intl";
import SequenceLevelPicker from "./SequenceLevelPicker";

describe("SequenceLevelPicker (FLF-418)", () => {
  it("radiogroup 2 lựa chọn kèm mô tả; chỉ nút đang chọn nhận Tab", () => {
    renderWithIntl(<SequenceLevelPicker value="component" onChange={() => {}} />);
    expect(screen.getByRole("radiogroup", { name: "Mức Sequence Diagram" })).toBeInTheDocument();
    expect(screen.getAllByRole("radio")).toHaveLength(2);
    expect(screen.getByRole("radio", { name: /^Thành phần/ })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("radio", { name: /^Thành phần/ })).toHaveAttribute("tabindex", "0");
    expect(screen.getByRole("radio", { name: /^Hệ thống/ })).toHaveAttribute("tabindex", "-1");
    expect(screen.getByRole("radio", { name: /^Thành phần/ })).toHaveTextContent("boundary");
  });

  it("bấm, mũi tên (vòng lại) và Space đều gọi onChange", () => {
    const onChange = vi.fn();
    renderWithIntl(<SequenceLevelPicker value="system" onChange={onChange} />);
    fireEvent.click(screen.getByRole("radio", { name: /^Thành phần/ }));
    expect(onChange).toHaveBeenLastCalledWith("component");
    fireEvent.keyDown(screen.getByRole("radio", { name: /^Hệ thống/ }), { key: "ArrowLeft" });
    expect(onChange).toHaveBeenLastCalledWith("component");
    fireEvent.keyDown(screen.getByRole("radio", { name: /^Hệ thống/ }), { key: " " });
    expect(onChange).toHaveBeenLastCalledWith("system");
  });

  it("disabled ⇒ không đổi được; giao diện tiếng Anh", () => {
    const onChange = vi.fn();
    renderWithIntl(<SequenceLevelPicker value="system" onChange={onChange} disabled />, "en");
    fireEvent.click(screen.getByRole("radio", { name: /^Component/ }));
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole("radiogroup", { name: "Sequence diagram level" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /^System/ })).toHaveTextContent("black box");
  });
});
