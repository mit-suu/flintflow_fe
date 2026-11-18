import { describe, expect, it } from "vitest";
import { CHOICES, executeChoice, type ChoiceTarget } from "../resolve-queue-actions";
import { makeHandlers } from "./resolve-queue-harness";

const target = (over: Partial<ChoiceTarget>): ChoiceTarget => ({ kind: "assumption", entityId: "AS01", flagIds: [], prefill: "sửa đi", ...over });
const NOW = () => "2026-11-18T00:00:00.000Z";

describe("executeChoice", () => {
  it("giả định Đúng / Không đúng ghi op status kèm confirmed_at (null khi bác bỏ)", async () => {
    const h = makeHandlers();
    await executeChoice(target({}), "right", "", h, NOW);
    await executeChoice(target({}), "wrong", "", h, NOW);
    expect(h.submitOps.mock.calls[0][0]).toEqual([
      expect.objectContaining({ path: "assumptions[id=AS01].status", value: "confirmed" }),
      expect.objectContaining({ path: "assumptions[id=AS01].confirmed_at", value: "2026-11-18T00:00:00.000Z" }),
    ]);
    expect(h.submitOps.mock.calls[1][0][1]).toMatchObject({ value: null });
  });

  it("giả định Muốn khác trống chữ ⇒ không gọi gì; có chữ ⇒ applyAssumptionDecision edit", async () => {
    const h = makeHandlers();
    expect(await executeChoice(target({}), "other", "   ", h)).toEqual({ status: "failed" });
    expect(h.decideAssumption).not.toHaveBeenCalled();
    expect(await executeChoice(target({}), "other", " đúng là X ", h)).toEqual({ status: "done" });
    expect(h.decideAssumption).toHaveBeenCalledWith({ kind: "edit", id: "AS01", statement: "đúng là X" });
  });

  it("ghi chú Muốn khác ⇒ op set content, không qua AI", async () => {
    const h = makeHandlers();
    await executeChoice(target({ kind: "brief_note", entityId: "AD01" }), "other", "nội dung mới", h);
    expect(h.submitOps).toHaveBeenCalledWith([
      expect.objectContaining({ op: "set", path: "addendum[id=AD01].content", value: "nội dung mới" }),
      expect.objectContaining({ op: "set", path: "addendum[id=AD01].content_en", value: "nội dung mới" })
    ]);
    expect(h.decideAssumption).not.toHaveBeenCalled();
  });

  it("ghi chú Giữ và màn Đặc tả chỉ đánh dấu đã xem, không ghi", async () => {
    const h = makeHandlers();
    expect(await executeChoice(target({ kind: "brief_note" }), "keep", "", h)).toEqual({ status: "done", markSeen: true });
    expect(await executeChoice(target({ kind: "screen" }), "detail", "", h)).toEqual({ status: "done", markSeen: true });
    expect(h.submitOps).not.toHaveBeenCalled();
    expect(h.markPlaceholder).not.toHaveBeenCalled();
  });

  it("ghi lỗi (false) hoặc handler ném ⇒ failed, không ném ra ngoài", async () => {
    const h = makeHandlers();
    h.submitOps.mockResolvedValueOnce(false);
    expect(await executeChoice(target({}), "right", "", h)).toEqual({ status: "failed" });
    h.markPlaceholder.mockRejectedValueOnce(new Error("Mất mạng"));
    expect((await executeChoice(target({ kind: "screen", entityId: "S01" }), "later", "", h)).status).toBe("failed");
  });

  it("cờ đỏ Giữ nguyên với lý do ngắn hơn 20 ký tự bị chặn ngay ở lớp hành động", async () => {
    const h = makeHandlers();
    const t = target({ kind: "flag_red", flagIds: ["FR1"] });
    expect(await executeChoice(t, "keep", "quá ngắn", h)).toEqual({ status: "failed" });
    expect(h.keepFlag).not.toHaveBeenCalled();
    expect(await executeChoice(t, "keep", "Lý do này đủ hai mươi ký tự", h)).toEqual({ status: "done" });
    expect(h.keepFlag).toHaveBeenCalledWith("FR1", "Lý do này đủ hai mươi ký tự");
  });

  it("Sửa trong chat: handoff khi mở được, failed khi ô chat đang bị khoá", async () => {
    const h = makeHandlers();
    const t = target({ kind: "flag_red", flagIds: ["FR1"] });
    expect(await executeChoice(t, "chat", "", h)).toEqual({ status: "handoff" });
    expect(h.startEditing).toHaveBeenCalledWith("sửa đi");
    h.startEditing.mockReturnValueOnce(false);
    expect(await executeChoice(t, "chat", "", h)).toEqual({ status: "failed" });
  });

  it("nhóm vàng: waive tuần tự theo thứ tự, dừng ở lỗi đầu tiên và báo số đã bỏ qua", async () => {
    const h = makeHandlers();
    h.waiveFlag.mockResolvedValueOnce(undefined).mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error("409"));
    const out = await executeChoice(target({ kind: "flag_yellow_group", flagIds: ["A", "B", "C", "D"] }), "waive", "Chấp nhận rủi ro vì phạm vi MVP", h);
    expect(out).toMatchObject({ status: "partial", done: 2, total: 4 });
    expect(h.waiveFlag.mock.calls.map((c) => c[0])).toEqual(["A", "B", "C"]);
  });

  it("nhóm vàng: AI bắt đầu chạy giữa chuỗi ⇒ dừng trước lần ghi kế, báo số đã bỏ qua", async () => {
    const h = makeHandlers();
    h.isLocked.mockReturnValueOnce(false).mockReturnValueOnce(true);
    const out = await executeChoice(target({ kind: "flag_yellow_group", flagIds: ["A", "B", "C"] }), "waive", "Chấp nhận rủi ro vì phạm vi MVP", h);
    expect(out).toMatchObject({ status: "partial", done: 1, total: 3, stoppedByAi: true });
    expect(h.waiveFlag.mock.calls.map((c) => c[0])).toEqual(["A"]);
  });

  it("mỗi loại việc có lựa chọn đúng bảng đặc tả, chỉ thao tác gọi AI mới mang credit", () => {
    const shape = (kind: keyof typeof CHOICES) => CHOICES[kind].map((c) => `${c.id}${c.credit ? `:${c.credit}` : ""}`);
    // Sửa giả định = một lượt dịch (BE tính `translate`), không phải giá chat
    expect(shape("assumption")).toEqual(["right", "wrong", "other:translate"]);
    expect(shape("brief_note")).toEqual(["keep", "drop", "other"]);
    expect(shape("screen")).toEqual(["detail", "later"]);
    expect(shape("flag_red")).toEqual(["chat:change_instruction", "keep"]);
    expect(shape("flag_yellow_group")).toEqual(["chat:change_instruction", "waive"]);
  });
});
