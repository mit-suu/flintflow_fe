import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Collapse from "./Collapse";
import { PRESENCE_MS } from "@/lib/hooks/use-presence";

describe("Collapse", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("đóng ⇒ không render; mở ⇒ render ngay", () => {
    const { rerender } = render(<Collapse open={false}>Nội dung</Collapse>);
    expect(screen.queryByText("Nội dung")).not.toBeInTheDocument();
    rerender(<Collapse open>Nội dung</Collapse>);
    expect(screen.getByText("Nội dung")).toBeInTheDocument();
  });

  it("đóng lại ⇒ giữ trong DOM cho hiệu ứng rồi mới gỡ", () => {
    const { rerender } = render(<Collapse open>Nội dung</Collapse>);
    rerender(<Collapse open={false}>Nội dung</Collapse>);
    expect(screen.getByText("Nội dung")).toBeInTheDocument();
    act(() => void vi.advanceTimersByTime(PRESENCE_MS));
    expect(screen.queryByText("Nội dung")).not.toBeInTheDocument();
  });
});
