/**
 * FLF-279 — lượt hỏi tri thức không được lẫn với lượt hỏi của bước.
 *
 * `replyOfAsk` nuôi `trailingAskReply`, và `trailingAskReply !== null` bật `hideTrailingAiMessage` ⇒
 * `ChatPane` cắt tin AI cuối khỏi khung chat (nó giả định tin đó đã được gộp vào bong bóng câu hỏi).
 * Tin tri thức cũng mang `reply: string`, nên nhận lầm thì câu trả lời tri thức biến mất hẳn ở đúng
 * lúc hay dùng nhất: step đang chờ trả lời, user không biết trả lời nên đi hỏi kiến thức.
 */
import { describe, expect, it, vi } from "vitest";
import { replyOfAsk } from "./page";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useParams: () => ({ id: "650000000000000000000001" }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/projects/650000000000000000000001",
}));

const knowledgeMessage = (over: Record<string, unknown> = {}) =>
  JSON.stringify({
    reply: "Mỗi bước tối đa 8 lượt gọi model [K1].",
    questions: [],
    grounded: true,
    citations: [{ ref: "K1", chunk_id: "gate-check#caps", source: "gate-check", section: "Caps", source_kind: "internal_skill" }],
    ...over,
  });

describe("replyOfAsk", () => {
  it("tin tri thức ⇒ null, nên nó KHÔNG bị cắt khỏi khung chat", () => {
    expect(replyOfAsk(knowledgeMessage())).toBeNull();
    expect(replyOfAsk(knowledgeMessage({ grounded: false, citations: [], reply: "Không đủ căn cứ…" }))).toBeNull();
  });

  it("lời đáp của lượt hỏi của bước ⇒ vẫn trả reply như trước", () => {
    const ask = JSON.stringify({ reply: "Mình cần biết phạm vi thiết bị.", questions: [{ question: "Có mobile không?" }] });
    expect(replyOfAsk(ask)).toBe("Mình cần biết phạm vi thiết bị.");
  });

  it("tin chữ thuần và JSON không có reply ⇒ giữ hành vi cũ", () => {
    expect(replyOfAsk("chữ thuần")).toBe("chữ thuần");
    expect(replyOfAsk("{hỏng")).toBe("{hỏng");
    expect(replyOfAsk(JSON.stringify({ kind: "change_applied", count: 2 }))).toBe('{"kind":"change_applied","count":2}');
  });
});
