import { screen } from "@testing-library/react";
import { renderWithIntl } from "@/test/intl";
import { describe, expect, it } from "vitest";
import Icon from "./Icon";

describe("Icon", () => {
  it("render SVG Phosphor, mặc định là trang trí (ẩn khỏi trình đọc màn hình)", () => {
    const { container } = renderWithIntl(<Icon name="bell" size={20} />);
    const svg = container.querySelector("svg");

    expect(svg).not.toBeNull();
    expect(svg).toHaveAttribute("aria-hidden", "true");
    expect(svg).toHaveAttribute("width", "20");
  });

  it("có label ⇒ là ảnh có tên", () => {
    renderWithIntl(<Icon name="search" label="Tìm kiếm" />);
    expect(screen.getByRole("img", { name: "Tìm kiếm" })).toBeInTheDocument();
  });

  it("tên sai bị typecheck chặn", () => {
    // @ts-expect-error — "khong-co" không thuộc IconName
    const bad = () => <Icon name="khong-co" />;
    expect(typeof bad).toBe("function");
  });
});
