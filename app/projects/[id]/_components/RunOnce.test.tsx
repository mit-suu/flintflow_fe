import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import { RunOnce } from "./RunOnce";

describe("RunOnce (FLF-416)", () => {
  it("chạy đúng một lần dù component render lại với hàm mới", () => {
    const onRun = vi.fn();
    const { rerender } = render(<RunOnce onRun={onRun} />);
    rerender(<RunOnce onRun={() => onRun()} />);
    rerender(<RunOnce onRun={() => onRun()} />);
    expect(onRun).toHaveBeenCalledTimes(1);
  });
});
