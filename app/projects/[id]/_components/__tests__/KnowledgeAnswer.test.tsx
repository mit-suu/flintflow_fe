import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import KnowledgeAnswer from "../KnowledgeAnswer";
import ChatBubble, { writeBadgeOf } from "../ChatBubble";
import type { ChatMessage, KnowledgeCitation } from "@/types/chat";

const K1: KnowledgeCitation = {
  ref: "K1",
  chunk_id: "gate-check#caps",
  source: "gate-check",
  section: "Caps",
  source_kind: "internal_skill",
};
const K2: KnowledgeCitation = {
  ref: "K2",
  chunk_id: "ieee-830#4.3",
  source: "IEEE 830-1998",
  section: "4.3 Specific requirements",
  source_kind: "standard",
};

describe("KnowledgeAnswer — có trích dẫn", () => {
  it("mỗi nhãn thành một nút bấm được; bấm ra source, section và nhãn loại nguồn", () => {
    render(<KnowledgeAnswer reply="Trần 8 lượt [K1], theo chuẩn [K2]." grounded citations={[K1, K2]} />);

    const chip = screen.getByRole("button", { name: /Nguồn K1: gate-check · Caps/ });
    expect(chip).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(chip);
    expect(chip).toHaveAttribute("aria-expanded", "true");
    const note = screen.getByRole("note");
    expect(note).toHaveTextContent("gate-check");
    expect(note).toHaveTextContent("Caps");
    expect(note).toHaveTextContent("Hướng dẫn nội bộ FlintFlow");
    expect(note).toHaveTextContent("gate-check#caps");
  });

  it("source_kind standard hiện nhãn chuẩn ngoài", () => {
    render(<KnowledgeAnswer reply="Theo [K2]." grounded citations={[K2]} />);

    fireEvent.click(screen.getByRole("button", { name: /Nguồn K2/ }));
    expect(screen.getByRole("note")).toHaveTextContent("Chuẩn ngoài");
  });

  it("Escape đóng ô chi tiết", () => {
    render(<KnowledgeAnswer reply="Trần 8 lượt [K1]." grounded citations={[K1]} />);

    fireEvent.click(screen.getByRole("button", { name: /Nguồn K1/ }));
    expect(screen.getByRole("note")).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("note")).not.toBeInTheDocument();
  });

  it("nhãn không có trích dẫn khớp hiện nguyên chữ, không thành nút", () => {
    render(<KnowledgeAnswer reply="Có [K1] và [K9]." grounded citations={[K1]} />);

    expect(screen.getByRole("button", { name: /Nguồn K1/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Nguồn K9/ })).not.toBeInTheDocument();
    expect(screen.getByText(/\[K9\]/)).toBeInTheDocument();
  });

  it("liệt kê nguồn ở dưới để thấy được dù không bấm chip nào", () => {
    render(<KnowledgeAnswer reply="Không có nhãn nào." grounded citations={[K1]} />);
    expect(screen.getByText(/Nguồn: gate-check · Caps/)).toBeInTheDocument();
  });
});

describe("KnowledgeAnswer — không đủ căn cứ", () => {
  const refusal = "Không đủ căn cứ trong kho tri thức của FlintFlow để trả lời câu này.";

  it("hiện khối Không đủ căn cứ, không phải tin lỗi hệ thống", () => {
    const { container } = render(<KnowledgeAnswer reply={refusal} grounded={false} citations={[]} />);

    expect(screen.getByText("Không đủ căn cứ")).toBeInTheDocument();
    expect(screen.getByText(refusal)).toBeInTheDocument();
    // Tông cảnh báo (vàng), không phải tông lỗi (đỏ) — đỏ dành cho sự cố thật
    expect(container.querySelector(".bg-accent-gold-soft")).toBeTruthy();
    expect(container.querySelector(".bg-error-container")).toBeNull();
    // Không chip, không dòng liệt kê nguồn
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.queryByText(/^Nguồn:/)).not.toBeInTheDocument();
  });
});

describe("ChatBubble — tin tri thức", () => {
  const aiMessage = (data: object): ChatMessage => ({
    role: "ai",
    content: JSON.stringify(data),
    createdAt: "2026-10-17T10:00:00Z",
  });

  const grounded = { reply: "Trần 8 lượt [K1].", questions: [], grounded: true, citations: [K1] };
  const ungrounded = { reply: "Không đủ căn cứ…", questions: [], grounded: false, citations: [] };

  it("render nhánh tri thức với chip bấm được (tin lưu dạng JSON ⇒ tải lại trang vẫn đúng)", () => {
    render(<ChatBubble message={aiMessage(grounded)} />);

    expect(screen.getByRole("button", { name: /Nguồn K1: gate-check · Caps/ })).toBeInTheDocument();
  });

  it("nhãn nói rõ đã tra kho tri thức, và không bao giờ nói là đã ghi", () => {
    expect(writeBadgeOf(aiMessage(grounded))).toEqual({ text: "Trả lời từ kho tri thức", wrote: false });
    expect(writeBadgeOf(aiMessage(ungrounded))).toEqual({ text: "Không đủ căn cứ", wrote: false });
  });

  it("không đổi hành vi của tin chat thường và tin lượt hỏi của bước", () => {
    // Tin chat thường: vẫn "Chỉ trao đổi"
    expect(writeBadgeOf(aiMessage({ reply: "Chào bạn", questions: [] }))).toEqual(null);
    expect(writeBadgeOf({ role: "ai", content: "chữ thuần", createdAt: "x" })).toEqual({
      text: "Chỉ trao đổi",
      wrote: false,
    });
    // Tin áp thay đổi: vẫn nói đã ghi
    expect(writeBadgeOf(aiMessage({ kind: "change_applied", count: 3 }))).toEqual({
      text: "Đã ghi 3 thay đổi",
      wrote: true,
    });
  });
});
