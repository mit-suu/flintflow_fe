import { fireEvent, screen } from "@testing-library/react";
import { renderWithIntl } from "@/test/intl";
import { describe, expect, it, vi } from "vitest";
import WorkspaceToolRail from "../WorkspaceToolRail";

describe("WorkspaceToolRail", () => {
  it("mỗi nút mở một panel; nút đang mở có aria-pressed", () => {
    const onToggle = vi.fn();
    renderWithIntl(<WorkspaceToolRail active="verification" onToggle={onToggle} />);
    expect(screen.getByRole("button", { name: /Verification/ })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /Sửa tài liệu/ })).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(screen.getByRole("button", { name: /Sửa tài liệu/ }));
    expect(onToggle).toHaveBeenCalledWith("change");
    fireEvent.click(screen.getByRole("button", { name: /Công cụ/ }));
    expect(onToggle).toHaveBeenCalledWith("tools");
  });

  it("số cờ đỏ hiện trên nút Verification; mode 1 đổi nhãn công cụ", () => {
    renderWithIntl(<WorkspaceToolRail active={null} onToggle={vi.fn()} flagsCount={20} mode1 />);
    expect(screen.getByRole("button", { name: /Verification/ })).toHaveTextContent("20");
    expect(screen.getByRole("button", { name: /Cờ, change request & version/ })).toBeInTheDocument();
  });

  it("đang mở rộng trang ⇒ nút thoát ở đầu rail", () => {
    const onExitFocus = vi.fn();
    const { rerender } = renderWithIntl(<WorkspaceToolRail active={null} onToggle={vi.fn()} />);
    expect(screen.queryByRole("button", { name: /Thoát mở rộng/ })).not.toBeInTheDocument();
    rerender(<WorkspaceToolRail active={null} onToggle={vi.fn()} onExitFocus={onExitFocus} />);
    fireEvent.click(screen.getByRole("button", { name: /Thoát mở rộng/ }));
    expect(onExitFocus).toHaveBeenCalledTimes(1);
  });
});
