import { describe, expect, it } from "vitest";
import { isKnownTableField, tableFieldLabel, tableGroupLabel } from "./table-fields";

describe("table-fields", () => {
  it("cột FlintFlow xuất ra (FLF-251) có nhãn tiếng Việt", () => {
    expect(tableFieldLabel("actors[].kind")).toBe("Tác nhân — Loại tác nhân");
    expect(tableFieldLabel("use_cases[].includes")).toBe("Use case — Use case được include");
    expect(tableFieldLabel("functions[].trigger")).toBe("Chức năng không có màn hình — Điều kiện kích hoạt");
    expect(tableFieldLabel("glossary[].term_native")).toBe("Thuật ngữ — Thuật ngữ tiếng Việt");
    expect(isKnownTableField("messages[].function_ids")).toBe(true);
  });

  it("path lạ không in path thô cho người dùng", () => {
    expect(isKnownTableField("actors[].note")).toBe(false);
    expect(tableFieldLabel("actors[].note")).toBe("Tác nhân — note");
    expect(tableFieldLabel("roles[].actor_id")).toBe("Vai trò — Tác nhân");
    expect(tableGroupLabel("permissions")).toBe("Phân quyền");
    expect(tableGroupLabel("xyz")).toBe("Dữ liệu khác");
  });
});
