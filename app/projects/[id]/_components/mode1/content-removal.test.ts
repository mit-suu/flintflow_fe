import { describe, expect, it } from "vitest";
import type { CrLocation } from "@/types/change-request";
import { removedOf, removedOfAll } from "./content-removal";

const loc = (over: Partial<CrLocation> & { old?: unknown; next?: unknown; ops?: unknown[] }): CrLocation => {
  const { old, next, ops, ...rest } = over;
  return {
    location_id: "L1",
    path: "functions[id=F1]",
    section_id: "s",
    section_title: "Chức năng Đăng nhập",
    current_text: "",
    found_by: [],
    entity_paths: [],
    owner_step: null,
    conclusion: "edit",
    reason: null,
    proposal: { old_text: JSON.stringify(old ?? {}), new_text: next === null ? null : JSON.stringify(next ?? {}), comment_text: null, spine_ops: ops ?? [], assumptions: [] },
    manual: false,
    redo_count: 0,
    verify: null,
    group_id: null,
    ...rest,
  } as CrLocation;
};

describe("removedOf (FLF-483 M1-b)", () => {
  it("op remove ⇒ nhãn hiển thị của vị trí", () => {
    const l = loc({ ops: [{ op: "remove", path: "business_rules[id=BR-01]" }], display: { kind: "business_rules", label: "Quy tắc giá", change: "remove", before: null, after: null } });
    expect(removedOf(l)).toEqual(["Quy tắc giá"]);
  });

  it("set bỏ một điều kiện có id ⇒ nhãn là câu điều kiện, không có mã", () => {
    const old = { validations: [{ id: "V1", condition: "Email hợp lệ" }, { id: "V2", condition: "Mật khẩu từ 8 ký tự" }] };
    const next = { validations: [{ id: "V1", condition: "Email hợp lệ" }] };
    expect(removedOf(loc({ old, next, ops: [{ op: "set" }] }))).toEqual(["Mật khẩu từ 8 ký tự"]);
  });

  it("mảng chuỗi ngắn đi ⇒ không tính xoá", () => {
    expect(removedOf(loc({ old: { normal: ["a", "b"] }, next: { normal: ["a"] } }))).toEqual([]);
  });

  it("thêm mục, sửa chữ, vị trí không liên quan ⇒ không xoá", () => {
    expect(removedOf(loc({ old: { steps: [{ id: "S1", text: "x" }] }, next: { steps: [{ id: "S1", text: "y" }, { id: "S2", text: "z" }] } }))).toEqual([]);
    expect(removedOf(loc({ conclusion: "not_related", ops: [{ op: "remove" }] }))).toEqual([]);
    expect(removedOf(loc({ proposal: null }))).toEqual([]);
  });

  it("mục con không có chữ ⇒ rơi về tên vị trí, không in id", () => {
    const l = loc({ old: { steps: [{ id: "S1" }] }, next: { steps: [] } });
    expect(removedOf(l)).toEqual(["Chức năng Đăng nhập"]);
  });

  it("removedOfAll bỏ trùng", () => {
    const a = loc({ old: { validations: [{ id: "V1", condition: "Cùng câu" }] }, next: { validations: [] } });
    expect(removedOfAll([a, { ...a, location_id: "L2" }])).toEqual(["Cùng câu"]);
  });
});
