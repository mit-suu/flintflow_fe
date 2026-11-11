import { describe, expect, it } from "vitest";
import { migrationMissingLabel } from "./missing-flags";

describe("migrationMissingLabel", () => {
  it("lấy heading của mẫu mới trong câu cờ", () => {
    expect(migrationMissingLabel({ message: 'Mục "4.2.4 …" có trong mẫu mới nhưng tài liệu cũ không có — chưa chốt bản được tới khi viết nội dung' })).toBe("4.2.4 …");
  });

  it("câu cờ không có heading trong ngoặc ⇒ null (để tra theo section_id)", () => {
    expect(migrationMissingLabel({ message: "Mục 2.1 Actors có trong mẫu mới nhưng tài liệu cũ không có" })).toBeNull();
    expect(migrationMissingLabel({ message: "" })).toBeNull();
  });
});
