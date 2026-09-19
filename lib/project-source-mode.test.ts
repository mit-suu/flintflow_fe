import { describe, expect, it } from "vitest";
import { SOURCE_MODE_OPTIONS, getProjectStartRoute, getSourceModeOption } from "./project-source-mode";

describe("project-source-mode", () => {
  it("đủ 3 mode, mỗi mode một lần", () => {
    expect(SOURCE_MODE_OPTIONS.map((o) => o.value).sort()).toEqual(["customer_template", "edit_srs", "fpt_template"]);
  });

  it("màn upload SRS và template khách chưa có ⇒ status soon; chỉ mẫu FPT chọn được", () => {
    expect(getSourceModeOption("customer_template").status).toBe("soon");
    expect(getSourceModeOption("edit_srs").status).toBe("soon");
    expect(getSourceModeOption("fpt_template").status).toBe("ready");
  });

  it("route bắt đầu theo mode", () => {
    expect(getProjectStartRoute("p1", "edit_srs")).toBe("/projects/p1/import");
    expect(getProjectStartRoute("p1", "customer_template")).toBe("/projects/p1/template");
    expect(getProjectStartRoute("p1", "fpt_template")).toBe("/projects/p1");
  });
});
