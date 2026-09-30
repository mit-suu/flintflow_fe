import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import ChatBubble from "../ChatBubble";

const user = (content: string) => ({ role: "user" as const, content, createdAt: "2026-09-30T00:00:00Z" });

describe("ChatBubble tin user cũ", () => {
  it("bỏ tiền tố 'Yêu cầu sửa: ' khi đọc lại lịch sử", () => {
    render(<ChatBubble message={user("Yêu cầu sửa: à không, cả web và app")} messageIndex={0} />);
    expect(screen.getByText("à không, cả web và app")).toBeTruthy();
    expect(screen.queryByText(/Yêu cầu sửa/)).toBeNull();
  });
  it("'Duyệt, sang bước tiếp' hiện là 'Đúng rồi, đi tiếp'", () => {
    render(<ChatBubble message={user("Duyệt, sang bước tiếp")} messageIndex={0} />);
    expect(screen.getByText("Đúng rồi, đi tiếp")).toBeTruthy();
  });
});
