import { describe, expect, it } from "vitest";
import { addSplit, applySplits, pruneSplits, splitKey } from "../resolve-queue-view";
import { item } from "./resolve-queue-harness";

const GROUP = item("flag_yellow_group:g", "flag_yellow_group", { flag_ids: ["F1", "F2", "F3", "F4"] });
const RED = item("flag_red:R1", "flag_red", { flag_ids: ["R1"] });

describe("tách nhóm cờ (chế độ 1)", () => {
  it("applySplits: phần tách đứng ngay sau phần còn lại của nhóm gốc; cờ đỏ không tách", () => {
    const out = applySplits([GROUP, RED], new Set([splitKey(["F4", "F3"])]));
    expect(out.map((i) => [i.key, i.refs.flag_ids])).toEqual([
      ["flag_yellow_group:g", ["F1", "F2"]],
      ["flag_yellow_group:g~F3,F4", ["F3", "F4"]],
      ["flag_red:R1", ["R1"]],
    ]);
  });

  it("applySplits: nhóm tách chỉ giữ cờ còn trong nhóm; trùng cả nhóm thì không tách", () => {
    expect(applySplits([GROUP], new Set(["F4,F9"])).map((i) => i.refs.flag_ids)).toEqual([["F1", "F2", "F3"], ["F4"]]);
    expect(applySplits([GROUP], new Set(["F1,F2,F3,F4"]))).toEqual([GROUP]);
  });

  it("addSplit: cờ chuyển sang nhóm mới rời nhóm tách cũ", () => {
    expect([...addSplit(new Set(["F3,F4"]), ["F4"])].sort()).toEqual(["F3", "F4"]);
  });

  it("pruneSplits: bỏ nhóm tách không còn cờ nào trong hàng, không đổi thì trả lại chính tập", () => {
    const splits = new Set(["F3,F4", "X1"]);
    expect([...pruneSplits(splits, [GROUP])]).toEqual(["F3,F4"]);
    const same = new Set(["F3"]);
    expect(pruneSplits(same, [GROUP])).toBe(same);
  });
});
