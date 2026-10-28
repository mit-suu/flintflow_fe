import { describe, expect, it } from "vitest";
import { SOURCE_MODE_OPTIONS, getProjectStartRoute, getSourceModeOption, projectSourceMode } from "./project-source-mode";

describe("project-source-mode (hiển thị mode BE suy ra — FLF-335)", () => {
  it("đủ 3 mode, mỗi mode một lần, không còn trạng thái soon", () => {
    expect(SOURCE_MODE_OPTIONS.map((o) => o.value).sort()).toEqual(["customer_template", "fpt", "import"]);
    expect(SOURCE_MODE_OPTIONS.some((o) => "status" in o)).toBe(false);
    expect(getSourceModeOption("import").icon).toBe("upload");
  });

  it("route bắt đầu theo mode: mọi dự án tải file lên vào wizard import", () => {
    expect(getProjectStartRoute("p1", "import")).toBe("/projects/p1/import");
    expect(getProjectStartRoute("p1", "customer_template")).toBe("/projects/p1/import");
    expect(getProjectStartRoute("p1", "fpt")).toBe("/projects/p1");
  });

  it("dự án tạo SRS đã chốt baseline (converted_from fpt) vẫn hiện là Tạo SRS", () => {
    expect(projectSourceMode({ mode: "import", converted_from: "fpt" })).toBe("fpt");
    expect(projectSourceMode({ mode: "import", converted_from: null })).toBe("import");
  });
});
