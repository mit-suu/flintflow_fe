import { describe, expect, it } from "vitest";
import { renderWithIntl } from "@/test/intl";
import ChatBubble from "../ChatBubble";

const ai = (content: string) => ({ role: "ai" as const, content, createdAt: "2026-09-30T00:00:00Z" });

describe("ChatBubble lời AI chứa HTML", () => {
  it("hiện thẻ HTML thành chữ, không chèn phần tử vào trang", () => {
    const { container } = renderWithIntl(
      <ChatBubble message={ai('Xem <img src=x onerror="alert(1)"> nhé\n- mục <script>x</script>')} messageIndex={0} />
    );
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("script")).toBeNull();
    expect(container.textContent).toContain('<img src=x onerror="alert(1)">');
  });

  it("vẫn in đậm **chữ** ở đoạn văn và gạch đầu dòng", () => {
    const { container } = renderWithIntl(<ChatBubble message={ai("Có **hai** ý\n- **một** <b>thô</b>")} messageIndex={0} />);
    const strong = [...container.querySelectorAll("strong")].map((el) => el.textContent);
    expect(strong).toEqual(["hai", "một"]);
    expect(container.querySelector("b")).toBeNull();
  });
});
