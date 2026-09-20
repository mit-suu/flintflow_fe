import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import Modal from "./Modal";

describe("Modal", () => {
  it("không render gì khi đóng", () => {
    const { container } = render(
      <Modal open={false} onClose={() => {}} title="Tạo dự án mới">
        <p>Nội dung</p>
      </Modal>
    );

    expect(container).toBeEmptyDOMElement();
  });

  it("hiện tiêu đề và nội dung khi mở", () => {
    render(
      <Modal open onClose={() => {}} title="Tạo dự án mới">
        <p>Nội dung</p>
      </Modal>
    );

    expect(screen.getByRole("heading", { name: "Tạo dự án mới" })).toBeInTheDocument();
    expect(screen.getByText("Nội dung")).toBeInTheDocument();
  });

  it("gọi onClose khi nhấn Escape", () => {
    const onClose = vi.fn();
    render(
      <Modal open onClose={onClose} title="Tạo dự án mới">
        <p>Nội dung</p>
      </Modal>
    );

    fireEvent.keyDown(window, { key: "Escape" });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("bấm vào nội dung không đóng, bấm nút Đóng thì đóng", () => {
    const onClose = vi.fn();
    render(
      <Modal open onClose={onClose} title="Tạo dự án mới">
        <p>Nội dung</p>
      </Modal>
    );

    fireEvent.click(screen.getByText("Nội dung"));
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Đóng" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe("Modal — focus", () => {
  function Harness() {
    const [open, setOpen] = useState(false);
    return (
      <>
        <button type="button" onClick={() => setOpen(true)}>
          Mở
        </button>
        <Modal open={open} onClose={() => setOpen(false)} title="Hộp thoại">
          <button type="button">Hành động</button>
        </Modal>
      </>
    );
  }

  it("mở ⇒ focus vào trong; Tab vòng trong dialog; đóng ⇒ trả focus về nút mở", () => {
    render(<Harness />);
    const opener = screen.getByRole("button", { name: "Mở" });
    opener.focus();
    fireEvent.click(opener);

    const close = screen.getByRole("button", { name: "Đóng" });
    const action = screen.getByRole("button", { name: "Hành động" });
    expect(close).toHaveFocus();

    action.focus();
    fireEvent.keyDown(action, { key: "Tab" });
    expect(close).toHaveFocus();
    fireEvent.keyDown(close, { key: "Tab", shiftKey: true });
    expect(action).toHaveFocus();

    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(opener).toHaveFocus();
  });
});
