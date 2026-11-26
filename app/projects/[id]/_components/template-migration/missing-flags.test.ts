import { describe, expect, it } from "vitest";
import type { Flag } from "@/types/spine";
import type { MissingItem } from "@/types/template-migration";
import { migrationMissingLabel, openMigrationMissing } from "./missing-flags";

describe("migrationMissingLabel", () => {
  it("lấy heading của mẫu mới trong câu cờ", () => {
    expect(migrationMissingLabel({ message: 'Mục "4.2.4 …" có trong mẫu mới nhưng tài liệu cũ không có — chưa chốt bản được tới khi viết nội dung' })).toBe("4.2.4 …");
  });

  it("câu cờ không có heading trong ngoặc ⇒ null (để tra theo section_id)", () => {
    expect(migrationMissingLabel({ message: "Mục 2.1 Actors có trong mẫu mới nhưng tài liệu cũ không có" })).toBeNull();
    expect(migrationMissingLabel({ message: "" })).toBeNull();
  });
});

const flag = (id: string, sectionId: string, message: string): Flag => ({
  id,
  rule_id: "template_section_migration_missing",
  level: "red",
  section_id: sectionId,
  message,
  remediation_step: "",
  opened_at_version: 1,
  resolved_at: null,
  waived_by_user: false,
  waive_reason: null,
  waived_at_version: null,
});
const missing = (key: string, heading: string, sectionId: string, spine: boolean): MissingItem => ({
  id: `x:${key}`,
  new_key: key,
  heading_text: heading,
  section_id: sectionId,
  needs_content: !spine,
  guidance: null,
  ...(spine ? { filled_from_spine: true as const } : {}),
});

describe("openMigrationMissing", () => {
  const flags = [
    flag("f1", "fixed:1.1", 'Mục "1.1 Mục đích" có trong mẫu mới nhưng tài liệu cũ không có'),
    flag("f2", "fixed:3.4", 'Mục "3.4 Tuân thủ" có trong mẫu mới nhưng tài liệu cũ không có'),
    flag("f3", "fixed:2.5", "Mục 2.5 có trong mẫu mới"),
  ];

  it("bỏ cờ của mục in từ dữ liệu Spine (theo heading trong câu cờ, không có thì theo section_id)", () => {
    const items = [missing("n1", "1.1 Mục đích", "fixed:1.1", true), missing("n2", "3.4 Tuân thủ", "fixed:3.4", false), missing("n3", "2.5 Giả định", "fixed:2.5", true)];
    expect(openMigrationMissing(flags, items).map((f) => f.id)).toEqual(["f2"]);
  });

  it("cùng section_id còn mục khác phải viết ⇒ giữ cờ; không truyền mục thiếu ⇒ như cũ", () => {
    const items = [missing("n3", "2.5 Giả định", "fixed:2.5", true), missing("n4", "2.5b Phụ thuộc", "fixed:2.5", false)];
    expect(openMigrationMissing(flags, items).map((f) => f.id)).toEqual(["f1", "f2", "f3"]);
    expect(openMigrationMissing(flags).map((f) => f.id)).toEqual(["f1", "f2", "f3"]);
  });
});
