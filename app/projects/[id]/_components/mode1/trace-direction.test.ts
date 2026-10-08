import { describe, expect, it } from "vitest";
import type { Spine } from "@/types/spine";
import type { TraceabilityResponse } from "@/types/flags";
import { groupTrace, traceDirection, traceEntityOptions, TRACE_DIR } from "./trace-direction";

/** Đúng 12 field có thể thành cạnh (xem comment của TRACE_DIR); thiếu một dòng là bản đồ nói sai chiều. */
const EDGE_FIELDS = [
  "actor_ids",
  "function_ids",
  "includes",
  "extends",
  "feature_id",
  "flow_to",
  "primary_function_id",
  "screen_id",
  "business_rule_ids",
  "relations",
  "source_validation_ids",
  "permissions",
] as const;

const node = (kind: string, id: string, label: string) => ({ kind: kind as never, id, label });

describe("TRACE_DIR — bảng chiều của cạnh truy vết", () => {
  it("khai đủ mọi field có thể thành cạnh", () => {
    for (const field of EDGE_FIELDS) expect(TRACE_DIR[field], field).toBeDefined();
    expect(Object.keys(TRACE_DIR).sort()).toEqual([...EDGE_FIELDS].sort());
  });

  it("field BE thêm sau mà đây chưa biết ⇒ coi là quan hệ ngang, không đoán chiều", () => {
    expect(traceDirection("field_moi_cua_be")).toBe("lateral");
  });
});

describe("groupTrace — chia node theo chiều quanh một gốc", () => {
  it("actor: chỉ có 'dẫn tới' (use case thực hiện, màn được phân quyền), không có nguồn", () => {
    const res: TraceabilityResponse = {
      nodes: [node("actor", "A01", "Receptionist"), node("use_case", "UC-03", "Book appointment"), node("screen", "S-02", "Appointment list")],
      edges: [
        { from: "UC-03", to: "A01", field: "actor_ids" },
        { from: "A01", to: "S-02", field: "permissions" },
      ],
    };
    const g = groupTrace(res, "A01");
    expect(g.root).toMatchObject({ kind: "actor", id: "A01" });
    expect(g.upstream).toEqual([]);
    expect(g.downstream.map((n) => n.id).sort()).toEqual(["S-02", "UC-03"]);
    expect(g.lateral).toEqual([]);
  });

  it("use case: actor là nguồn, function là dẫn tới, include là ngang", () => {
    const res: TraceabilityResponse = {
      nodes: [
        node("use_case", "UC-03", "Book appointment"),
        node("actor", "A01", "Receptionist"),
        node("function", "FN012", "Validate time slot"),
        node("use_case", "UC-05", "Check availability"),
      ],
      edges: [
        { from: "UC-03", to: "A01", field: "actor_ids" },
        { from: "UC-03", to: "FN012", field: "function_ids" },
        { from: "UC-03", to: "UC-05", field: "includes" },
      ],
    };
    const g = groupTrace(res, "UC-03");
    expect(g.upstream.map((n) => n.id)).toEqual(["A01"]);
    expect(g.downstream.map((n) => n.id)).toEqual(["FN012"]);
    expect(g.lateral.map((n) => n.id)).toEqual(["UC-05"]);
  });

  it("chuỗi toàn xuống lan 2 bước: actor → use case → function đều là 'dẫn tới'", () => {
    const res: TraceabilityResponse = {
      nodes: [node("actor", "A01", "Receptionist"), node("use_case", "UC-03", "Book"), node("function", "FN012", "Validate")],
      edges: [
        { from: "UC-03", to: "A01", field: "actor_ids" },
        { from: "UC-03", to: "FN012", field: "function_ids" },
      ],
    };
    const g = groupTrace(res, "A01");
    expect(g.downstream.map((n) => n.id).sort()).toEqual(["FN012", "UC-03"]);
    expect(g.upstream).toEqual([]);
  });

  it("đường lẫn chiều (xuống rồi lên) chỉ là 'liên quan ngang', không gọi là dẫn tới", () => {
    // UC-03 → FN012 (xuống) → F02 là feature của FN012 (lên): feature có trước use case nên không thể là "dẫn tới"
    const res: TraceabilityResponse = {
      nodes: [node("use_case", "UC-03", "Book"), node("function", "FN012", "Validate"), node("feature", "F02", "Appointment management")],
      edges: [
        { from: "UC-03", to: "FN012", field: "function_ids" },
        { from: "FN012", to: "F02", field: "feature_id" },
      ],
    };
    const g = groupTrace(res, "UC-03");
    expect(g.downstream.map((n) => n.id)).toEqual(["FN012"]);
    expect(g.lateral.map((n) => n.id)).toEqual(["F02"]);
    expect(g.upstream).toEqual([]);
  });

  it("'nối bằng' lấy field của cạnh nối chính node đó, không phải cạnh đầu đường", () => {
    const res: TraceabilityResponse = {
      nodes: [node("use_case", "UC-03", "Book"), node("function", "FN012", "Validate"), node("feature", "F02", "Appointment management")],
      edges: [
        { from: "UC-03", to: "FN012", field: "function_ids" },
        { from: "FN012", to: "F02", field: "feature_id" },
      ],
    };
    const g = groupTrace(res, "UC-03");
    expect(g.lateral[0]).toMatchObject({ id: "F02", field: "feature_id" });
  });

  it("field BE thêm sau ⇒ node vẫn hiện, rơi vào 'liên quan ngang', không mất khỏi bản đồ", () => {
    const res: TraceabilityResponse = {
      nodes: [node("use_case", "UC-03", "Book"), node("screen", "S-09", "Kiosk")],
      edges: [{ from: "UC-03", to: "S-09", field: "field_moi_cua_be" }],
    };
    const g = groupTrace(res, "UC-03");
    expect(g.lateral.map((n) => n.id)).toEqual(["S-09"]);
    expect([g.upstream, g.downstream]).toEqual([[], []]);
  });

  it("gốc không có trong đồ thị ⇒ ba khối rỗng, không ném lỗi", () => {
    expect(groupTrace({ nodes: [], edges: [] }, "A99")).toEqual({ root: null, upstream: [], downstream: [], lateral: [] });
  });

  it("mỗi lời gọi trả đối tượng riêng — không chia nhau mảng dùng chung", () => {
    const a = groupTrace({ nodes: [], edges: [] }, "A99");
    a.downstream.push({ kind: "actor", id: "X", label: "X", field: "f" });
    expect(groupTrace({ nodes: [], edges: [] }, "A99").downstream).toEqual([]);
  });

  it("gốc không có cạnh nào ⇒ vẫn trả gốc, ba khối rỗng", () => {
    const g = groupTrace({ nodes: [node("nfr", "NFR-P01", "Response under 2s")], edges: [] }, "NFR-P01");
    expect(g.root).toMatchObject({ id: "NFR-P01" });
    expect([g.upstream, g.downstream, g.lateral]).toEqual([[], [], []]);
  });
});

