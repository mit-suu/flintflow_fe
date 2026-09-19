import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import DropdownMenu from "./DropdownMenu";

const setup = () => {
  const onRename = vi.fn();
  const onDelete = vi.fn();
  render(
    <div>
      <DropdownMenu
        trigger={(props) => (
          <button type="button" {...props}>
            Mở menu
          </button>
        )}
        items={[
          { label: "Đổi tên", icon: "pencil", onSelect: onRename },
          { label: "Xoá", icon: "trash", tone: "danger", onSelect: onDelete },
        ]}
      />
      <p>Bên ngoài</p>
    </div>
  );
  return { onRename, onDelete, trigger: screen.getByRole("button", { name: "Mở menu" }) };
};

describe("DropdownMenu", () => {
  it("đóng mặc định; bấm trigger mở, aria-expanded đổi theo, focus vào mục đầu", () => {
    const { trigger } = setup();
    expect(screen.queryByRole("menu")).toBeNull();
    expect(trigger).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(trigger);

    expect(screen.getByRole("menu")).toBeInTheDocument();
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("menuitem", { name: "Đổi tên" })).toHaveFocus();
  });

  it("chọn mục ⇒ gọi onSelect và đóng", () => {
    const { trigger, onDelete } = setup();
    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole("menuitem", { name: "Xoá" }));

    expect(onDelete).toHaveBeenCalledOnce();
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("Esc đóng và trả focus về trigger; bấm ra ngoài cũng đóng", () => {
    const { trigger } = setup();
    fireEvent.click(trigger);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("menu")).toBeNull();
    expect(trigger).toHaveFocus();

    fireEvent.click(trigger);
    fireEvent.mouseDown(screen.getByText("Bên ngoài"));
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("mũi tên xuống/lên chuyển focus giữa các mục (vòng lại)", () => {
    const { trigger } = setup();
    fireEvent.click(trigger);
    const menu = screen.getByRole("menu");

    fireEvent.keyDown(menu, { key: "ArrowDown" });
    expect(screen.getByRole("menuitem", { name: "Xoá" })).toHaveFocus();
    fireEvent.keyDown(menu, { key: "ArrowDown" });
    expect(screen.getByRole("menuitem", { name: "Đổi tên" })).toHaveFocus();
    fireEvent.keyDown(menu, { key: "ArrowUp" });
    expect(screen.getByRole("menuitem", { name: "Xoá" })).toHaveFocus();
  });
});
