import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import Button from "./Button";

describe("Button", () => {
  it("mặc định type=button, bấm gọi onClick", () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Lưu</Button>);

    const button = screen.getByRole("button", { name: "Lưu" });
    expect(button).toHaveAttribute("type", "button");
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("loading ⇒ khoá nút, aria-busy, không gọi onClick", () => {
    const onClick = vi.fn();
    render(
      <Button loading onClick={onClick}>
        Đang tạo…
      </Button>
    );

    const button = screen.getByRole("button", { name: "Đang tạo…" });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
    fireEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("variant danger dùng token error, không hex", () => {
    render(<Button variant="danger">Xoá</Button>);
    expect(screen.getByRole("button", { name: "Xoá" }).className).toContain("bg-error");
  });
});
