import { describe, expect, it } from "vitest";
import { MESSAGES, VIETNAMESE } from "@/test/intl";

/** P13 (E2E P05 #5): khung tài liệu tiếng Việt hiện "Accepted" / "Draft" tiếng Anh cạnh tiêu đề mục. */
describe("P13 - nhãn trạng thái mục của khung tài liệu tiếng Việt", () => {
  const vi = MESSAGES.vi.workspace.document;
  const en = MESSAGES.en.workspace.document;

  it("document.status không còn chữ tiếng Anh", () => {
    expect(vi.status.accepted).toBe("Đã chốt");
    expect(vi.status.draft).toBe("Bản nháp");
    for (const [key, label] of Object.entries(vi.status)) {
      expect(label, key).not.toBe(en.status[key as keyof typeof en.status]);
      expect(VIETNAMESE.test(label), key).toBe(true);
    }
  });

  it("chữ thay ảnh sơ đồ cũng tiếng Việt", () => {
    expect(vi.imageAlt).not.toBe(en.imageAlt);
  });
});
