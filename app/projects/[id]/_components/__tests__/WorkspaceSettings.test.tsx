import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import AiSettingsMenu from "../AiSettingsMenu";
import NamesGlossaryPanel from "../NamesGlossaryPanel";
import type { Spine } from "@/types/spine";

describe("AiSettingsMenu (ô chat)", () => {
  it("chip hiện cách làm việc; mở ra đổi được cả cách làm việc lẫn lúc AI dừng chờ duyệt", () => {
    const onWorking = vi.fn();
    const onReview = vi.fn();
    render(<AiSettingsMenu workingMode="coaching" onChangeWorkingMode={onWorking} reviewMode="balanced" onChangeReviewMode={onReview} />);

    const trigger = screen.getByRole("button", { name: /Kèm cặp/ });
    expect(screen.queryByRole("dialog")).toBeNull();
    fireEvent.click(trigger);

    const dialog = screen.getByRole("dialog", { name: "Cách AI làm việc với bạn" });
    expect(dialog).toHaveTextContent("Dừng cuối giai đoạn");
    fireEvent.click(screen.getByRole("radio", { name: "Nhanh" }));
    fireEvent.click(screen.getByRole("radio", { name: "Khi cần" }));
    expect(onWorking).toHaveBeenCalledWith("fast");
    expect(onReview).toHaveBeenCalledWith("fast");

    // Esc đóng
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});

describe("NamesGlossaryPanel", () => {
  const spine = {
    actors: [
      { id: "A01", name: "Founder" },
      { id: "A02", name: "Dispatcher" },
    ],
    entities: [],
    screens: [],
    glossary: [{ id: "G01", term: "COD", definition: "Cash on delivery" }],
  } as unknown as Pick<Spine, "actors" | "entities" | "screens" | "glossary">;

  it("danh sách chỉ đọc, không lộ mã; bấm tên để sửa tại chỗ, Enter lưu đúng một op", async () => {
    const onSubmitOps = vi.fn();
    render(<NamesGlossaryPanel spine={spine} onSubmitOps={onSubmitOps} />);

    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.queryByText("A01")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Dispatcher/ }));
    const input = screen.getByRole("textbox", { name: "Tên mới cho Dispatcher" });
    fireEvent.change(input, { target: { value: " Điều phối viên " } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(onSubmitOps).toHaveBeenCalledWith([{ op: "set", path: "actors[id=A02].name", value: "Điều phối viên", reason: "Panel Tên riêng" }]);
  });

  it("Esc huỷ, không gửi gì; tab Thuật ngữ có định nghĩa và thêm thuật ngữ mới", () => {
    const onSubmitOps = vi.fn();
    render(<NamesGlossaryPanel spine={spine} onSubmitOps={onSubmitOps} />);

    fireEvent.click(screen.getByRole("button", { name: /Founder/ }));
    fireEvent.keyDown(screen.getByRole("textbox"), { key: "Escape" });
    expect(onSubmitOps).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("tab", { name: /Thuật ngữ/ }));
    expect(screen.getByText("Cash on delivery")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "+ Thêm thuật ngữ" }));
    fireEvent.change(screen.getByPlaceholderText("Thuật ngữ mới"), { target: { value: "SLA" } });
    fireEvent.click(screen.getByRole("button", { name: "Thêm" }));
    expect(onSubmitOps).toHaveBeenCalledWith([
      { op: "add", path: "glossary[]", value: { id: "G02", term: "SLA", definition: "" }, reason: "Panel Tên riêng" },
    ]);
  });
});
