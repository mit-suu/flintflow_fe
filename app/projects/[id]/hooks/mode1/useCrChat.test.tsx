/**
 * FLF-400: lệnh gửi vào CR đang mở (chip "Sửa tài liệu" ở mode 1) — bấm Gửi / Enter hai lần liền chỉ được gửi một lần.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { act, waitFor } from "@testing-library/react";
import { renderHookWithIntl } from "@/test/intl";
import type { CrDetail } from "@/types/change-request";
import { useCrChat } from "./useCrChat";

const api = vi.hoisted(() => ({ listCrs: vi.fn(), getCr: vi.fn(), sendCrMessage: vi.fn() }));

vi.mock("@/lib/api/change-requests", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  listCrs: api.listCrs,
  getCr: api.getCr,
  sendCrMessage: api.sendCrMessage,
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
