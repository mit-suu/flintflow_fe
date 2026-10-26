import { fireEvent, screen } from "@testing-library/react";
import { createTranslator } from "next-intl";
import { MESSAGES, renderWithIntl } from "@/test/intl";
import { describe, expect, it, vi } from "vitest";
import DecisionsPanel, { topicLabel } from "../DecisionsPanel";
import { stepDividers } from "../ChatPane";
import { writeBadgeOf } from "../ChatBubble";
import type { Decision, Spine } from "@/types/spine";

describe("DecisionsPanel — tab Đã chốt (R4)", () => {
  const decision = (over: Partial<Decision> = {}): Decision => ({
    id: "DC01",
    topic_key: "uptime",
    question: "Uptime?",
    answer: "99%",
    step_id: "S-1.4",
    at: "2026-09-22T10:00:00.000Z",
    superseded_by: null,
    ...over,
  });
  const spineWith = (decisions: Decision[]): Spine => ({ decisions } as unknown as Spine);

  it("chỉ hiện quyết định còn hiệu lực, sửa được tại chỗ", () => {
    const onSubmitOps = vi.fn();
    renderWithIntl(
      <DecisionsPanel spine={spineWith([decision(), decision({ id: "DC02", topic_key: "deposit_amount", superseded_by: "DC03" })])} onSubmitOps={onSubmitOps} />
    );
    expect(screen.getByText("Uptime")).toBeInTheDocument();
    expect(screen.queryByText("Tiền cọc")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Sửa" }));
    fireEvent.change(screen.getByLabelText("Sửa quyết định Uptime"), { target: { value: "99.9%" } });
    fireEvent.click(screen.getByRole("button", { name: "Lưu" }));
    expect(onSubmitOps).toHaveBeenCalledWith([expect.objectContaining({ path: "decisions[id=DC01].answer", value: "99.9%" })]);
  });

  it("chưa chốt gì thì nói thẳng, không hiện bảng rỗng", () => {
    renderWithIntl(<DecisionsPanel spine={spineWith([])} onSubmitOps={vi.fn()} />);
    expect(screen.getByText("Chưa có quyết định nào được chốt.")).toBeInTheDocument();
    const t = createTranslator({ locale: "vi", messages: MESSAGES.vi, namespace: "workspace.decisions" });
    expect(topicLabel("slot_hold_minutes", t)).toBe("Giữ chỗ (phút)");
    expect(topicLabel("chu_de_tu_do", t)).toBe("chu de tu do");
  });
});

describe("Chat — phân đoạn theo bước và nhãn ghi (BUG-24, BUG-09)", () => {
  it("chèn dấu phân đoạn mỗi khi đổi bước", () => {
    const messages = [
      { role: "user" as const, content: "a", step: "S-5.4@S04", createdAt: "" },
      { role: "ai" as const, content: "b", step: "S-5.4@S04", createdAt: "" },
      { role: "user" as const, content: "c", step: "S-5.3@S05", createdAt: "" },
    ];
    expect(stepDividers(messages)).toEqual([1, null, 1]);
  });

  it("tin nhắn AI thường là “Chỉ trao đổi”; bản xem trước nói rõ chờ xác nhận", () => {
    expect(writeBadgeOf({ role: "user", content: "x", createdAt: "" })).toBeNull();
    expect(writeBadgeOf({ role: "ai", content: "Tôi sẽ bổ sung UC18", createdAt: "" })).toMatchObject({ key: "chatOnly", wrote: false });
    const preview = JSON.stringify({ kind: "change_preview", changes: [{}, {}] });
    expect(writeBadgeOf({ role: "ai", content: preview, createdAt: "" })).toMatchObject({ key: "pending", count: 2 });
    // FLF-318: bản xem trước đã thành change request ⇒ không còn "Chờ bạn xác nhận"
    const sentAsCr = JSON.stringify({ kind: "change_cr", reply: "Đã tạo CR-001 từ bản xem trước này (27 thay đổi)", cr_id: "CR-001", change_count: 27 });
    expect(writeBadgeOf({ role: "ai", content: sentAsCr, createdAt: "" })).toEqual({ key: "crCreated", count: 27, crId: "CR-001", wrote: false });
    const tBadge = createTranslator({ locale: "vi", messages: MESSAGES.vi, namespace: "workspace.chatBubble.badge" });
    expect(tBadge("crCreated", { crId: "CR-001", count: 27 })).toBe("Đã tạo CR-001 (27 thay đổi)");
    // FLF-300: bản xem trước lỗi (0 thay đổi) không có gì để xác nhận
    const failed = JSON.stringify({ kind: "change_preview", reply: "…", change_count: 0 });
    expect(writeBadgeOf({ role: "ai", content: failed, createdAt: "" })).toMatchObject({ key: "nothingWritten", wrote: false });
  });
});
