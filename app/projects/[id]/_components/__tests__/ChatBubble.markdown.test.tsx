import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import ChatBubble from "../ChatBubble";

const ai = (reply: string) => ({ role: "ai" as const, content: JSON.stringify({ reply, questions: [] }), createdAt: "2026-10-18T00:00:00Z" });

describe("ChatBubble hiển thị lời AI", () => {
  it("chữ trong ngoặc nhọn hiện nguyên văn, không bị trình duyệt nuốt thành thẻ HTML", () => {
    const { container } = render(<ChatBubble message={ai("Nhập <tên màn hình> rồi bấm **Lưu**")} hideBadge />);
    expect(container.textContent).toContain("Nhập <tên màn hình> rồi bấm Lưu");
    expect(container.querySelector("strong")?.textContent).toBe("Lưu");
  });

  it("không chạy HTML/script trong lời AI", () => {
    const { container } = render(<ChatBubble message={ai('<img src=x onerror="alert(1)">')} hideBadge />);
    expect(container.querySelector("img")).toBeNull();
    expect(container.textContent).toContain('<img src=x onerror="alert(1)">');
  });

  it("tiêu đề markdown không lòi dấu #, gạch đầu dòng thụt lề vẫn là một mục danh sách", () => {
    const { container } = render(<ChatBubble message={ai("### Phạm vi\n  - Lễ tân xác nhận lịch")} hideBadge />);
    expect(container.textContent).not.toContain("#");
    expect(screen.getByText("Phạm vi").tagName).toBe("STRONG");
    expect(container.querySelector("li")?.textContent).toBe("Lễ tân xác nhận lịch");
  });
});
