import { describe, expect, it } from "vitest";
import { compareOutlineLabels, isProvisionalSection, provisionalLabel, sectionLabel, sectionLabelIn } from "./fpt-sections";

describe("fpt-sections — nhãn section tạm (FLF-312)", () => {
  const headings = [
    { block_id: "B0030", heading_text: "3.2 Authentication" },
    { block_id: "B0031", heading_text: "3.2.1 Register account" },
  ];

  it("section tạm ghi rõ tính năng / chức năng nào theo tiêu đề trong file", () => {
    expect(isProvisionalSection("feature:@B0030")).toBe(true);
    expect(isProvisionalSection("feature:F-3.2")).toBe(false);
    // Chỉ tiêu đề trong file, không tiền tố "Tính năng mới —" / "Chức năng mới —"
    expect(provisionalLabel(" 3.2.1 Register account ")).toBe("3.2.1 Register account");
    expect(sectionLabelIn("feature:@B0030", headings)).toBe("3.2 Authentication");
    expect(sectionLabelIn("function:@B0031", headings)).toBe("3.2.1 Register account");
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
    expect(sectionLabelIn("fixed:2.1", headings)).toBe("2.1 Actors");
    expect(sectionLabelIn(null)).toBe("Không khớp (giữ nguyên, không trích)");
  });

  it("FLF-362: section có heading trong file ⇒ tiêu đề + số của file (số Word tự đánh ghép vào), không phải nhãn mẫu FPT", () => {
    const fileHeadings = [
      { block_id: "B0001", heading_text: "User Characteristics", section_id: "fixed:2.1", number_label: "2.4." },
      { block_id: "B0002", heading_text: "1.3 Định nghĩa, từ viết tắt", section_id: "fixed:5.5", number_label: "9.9" },
      { block_id: "B0003", heading_text: "Product Scope", section_id: "slot:scope" },
      { block_id: "B0004", heading_text: "Authentication", section_id: "feature:@B0004", number_label: "3.2." },
    ];
    // số Word tự đánh của file, không phải "2.1 Actors" của mẫu FPT
    expect(sectionLabelIn("fixed:2.1", fileHeadings)).toBe("2.4. User Characteristics");
    // chữ đã gõ số tay ⇒ giữ nguyên, không ghép thêm nhãn
    expect(sectionLabelIn("fixed:5.5", fileHeadings)).toBe("1.3 Định nghĩa, từ viết tắt");
    // phần nhỏ / mục không số ⇒ đúng chữ của file
    expect(sectionLabelIn("slot:scope", fileHeadings)).toBe("Product Scope");
    expect(sectionLabelIn("feature:@B0004", fileHeadings)).toBe("3.2. Authentication");
    // mục FPT không có heading trong file ⇒ nhãn mẫu
    expect(sectionLabelIn("fixed:4.1", fileHeadings)).toBe("4.1 External Interfaces");
  });
});
