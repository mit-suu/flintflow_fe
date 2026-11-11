import { describe, expect, it } from "vitest";
import { compareFileOrder, compareOutlineLabels, isProvisionalSection, plainHeading, provisionalLabel, sectionLabel, sectionLabelIn } from "./fpt-sections";

describe("fpt-sections - nhãn section tạm (FLF-312)", () => {
  const headings = [
    { block_id: "B0030", heading_text: "3.2 Authentication" },
    { block_id: "B0031", heading_text: "3.2.1 Register account" },
  ];

  it("section tạm ghi rõ tính năng / chức năng nào theo tiêu đề trong file", () => {
    expect(isProvisionalSection("feature:@B0030")).toBe(true);
    expect(isProvisionalSection("feature:F-3.2")).toBe(false);
    // Chỉ tiêu đề trong file, không tiền tố "Tính năng mới —" / "Chức năng mới —"
    expect(provisionalLabel(" 3.2.1 Register account ")).toBe("3.2.1 Register account");
    // FLF-362: màn "Trích field theo section" bỏ số mục
    expect(sectionLabelIn("feature:@B0030", headings)).toBe("Authentication");
    expect(sectionLabelIn("function:@B0031", headings)).toBe("Register account");
  });

  it("compareOutlineLabels: theo số đề mục từng cấp; nhãn không số xếp sau, giữ thứ tự", () => {
    const labels = ["Mục riêng", "3.10 Reports", "3.2.1 Register account", "1.1 Purpose", "3.2 Authentication", "Không khớp", "2.1 Actors", "3 Functional Requirements"];
    expect([...labels].sort(compareOutlineLabels)).toEqual([
      "1.1 Purpose",
      "2.1 Actors",
      "3 Functional Requirements",
      "3.2 Authentication",
      "3.2.1 Register account",
      "3.10 Reports",
      "Mục riêng",
      "Không khớp",
    ]);
  });

  it("không tra được heading ⇒ nhãn chung, không in mã block; section khác giữ nhãn cũ", () => {
    expect(sectionLabel("feature:@B0099")).toBe("Tính năng mới (chưa có mã)");
    expect(sectionLabelIn("function:@B0099", headings)).toBe("Chức năng mới (chưa có mã)");
    expect(sectionLabelIn("fixed:2.1", headings)).toBe("Actors");
    expect(sectionLabelIn(null)).toBe("Không khớp (giữ nguyên, không trích)");
  });

  it("FLF-362: nhãn luồng upload = tiêu đề của file bỏ số mục (số gõ tay lẫn số Word); mục FPT không có trong file ⇒ tên mẫu không số", () => {
    const fileHeadings = [
      { block_id: "B0001", heading_text: "User Characteristics", section_id: "fixed:2.1", number_label: "2.4." },
      { block_id: "B0002", heading_text: "1.3 Định nghĩa, từ viết tắt", section_id: "fixed:5.5" },
      { block_id: "B0003", heading_text: "1.2 Product Scope", section_id: "slot:scope" },
      { block_id: "B0004", heading_text: "3.2.1 UC-01 Đăng nhập", section_id: "feature:@B0004" },
    ];
    expect(sectionLabelIn("fixed:2.1", fileHeadings)).toBe("User Characteristics");
    expect(sectionLabelIn("fixed:5.5", fileHeadings)).toBe("Định nghĩa, từ viết tắt");
    expect(sectionLabelIn("slot:scope", fileHeadings)).toBe("Product Scope");
    expect(sectionLabelIn("feature:@B0004", fileHeadings)).toBe("UC-01 Đăng nhập");
    expect(sectionLabelIn("fixed:4.1", fileHeadings)).toBe("External Interfaces");
    expect(plainHeading("II. Software Requirement Specification")).toBe("Software Requirement Specification");
    // thứ tự theo file, mục không có trong file xếp sau theo mẫu FPT
    expect(["fixed:4.1", "feature:@B0004", "fixed:1", "fixed:2.1"].sort(compareFileOrder(fileHeadings))).toEqual(["fixed:2.1", "feature:@B0004", "fixed:1", "fixed:4.1"]);
  });
});
