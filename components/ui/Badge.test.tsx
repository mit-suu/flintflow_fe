import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Badge, { SOON_LABEL, type BadgeTone } from "./Badge";

const TONES: BadgeTone[] = ["neutral", "primary", "success", "warning", "danger", "info", "soon"];

describe("Badge", () => {
  it.each(TONES)("tone %s render nhãn truyền vào", (tone) => {
    render(<Badge tone={tone}>Nhãn {tone}</Badge>);
    expect(screen.getByText(`Nhãn ${tone}`)).toBeInTheDocument();
  });

  it('tone "soon" mặc định chỉ hiện chữ "Sắp có", không kèm icon', () => {
    const { container } = render(<Badge tone="soon" />);
    expect(screen.getByText(SOON_LABEL)).toHaveTextContent("Sắp có");
    expect(container.querySelector("svg")).toBeNull();
  });

  it("dot ⇒ có chấm màu, tone soon thì không", () => {
    const { container, rerender } = render(<Badge tone="success" dot>Sẵn sàng</Badge>);
    expect(container.querySelector(".rounded-full.w-1\\.5")).not.toBeNull();

    rerender(<Badge tone="soon" dot />);
    expect(container.querySelector(".rounded-full.w-1\\.5")).toBeNull();
  });
});
