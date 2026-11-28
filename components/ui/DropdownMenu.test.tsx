import { fireEvent, screen } from "@testing-library/react";
import { renderWithIntl } from "@/test/intl";
import { afterEach, describe, expect, it, vi } from "vitest";
import DropdownMenu from "./DropdownMenu";

const setup = () => {
  const onRename = vi.fn();
  const onDelete = vi.fn();
  renderWithIntl(
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

  describe("floating (trigger trong vùng cuộn)", () => {
    const rect = (top: number, bottom: number) =>
      ({ top, bottom, left: 100, right: 140, width: 40, height: bottom - top, x: 100, y: top, toJSON: () => ({}) }) as DOMRect;

    const openFloating = (placement: "bottom-end" | "top", triggerRect: DOMRect, menuHeight: number) => {
      vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue(triggerRect);
      vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockReturnValue(menuHeight);
      renderWithIntl(
        <DropdownMenu
          floating
          placement={placement}
          trigger={(props) => (
            <button type="button" {...props}>
              Mở menu
            </button>
          )}
          items={[{ label: "Đổi tên", onSelect: () => {} }]}
        />
      );
      fireEvent.click(screen.getByRole("button", { name: "Mở menu" }));
      return screen.getByRole("menu");
    };

    afterEach(() => vi.restoreAllMocks());

    it("bottom-end: vẽ fixed ngay dưới trigger, canh mép phải trigger", () => {
      const menu = openFloating("bottom-end", rect(100, 130), 80);
      expect(menu).toHaveClass("fixed");
      expect(menu.style.top).toBe("136px");
      expect(menu.style.right).toBe(`${window.innerWidth - 140}px`);
      // Vẫn focus được mục đầu (menu không bị ẩn lúc mở)
      expect(screen.getByRole("menuitem", { name: "Đổi tên" })).toHaveFocus();
    });

    it("bottom-end: bên dưới thiếu chỗ ⇒ lật lên trên trigger", () => {
      const h = window.innerHeight;
      const menu = openFloating("bottom-end", rect(h - 40, h - 10), 120);
      expect(menu.style.top).toBe("");
      expect(menu.style.bottom).toBe(`${h - (h - 40) + 8}px`);
    });

    it("top: bên trên thiếu chỗ ⇒ lật xuống dưới trigger", () => {
      const menu = openFloating("top", rect(20, 50), 120);
      expect(menu.style.bottom).toBe("");
      expect(menu.style.top).toBe("56px");
      expect(menu.style.left).toBe("100px");
    });
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