const spine = (over: Partial<Spine>): Spine => ({ actors: [], use_cases: [], functions: [], screens: [], entities: [], nfrs: [], features: [], business_rules: [], ...over }) as Spine;

describe("traceEntityOptions — danh sách chọn lấy từ Spine đang mở", () => {
  it("loại có `name` ⇒ nhãn 'mã — tên'", () => {
    const options = traceEntityOptions(spine({ actors: [{ id: "A01", name: "Receptionist" }] as never }), "actor");
    expect(options).toEqual([{ value: "A01", label: "A01 — Receptionist" }]);
  });

  it("NFR và business rule không có `name` ⇒ nhãn lấy `statement`", () => {
    const s = spine({
      nfrs: [{ id: "NFR-P01", statement: "Response under 2 seconds" }] as never,
      business_rules: [{ id: "BR-07", statement: "Only one active booking per patient" }] as never,
    });
    expect(traceEntityOptions(s, "nfr")).toEqual([{ value: "NFR-P01", label: "NFR-P01 — Response under 2 seconds" }]);
    expect(traceEntityOptions(s, "business_rule")[0].label).toBe("BR-07 — Only one active booking per patient");
  });

  it("statement dài bị cắt để không phá bề rộng dropdown", () => {
    const long = "A".repeat(120);
    const [option] = traceEntityOptions(spine({ nfrs: [{ id: "NFR-P02", statement: long }] as never }), "nfr");
    expect(option.label.endsWith("…")).toBe(true);
    expect(option.label.length).toBeLessThan(long.length);
  });

  it("loại chưa có phần tử ⇒ danh sách rỗng", () => {
    expect(traceEntityOptions(spine({}), "screen")).toEqual([]);
  });
});
