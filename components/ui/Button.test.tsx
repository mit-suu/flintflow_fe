import { fireEvent, screen } from "@testing-library/react";
import { renderWithIntl } from "@/test/intl";
import { describe, expect, it, vi } from "vitest";
import Button from "./Button";

describe("Button", () => {
  it("mặc định type=button, bấm gọi onClick", () => {
    const onClick = vi.fn();
    renderWithIntl(<Button onClick={onClick}>Lưu</Button>);

    const button = screen.getByRole("button", { name: "Lưu" });
    expect(button).toHaveAttribute("type", "button");
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("loading ⇒ khoá nút, aria-busy, không gọi onClick", () => {
    const onClick = vi.fn();
    renderWithIntl(
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
    renderWithIntl(<Button variant="danger">Xoá</Button>);
    expect(screen.getByRole("button", { name: "Xoá" }).className).toContain("bg-error");
  });
});
