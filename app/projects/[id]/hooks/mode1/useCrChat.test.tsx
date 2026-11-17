/**
 * FLF-400: lệnh gửi vào CR đang mở (chip "Sửa tài liệu" ở mode 1) — bấm Gửi / Enter hai lần liền chỉ được gửi một lần.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { act, waitFor } from "@testing-library/react";
import { renderHookWithIntl } from "@/test/intl";
import type { CrDetail } from "@/types/change-request";
import { useCrChat } from "./useCrChat";

const api = vi.hoisted(() => ({ listCrs: vi.fn(), getCr: vi.fn(), sendCrMessage: vi.fn(), answerClarifications: vi.fn(), runCrAction: vi.fn() }));

vi.mock("@/lib/api/change-requests", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  listCrs: api.listCrs,
  getCr: api.getCr,
  sendCrMessage: api.sendCrMessage,
  answerClarifications: api.answerClarifications,
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

describe("useCrChat - trả lời câu làm rõ ⇒ tự chạy tiếp đề xuất (P08, CR #6)", () => {
  const withStatus = (status: string, locations: unknown[] = []) =>
    ({ ...detail, change_request: { ...detail.change_request, status }, locations, pending_questions: status === "awaiting_answers" ? ["Giữ bản nào?"] : [] }) as unknown as CrDetail;
  const loc = { location_id: "L001", section_id: "fixed:2.2", path: "use_cases[id=UC09]", conclusion: null, proposal: null, verify: null, manual: false, found_by: ["keyword"] };

  it("answers ⇒ impact ⇒ propose, không dừng ở 'Tiếp tục - AI đề xuất sửa'", async () => {
    api.listCrs.mockResolvedValue({ data: [{ cr_id: "CR-001", status: "awaiting_answers" }] });
    api.getCr.mockResolvedValue({ data: withStatus("awaiting_answers") });
    api.answerClarifications.mockResolvedValue({ data: withStatus("impact_review") });
    api.runCrAction.mockImplementation(async (_p: string, _id: string, action: string) =>
      action === "impact" ? { data: withStatus("impact_review", [loc]) } : { data: withStatus("proposing", [{ ...loc, conclusion: "not_related" }]) }
    );
    const { result } = renderHookWithIntl(() => useCrChat("p-answer"));
    await waitFor(() => expect(result.current.detail?.change_request.status).toBe("awaiting_answers"));

    await act(async () => {
      result.current.answer(["Giữ bản của Huy"]);
    });
    await waitFor(() => expect(api.runCrAction.mock.calls.map((c) => c[2])).toEqual(expect.arrayContaining(["impact", "propose"])));
  });
});
