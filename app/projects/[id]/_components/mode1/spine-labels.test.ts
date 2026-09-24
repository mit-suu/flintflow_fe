import { describe, expect, it } from "vitest";
import { fieldLabel, humanizeText, pathLabel, ruleLabel, sectionName } from "./spine-labels";

describe("spine-labels — nhãn thay cho mã kỹ thuật (mode 1)", () => {
  it("path Spine ⇒ tên phần tử + tên field", () => {
    expect(pathLabel("use_cases[id=UC-2.4].description")).toBe("Use case UC-2.4 — Mô tả");
    expect(pathLabel("nfrs[id=NFR-P02]")).toBe("Yêu cầu phi chức năng NFR-P02");
    expect(pathLabel("actors[]")).toBe("Tác nhân (thêm mới)");
    expect(pathLabel("glossary[].term")).toBe("Thuật ngữ (thêm mới) — Thuật ngữ");
    expect(pathLabel("project.code")).toBe("Thông tin dự án — Mã");
    expect(pathLabel("functions[id=F01].validations[id=V2].statement")).toBe("Chức năng F01 › Kiểm tra dữ liệu V2 — Nội dung");
    expect(pathLabel("screens[0].name")).toBe("Màn hình #1 — Tên");
  });

  it("path lạ / không đọc được ⇒ giữ nguyên, không mất thông tin", () => {
    expect(pathLabel("unknown_array[id=X].name")).toBe("unknown_array[id=X].name");
    expect(pathLabel("actors[id=A01].new_field")).toBe("Tác nhân A01 — new_field");
    expect(pathLabel("not a path")).toBe("not a path");
    expect(fieldLabel("giá trị")).toBe("giá trị");
  });

  it("path trong câu thông báo của BE được đổi sang nhãn, chữ thường giữ nguyên", () => {
    expect(humanizeText("use_cases[id=UC-01] không còn trong Spine")).toBe("Use case UC-01 không còn trong Spine");
    expect(humanizeText("Op sửa actors[id=A01].name — phần tử này không thuộc vị trí")).toBe("Op sửa Tác nhân A01 — Tên — phần tử này không thuộc vị trí");
    expect(humanizeText("Thiếu actors cho use case")).toBe("Thiếu actors cho use case");
  });

  it("mã luật ⇒ tên tiếng Việt; mã lạ ⇒ rỗng (chỉ để ở tooltip); mã mục ⇒ số + tên mục", () => {
    expect(ruleLabel("section_empty")).toBe("Mục còn trống");
    expect(ruleLabel("op_outside_section")).toBe("Sửa ngoài phạm vi của vị trí");
    expect(ruleLabel("AI-CONSISTENCY")).toBe("");
    expect(sectionName("fixed:5.1")).toBe("5.1 Business Rules");
    expect(sectionName(null)).toBe("");
  });
});
