import { describe, expect, it } from "vitest";
import { renderHookWithIntl } from "@/test/intl";
import type { Migration } from "@/types/template-migration";
import { moveTargetKindOf, useChoiceLabel } from "./choice-label";
import { migrationFixture, placeableFixture } from "./migration-fixture.test-helper";

/** Mẫu đích có heading nhóm (1 Giới thiệu ⇒ 1.1, 1.2), mục đã có cặp (1.2), mục trống (1.1), mục in từ Spine (2 Giả định). */
const structured = (): Migration => {
  const m = placeableFixture();
  m.to.headings.push({ key: "n4", heading_text: "2 Giả định", section_id: "fixed:2.5", level: 1 });
  m.groups.missing.push({ id: "x:n4", new_key: "n4", heading_text: "2 Giả định", section_id: "fixed:2.5", needs_content: false, guidance: null, filled_from_spine: true });
  return m;
};

const labelOf = (m: Migration, locale: "vi" | "en" = "vi") => renderHookWithIntl(() => useChoiceLabel(m), locale).result.current;

describe("useChoiceLabel", () => {
  it("chuyển vào ghi rõ theo loại mục đích: mục trống, mục đã có nội dung, heading nhóm", () => {
    const label = labelOf(structured());
    expect(label("move_to:n1")).toBe("Chuyển vào “1.1 Mục đích”");
    expect(label("move_to:n2")).toBe("Gộp vào “1.2 Phạm vi” (sau nội dung đang có)");
    expect(label("move_to:n4")).toBe("Gộp vào “2 Giả định” (sau nội dung đang có)");
    expect(label("move_to:n3")).toBe("Gộp vào “3.4 Tuân thủ” (sau nội dung đang có)");
    expect(label("move_to:n0")).toBe("Thêm thành mục con cuối của “1 Giới thiệu”");
  });

  it("nhãn lựa chọn mới: giữ cặp, chia theo từng yêu cầu; có bản tiếng Anh", () => {
    const vi = labelOf(structured());
    expect(vi("keep_pair")).toBe("Giữ cặp hiện tại");
    expect(vi("distribute")).toBe("Chia theo từng yêu cầu");
    const en = labelOf(structured(), "en");
    expect(en("keep_pair")).toBe("Keep the current pairing");
    expect(en("move_to:n0")).toBe("Add as the last subsection of “1 Giới thiệu”");
  });

  it("bản ghi cũ: heading không có level, không có pairing.children ⇒ không suy heading nhóm, nhãn cũ vẫn đúng", () => {
    const m = migrationFixture();
    delete m.pairing.children;
    const label = labelOf(m);
    expect(label("move_to:n1")).toBe("Chuyển vào “Phạm vi”");
    expect(label("move_to:n0")).toBe("Gộp vào “1 Introduction” (sau nội dung đang có)");
    expect(label("to:n2")).toBe("Đặt vào “Phụ lục”");
    expect(label("drop_from_print")).toBe("Không in ra");
    expect(label("future_choice")).toBe("future_choice");
    expect(label("move_to:n9")).toBe("Chuyển vào “n9”");
  });
});

describe("moveTargetKindOf", () => {
  it("mục được tách cho mục cũ khác tính là đã có nội dung; heading nhóm ưu tiên hơn đã có cặp", () => {
    const m = structured();
    m.pairing.pairs.push({ old_key: "o1", new_key: "n0", by: "title", score: 0.8, needs_review: false });
    m.pairing.split = [{ old_key: "o2", new_keys: ["n1"] }];
    const kindOf = moveTargetKindOf(m);
    expect(kindOf("n0")).toBe("group");
    expect(kindOf("n1")).toBe("filled");
    expect(kindOf("n9")).toBe("empty");
  });
});
