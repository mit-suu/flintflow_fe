import { fireEvent, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderWithIntl } from "@/test/intl";
import ProjectStartPicker from "./ProjectStartPicker";

describe("ProjectStartPicker (FLF-335 — Dự án mới / Dự án có sẵn, không chọn chế độ)", () => {
  it("hai thẻ, chưa chọn gì; chọn Dự án mới ⇒ hỏi mẫu bắt buộc; chọn Dự án có sẵn ⇒ gợi ý hỏi ý định lúc upload", () => {
    const onChange = vi.fn();
    const { rerender } = renderWithIntl(<ProjectStartPicker value={null} onChange={onChange} hasRequiredTemplate={null} onHasRequiredTemplateChange={vi.fn()} />);
    const group = screen.getByRole("radiogroup", { name: "Bạn bắt đầu từ đâu?" });
    expect(within(group).getAllByRole("radio")).toHaveLength(2);
    expect(screen.queryByText(/chế độ/i)).toBeNull();
    expect(screen.queryByRole("radiogroup", { name: /mẫu bắt buộc/ })).toBeNull();

    fireEvent.click(screen.getByRole("radio", { name: /Dự án mới/ }));
    expect(onChange).toHaveBeenCalledWith("new");

    rerender(<ProjectStartPicker value="new" onChange={onChange} hasRequiredTemplate={null} onHasRequiredTemplateChange={vi.fn()} />);
    expect(screen.getByRole("radiogroup", { name: /Khách có bắt buộc theo một mẫu không/ })).toBeInTheDocument();

    rerender(<ProjectStartPicker value="existing" onChange={onChange} hasRequiredTemplate={null} onHasRequiredTemplateChange={vi.fn()} />);
    expect(screen.queryByRole("radiogroup", { name: /mẫu không/ })).toBeNull();
    expect(screen.getByText(/hỏi file theo một mẫu cố định hay cấu trúc tự do/)).toBeInTheDocument();
  });

  it("câu hỏi mẫu bắt buộc: Có ⇒ nói sẽ tải mẫu; Không ⇒ nói dùng mẫu chuẩn FlintFlow", () => {
    const onAnswer = vi.fn();
    const { rerender } = renderWithIntl(<ProjectStartPicker value="new" onChange={vi.fn()} hasRequiredTemplate={null} onHasRequiredTemplateChange={onAnswer} />);
    fireEvent.click(screen.getByRole("radio", { name: "Có" }));
    expect(onAnswer).toHaveBeenCalledWith(true);
    rerender(<ProjectStartPicker value="new" onChange={vi.fn()} hasRequiredTemplate onHasRequiredTemplateChange={onAnswer} />);
    expect(screen.getByText(/tải file mẫu/)).toBeInTheDocument();
    rerender(<ProjectStartPicker value="new" onChange={vi.fn()} hasRequiredTemplate={false} onHasRequiredTemplateChange={onAnswer} />);
    expect(screen.getByText(/Soạn theo mẫu chuẩn FlintFlow/)).toBeInTheDocument();
    expect(screen.queryByText(/FPT/)).toBeNull();
  });

  it("phím mũi tên đổi thẻ, roving tabindex", () => {
    const onChange = vi.fn();
    renderWithIntl(<ProjectStartPicker value="new" onChange={onChange} hasRequiredTemplate={null} onHasRequiredTemplateChange={vi.fn()} />);
    const first = screen.getByRole("radio", { name: /Dự án mới/ });
    expect(first).toHaveAttribute("tabindex", "0");
    expect(screen.getByRole("radio", { name: /Dự án có sẵn/ })).toHaveAttribute("tabindex", "-1");
    fireEvent.keyDown(first, { key: "ArrowRight" });
    expect(onChange).toHaveBeenCalledWith("existing");
  });
});
