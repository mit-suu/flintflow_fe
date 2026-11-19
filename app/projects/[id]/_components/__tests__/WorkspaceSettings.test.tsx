import { describe, expect, it, vi } from "vitest";
import { fireEvent, screen } from "@testing-library/react";
import { renderWithIntl as render } from "@/test/intl";
import AiSettingsMenu from "../AiSettingsMenu";
import NamesGlossaryPanel from "../NamesGlossaryPanel";
import type { Spine } from "@/types/spine";

describe("AiSettingsMenu (ô chat)", () => {
  it("chip hiện chế độ duyệt; 3 mức (FLF-337), balanced cũ hiện là Cuối giai đoạn; chọn Chỉ ở mốc chốt", () => {
    const onReview = vi.fn();
    render(<AiSettingsMenu reviewMode="balanced" onChangeReviewMode={onReview} />);

    const trigger = screen.getByRole("button", { name: /Cuối giai đoạn/ });
    expect(screen.queryByRole("dialog")).toBeNull();
    fireEvent.click(trigger);

    const dialog = screen.getByRole("dialog", { name: "Cách AI làm việc với bạn" });
    expect(dialog).not.toHaveTextContent("Kèm cặp");
    expect(screen.getAllByRole("radio")).toHaveLength(3);
    expect(screen.getByRole("radio", { name: "Cuối giai đoạn" })).toHaveAttribute("aria-checked", "true");
    expect(dialog).toHaveTextContent(/không phụ thuộc độ tự tin của AI/);
    fireEvent.click(screen.getByRole("radio", { name: "Mọi bước" }));
    expect(onReview).toHaveBeenCalledWith("strict");
    fireEvent.click(screen.getByRole("radio", { name: "Chỉ ở mốc chốt" }));
    expect(onReview).toHaveBeenCalledWith("milestones");

    // Esc đóng
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("FLF-337: mức Chỉ ở mốc chốt hiện đúng chip; danh sách phần đã tắt hỏi có nút Hỏi lại", () => {
    const onRestore = vi.fn();
    render(<AiSettingsMenu reviewMode="milestones" onChangeReviewMode={vi.fn()} skipSections={[{ id: "fixed:5", title: "5 Glossary" }]} onRestoreSection={onRestore} />);
    fireEvent.click(screen.getByRole("button", { name: /Chỉ ở mốc chốt/ }));
    expect(screen.getByRole("radio", { name: "Chỉ ở mốc chốt" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByText("5 Glossary")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Hỏi lại" }));
    expect(onRestore).toHaveBeenCalledWith("fixed:5");
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

  it("danh sách chỉ đọc, không lộ mã; Sửa qua chat điền sẵn lệnh đổi tên, không có ô sửa", () => {
    const onEditByChat = vi.fn();
    render(<NamesGlossaryPanel spine={spine} onEditByChat={onEditByChat} />);

    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.queryByText("A01")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Sửa tên Dispatcher qua chat" }));
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(onEditByChat).toHaveBeenCalledWith('Đổi tên "Dispatcher" thành ');
  });

  it("tab Thuật ngữ có định nghĩa; thêm thuật ngữ cũng qua chat; Viewer không có nút", () => {
    const onEditByChat = vi.fn();
    const { unmount } = render(<NamesGlossaryPanel spine={spine} onEditByChat={onEditByChat} />);

    fireEvent.click(screen.getByRole("tab", { name: /Thuật ngữ/ }));
    expect(screen.getByText("Cash on delivery")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "+ Thêm thuật ngữ qua chat" }));
    expect(onEditByChat).toHaveBeenCalledWith("Thêm thuật ngữ mới vào bảng thuật ngữ: ");
    unmount();

    render(<NamesGlossaryPanel spine={spine} />);
    expect(screen.queryByRole("button", { name: /qua chat/ })).toBeNull();
  });
});
