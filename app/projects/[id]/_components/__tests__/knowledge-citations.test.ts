import { describe, expect, it } from "vitest";
import { SOURCE_KINDS, splitCitationRefs } from "../knowledge-citations";
import { MESSAGES } from "@/test/intl";
import type { KnowledgeCitation } from "@/types/chat";

const cite = (ref: string, over: Partial<KnowledgeCitation> = {}): KnowledgeCitation => ({
  ref,
  chunk_id: `chunk#${ref}`,
  source: `source-${ref}`,
  section: `section-${ref}`,
  source_kind: "internal_skill",
  ...over,
});

describe("splitCitationRefs", () => {
  it("tách nhãn khớp thành trích dẫn, giữ nguyên chữ và khoảng trắng hai bên", () => {
    const parts = splitCitationRefs("Trần là 8 lượt [K1]. Xem thêm [K2].", [cite("K1"), cite("K2")]);

    expect(parts).toEqual([
      "Trần là 8 lượt ",
      cite("K1"),
      ". Xem thêm ",
      cite("K2"),
      ".",
    ]);
  });

  it("nhãn không có trích dẫn khớp thì giữ nguyên làm chữ, không thành chip rỗng", () => {
    const parts = splitCitationRefs("Có [K1] và [K9] nữa.", [cite("K1")]);

    expect(parts).toEqual(["Có ", cite("K1"), " và [K9] nữa."]);
  });

  it("reply không có nhãn nào ⇒ một đoạn chữ duy nhất, kể cả khi citations có phần tử", () => {
    expect(splitCitationRefs("Không có nhãn.", [cite("K1")])).toEqual(["Không có nhãn."]);
    expect(splitCitationRefs("Không có nhãn.", [])).toEqual(["Không có nhãn."]);
  });

  it("không nhận lầm chữ giống nhãn ([K], [Key]) và nhận cùng một ref nhiều lần", () => {
    expect(splitCitationRefs("[K] và [Key] không phải nhãn.", [cite("K1")])).toEqual([
      "[K] và [Key] không phải nhãn.",
    ]);
    expect(splitCitationRefs("[K1] rồi lại [K1]", [cite("K1")])).toEqual([cite("K1"), " rồi lại ", cite("K1")]);
  });

  it("reply rỗng ⇒ không phần tử nào", () => {
    expect(splitCitationRefs("", [cite("K1")])).toEqual([]);
  });
});

describe("nhãn loại nguồn", () => {
  it("internal_skill nói rõ là hướng dẫn nội bộ FlintFlow; loại nào cũng có nhãn ở cả hai ngôn ngữ", () => {
    expect(MESSAGES.vi.workspace.knowledge.kind.internal_skill).toBe("Hướng dẫn nội bộ FlintFlow");
    expect(MESSAGES.vi.workspace.knowledge.kind.standard).toBe("Chuẩn ngoài");
    for (const kind of SOURCE_KINDS) {
      expect(MESSAGES.vi.workspace.knowledge.kind[kind]).toBeTruthy();
      expect(MESSAGES.en.workspace.knowledge.kind[kind]).toBeTruthy();
    }
  });
});
