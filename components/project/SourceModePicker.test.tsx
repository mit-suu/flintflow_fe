import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import type { ProjectMode } from "@/types/project";
import SourceModePicker from "./SourceModePicker";

// Test logic chọn/phím với 2 thẻ sẵn sàng + 1 thẻ soon, không phụ thuộc mode nào đang bật ở config thật
vi.mock("@/lib/project-source-mode", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/project-source-mode")>();
  return {
    ...actual,
    SOURCE_MODE_OPTIONS: actual.SOURCE_MODE_OPTIONS.map((o) => (o.value === "import" ? { ...o, status: "ready" } : o)),
  };
});

function Controlled({ onChange }: { onChange?: (m: ProjectMode) => void }) {
  const [value, setValue] = useState<ProjectMode | null>(null);
  return (
    <SourceModePicker
      value={value}
      onChange={(m) => {
        setValue(m);
        onChange?.(m);
      }}
    />
  );
}

const radio = (name: RegExp) => screen.getByRole("radio", { name });

describe("SourceModePicker (UC-13)", () => {
  it("3 thẻ, không chọn sẵn thẻ nào", () => {
    render(<Controlled />);
    expect(screen.getAllByRole("radio")).toHaveLength(3);
    for (const r of screen.getAllByRole("radio")) expect(r).toHaveAttribute("aria-checked", "false");
  });

  it("click chọn thẻ, aria-checked theo", () => {
    const onChange = vi.fn();
    render(<Controlled onChange={onChange} />);
    fireEvent.click(radio(/Upload SRS có sẵn/));

    expect(onChange).toHaveBeenCalledWith("import");
    expect(radio(/Upload SRS có sẵn/)).toHaveAttribute("aria-checked", "true");
  });

  it('thẻ "Có template của khách" (soon): badge Sắp có, aria-disabled, click/phím không chọn được', () => {
    const onChange = vi.fn();
    render(<Controlled onChange={onChange} />);
    const soon = radio(/Có template của khách/);

    expect(soon).toHaveAttribute("aria-disabled", "true");
    expect(soon).toHaveAttribute("tabindex", "-1");
    expect(soon).toHaveTextContent("Sắp có");
    fireEvent.click(soon);
    fireEvent.keyDown(soon, { key: " " });
    expect(onChange).not.toHaveBeenCalled();
  });

  it("mũi tên chọn thẻ kế tiếp và bỏ qua thẻ soon; roving tabindex", () => {
    render(<Controlled />);
    const upload = radio(/Upload SRS có sẵn/);
    const fpt = radio(/Chưa có template/);
    expect(upload).toHaveAttribute("tabindex", "0");
    expect(fpt).toHaveAttribute("tabindex", "-1");

    fireEvent.keyDown(upload, { key: "ArrowRight" });
    expect(fpt).toHaveAttribute("aria-checked", "true");
    expect(fpt).toHaveFocus();
    expect(fpt).toHaveAttribute("tabindex", "0");

    fireEvent.keyDown(fpt, { key: "ArrowRight" });
    expect(upload).toHaveAttribute("aria-checked", "true");
    fireEvent.keyDown(upload, { key: "ArrowLeft" });
    expect(fpt).toHaveAttribute("aria-checked", "true");
  });
});
