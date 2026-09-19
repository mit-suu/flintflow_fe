import { describe, expect, it } from "vitest";
import { SOURCE_MODE_OPTIONS, getProjectStartRoute, getSourceModeOption } from "./project-source-mode";

describe("project-source-mode", () => {
  it("đủ 3 mode, mỗi mode một lần", () => {
    expect(SOURCE_MODE_OPTIONS.map((o) => o.value).sort()).toEqual(["customer_template", "fpt", "import"]);
  });

  it("template khách chưa có (BE 501) ⇒ status soon; upload SRS (mode 1) và mẫu FPT chọn được", () => {
    expect(getSourceModeOption("customer_template").status).toBe("soon");
    expect(getSourceModeOption("import").status).toBe("ready");
    expect(getSourceModeOption("fpt").status).toBe("ready");
  });

  it("route bắt đầu theo mode", () => {
    expect(getProjectStartRoute("p1", "import")).toBe("/projects/p1/import");
    expect(getProjectStartRoute("p1", "customer_template")).toBe("/projects/p1/template");
    expect(getProjectStartRoute("p1", "fpt")).toBe("/projects/p1");
  });
});
