/**
 * FLF-400: lệnh gửi vào CR đang mở (chip "Sửa tài liệu" ở mode 1) — bấm Gửi / Enter hai lần liền chỉ được gửi một lần.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { act, waitFor } from "@testing-library/react";
import { renderHookWithIntl } from "@/test/intl";
import type { CrDetail } from "@/types/change-request";
import { useCrChat } from "./useCrChat";

const api = vi.hoisted(() => ({ listCrs: vi.fn(), getCr: vi.fn(), sendCrMessage: vi.fn(), answerClarifications: vi.fn(), cancelCr: vi.fn(), runCrAction: vi.fn() }));

vi.mock("@/lib/api/change-requests", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  listCrs: api.listCrs,
  getCr: api.getCr,
  sendCrMessage: api.sendCrMessage,
  answerClarifications: api.answerClarifications,
  cancelCr: api.cancelCr,
  runCrAction: api.runCrAction,
}));

const detail = {
  change_request: { cr_id: "CR-001", status: "draft", paused: null, amendments: [], clarifications: [], materials: [] },
  locations: [],
  groups: [],
  pending_questions: [],
} as unknown as CrDetail;

beforeEach(() => {
  api.listCrs.mockReset().mockResolvedValue({ data: [{ cr_id: "CR-001", status: "draft" }] });
  api.getCr.mockReset().mockResolvedValue({ data: detail });
  api.sendCrMessage.mockReset().mockResolvedValue({ data: { ...detail, message: { kind: "answer", reply: "Không vẽ lại hình." } } });
});

describe("useCrChat - gửi lặp (FLF-400)", () => {
  it("send gọi 2 lần trong cùng một tick ⇒ sendCrMessage chỉ gọi 1 lần; xong thì gửi tiếp được", async () => {
    const { result } = renderHookWithIntl(() => useCrChat("p1"));
    await waitFor(() => expect(result.current.detail).not.toBeNull());

    await act(async () => {
      await Promise.all([result.current.send("không vẽ lại hình à?"), result.current.send("không vẽ lại hình à?")]);
    });
    expect(api.sendCrMessage).toHaveBeenCalledTimes(1);

    await act(async () => result.current.send("còn mục 3.2 thì sao?"));
    expect(api.sendCrMessage).toHaveBeenCalledTimes(2);
  });
});

const asking = {
  ...detail,
  change_request: { ...detail.change_request, status: "awaiting_answers", clarifications: [{ round: 1, questions: ["Màn nào?"], answers: [], suggestions: [[]] }] },
  pending_questions: ["Màn nào?"],
} as unknown as CrDetail;

describe("useCrChat - trả lời làm rõ là lời rút lại (FLF-439)", () => {
  beforeEach(() => {
    api.listCrs.mockResolvedValue({ data: [{ cr_id: "CR-001", status: "awaiting_answers" }] });
    api.getCr.mockResolvedValue({ data: asking });
    api.answerClarifications.mockReset().mockResolvedValue({ data: asking });
    api.cancelCr.mockReset().mockResolvedValue({ data: { ...asking, change_request: { ...asking.change_request, status: "cancelled" } } });
    api.runCrAction.mockReset().mockResolvedValue({ data: asking });
  });

  it("'không đổi nữa' ⇒ chưa gửi câu trả lời, hỏi huỷ CR; Huỷ ⇒ cancelCr kèm lý do là câu đã gõ", async () => {
    const { result } = renderHookWithIntl(() => useCrChat("p1"));
    await waitFor(() => expect(result.current.detail).not.toBeNull());

    await act(async () => result.current.send("không đổi nữa"));
    expect(api.answerClarifications).not.toHaveBeenCalled();
    expect(result.current.withdrawAsk).toEqual(["không đổi nữa"]);

    await act(async () => result.current.confirmWithdraw());
    await waitFor(() => expect(api.cancelCr).toHaveBeenCalledWith("p1", "CR-001", expect.stringContaining("không đổi nữa")));
    await waitFor(() => expect(result.current.withdrawAsk).toBeNull());
  });

  it("'Không, gửi làm câu trả lời' ⇒ gửi đúng câu đó; câu trả lời thật ('không đổi') gửi thẳng, không hỏi", async () => {
    const { result } = renderHookWithIntl(() => useCrChat("p1"));
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
