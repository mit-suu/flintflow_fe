/**
 * FLF-400: lệnh gửi vào CR đang mở (chip "Sửa tài liệu" ở mode 1) — bấm Gửi / Enter hai lần liền chỉ được gửi một lần.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { act, waitFor } from "@testing-library/react";
import { renderHookWithIntl } from "@/test/intl";
import type { CrDetail } from "@/types/change-request";
import { useCrChat } from "./useCrChat";

const api = vi.hoisted(() => ({ listCrs: vi.fn(), getCr: vi.fn(), sendCrMessage: vi.fn(), answerClarifications: vi.fn(), cancelCr: vi.fn(), runCrAction: vi.fn(), createCr: vi.fn() }));

vi.mock("@/lib/api/change-requests", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  listCrs: api.listCrs,
  getCr: api.getCr,
  sendCrMessage: api.sendCrMessage,
  answerClarifications: api.answerClarifications,
  cancelCr: api.cancelCr,
  runCrAction: api.runCrAction,
  createCr: api.createCr,
}));

const detail = {
  change_request: { cr_id: "CR-001", status: "draft", paused: null, amendments: [], clarifications: [], materials: [] },
  locations: [],
  groups: [],
  pending_questions: [],
} as unknown as CrDetail;

beforeEach(() => {
  api.listCrs.mockReset().mockResolvedValue({ data: [{ cr_id: "CR-001", status: "draft", created_by: "u1" }] });
  api.getCr.mockReset().mockResolvedValue({ data: detail });
  api.sendCrMessage.mockReset().mockResolvedValue({ data: { ...detail, message: { kind: "answer", reply: "Không vẽ lại hình." } } });
});

describe("useCrChat - gửi lặp (FLF-400)", () => {
  it("send gọi 2 lần trong cùng một tick ⇒ sendCrMessage chỉ gọi 1 lần; xong thì gửi tiếp được", async () => {
    const { result } = renderHookWithIntl(() => useCrChat("p1", true, undefined, "u1"));
    await waitFor(() => expect(result.current.detail).not.toBeNull());

    await act(async () => {
      await Promise.all([result.current.send("không vẽ lại hình à?"), result.current.send("không vẽ lại hình à?")]);
    });
    expect(api.sendCrMessage).toHaveBeenCalledTimes(1);

    await act(async () => result.current.send("còn mục 3.2 thì sao?"));
    expect(api.sendCrMessage).toHaveBeenCalledTimes(2);
  });
});

describe("useCrChat - trả lời câu làm rõ ⇒ tự chạy tiếp đề xuất (P08, CR #6)", () => {
  const withStatus = (status: string, locations: unknown[] = []) =>
    ({ ...detail, change_request: { ...detail.change_request, status }, locations, pending_questions: status === "awaiting_answers" ? ["Giữ bản nào?"] : [] }) as unknown as CrDetail;
  const loc = { location_id: "L001", section_id: "fixed:2.2", path: "use_cases[id=UC09]", conclusion: null, proposal: null, verify: null, manual: false, found_by: ["keyword"] };

  it("answers ⇒ impact ⇒ propose, không dừng ở 'Tiếp tục - AI đề xuất sửa'", async () => {
    api.listCrs.mockResolvedValue({ data: [{ cr_id: "CR-001", status: "awaiting_answers", created_by: "u1" }] });
    api.getCr.mockResolvedValue({ data: withStatus("awaiting_answers") });
    api.answerClarifications.mockResolvedValue({ data: withStatus("impact_review") });
    api.runCrAction.mockImplementation(async (_p: string, _id: string, action: string) =>
      action === "impact" ? { data: withStatus("impact_review", [loc]) } : { data: withStatus("proposing", [{ ...loc, conclusion: "not_related" }]) }
    );
    const { result } = renderHookWithIntl(() => useCrChat("p-answer", true, undefined, "u1"));
    await waitFor(() => expect(result.current.detail?.change_request.status).toBe("awaiting_answers"));

    await act(async () => {
      result.current.answer(["Giữ bản của Huy"]);
    });
    await waitFor(() => expect(api.runCrAction.mock.calls.map((c) => c[2])).toEqual(expect.arrayContaining(["impact", "propose"])));
  });
});

const asking = {
  ...detail,
  change_request: { ...detail.change_request, status: "awaiting_answers", clarifications: [{ round: 1, questions: ["Màn nào?"], answers: [], suggestions: [[]] }] },
  pending_questions: ["Màn nào?"],
} as unknown as CrDetail;

describe("useCrChat - trả lời làm rõ là lời rút lại (FLF-439)", () => {
  beforeEach(() => {
    api.listCrs.mockResolvedValue({ data: [{ cr_id: "CR-001", status: "awaiting_answers", created_by: "u1" }] });
    api.getCr.mockResolvedValue({ data: asking });
    api.answerClarifications.mockReset().mockResolvedValue({ data: asking });
    api.cancelCr.mockReset().mockResolvedValue({ data: { ...asking, change_request: { ...asking.change_request, status: "cancelled" } } });
    api.runCrAction.mockReset().mockResolvedValue({ data: asking });
  });

  it("'không đổi nữa' ⇒ chưa gửi câu trả lời, hỏi huỷ CR; Huỷ ⇒ cancelCr kèm lý do là câu đã gõ", async () => {
    const { result } = renderHookWithIntl(() => useCrChat("p1", true, undefined, "u1"));
    await waitFor(() => expect(result.current.detail).not.toBeNull());

    await act(async () => result.current.send("không đổi nữa"));
    expect(api.answerClarifications).not.toHaveBeenCalled();
    expect(result.current.withdrawAsk).toEqual(["không đổi nữa"]);

    await act(async () => result.current.confirmWithdraw());
    await waitFor(() => expect(api.cancelCr).toHaveBeenCalledWith("p1", "CR-001", expect.stringContaining("không đổi nữa")));
    await waitFor(() => expect(result.current.withdrawAsk).toBeNull());
  });

  it("'Không, gửi làm câu trả lời' ⇒ gửi đúng câu đó; câu trả lời thật ('không đổi') gửi thẳng, không hỏi", async () => {
    const { result } = renderHookWithIntl(() => useCrChat("p1", true, undefined, "u1"));
    await waitFor(() => expect(result.current.detail).not.toBeNull());

    act(() => result.current.answer(["không sửa gì nữa"]));
    await waitFor(() => expect(result.current.withdrawAsk).toEqual(["không sửa gì nữa"]));
    act(() => result.current.answerAnyway());
    await waitFor(() => expect(api.answerClarifications).toHaveBeenCalledWith("p1", "CR-001", ["không sửa gì nữa"]));
    expect(result.current.withdrawAsk).toBeNull();

    await act(async () => result.current.send("không đổi"));
    await waitFor(() => expect(api.answerClarifications).toHaveBeenLastCalledWith("p1", "CR-001", ["không đổi"]));
    expect(result.current.withdrawAsk).toBeNull();
    expect(api.cancelCr).not.toHaveBeenCalled();
  });
});

describe("useCrChat - tạo CR từ nhóm cờ (FLF-445)", () => {
  it("startFromFlags tạo thẳng CR mang flag_ids, nhận CR làm CR đang mở và chạy tiếp làm rõ; trả mã CR", async () => {
    api.listCrs.mockResolvedValue({ data: [] });
    api.createCr.mockReset().mockResolvedValue({ data: { ...detail, change_request: { ...detail.change_request, cr_id: "CR-009", flag_ids: ["FY1"] } } });
    api.runCrAction.mockReset().mockResolvedValue({ data: null });
    const { result } = renderHookWithIntl(() => useCrChat("p1", true, undefined, "u1"));
    await waitFor(() => expect(result.current.loading).toBe(false));
    let crId = "";
    await act(async () => {
      crId = await result.current.startFromFlags({ title: "Nhóm cờ", description: "- a", source: { kind: "gap_report", ref: null, note: "n" }, requester: " BA ", flag_ids: ["FY1"] });
    });
    expect(crId).toBe("CR-009");
    expect(api.createCr).toHaveBeenCalledWith("p1", expect.objectContaining({ flag_ids: ["FY1"], requester: "BA", source: expect.objectContaining({ kind: "gap_report" }) }));
    expect(result.current.detail?.change_request.cr_id).toBe("CR-009");
    await waitFor(() => expect(api.runCrAction).toHaveBeenCalledWith("p1", "CR-009", "clarify"));
  });

  it("BE từ chối ⇒ ném lỗi cho thẻ, không nhận CR nào", async () => {
    api.listCrs.mockResolvedValue({ data: [] });
    api.createCr.mockReset().mockRejectedValue(new Error("Có cờ trong nhóm vừa được xử lý."));
    const { result } = renderHookWithIntl(() => useCrChat("p1", true, undefined, "u1"));
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => {
      await expect(result.current.startFromFlags({ title: "t", description: "d", source: { kind: "gap_report", ref: null, note: "n" }, requester: "BA", flag_ids: ["FY1"] })).rejects.toThrow("vừa được xử lý");
    });
    expect(result.current.detail).toBeNull();
    expect(result.current.busy).toBeNull();
  });
});
