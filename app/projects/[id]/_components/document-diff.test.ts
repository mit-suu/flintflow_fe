import { describe, expect, it } from "vitest";
import type { Block, RenderedDocument, RenderedSection } from "@/types/document";
import { blockRegionKey, diffDocument, imageKey, sectionRegionKey } from "./document-diff";

const para = (text: string): Block => ({ type: "paragraph", runs: [{ text }] });
const section = (id: string, blocks: Block[], extra: Partial<RenderedSection> = {}): RenderedSection => ({
  id,
  number: id.replace("fixed:", ""),
  heading: `Heading ${id}`,
  level: 1,
  blocks,
  ...extra,
});
const doc = (...sections: RenderedSection[]): RenderedDocument => ({
  projectId: "p1",
  projectName: "P",
  version: "v1",
  source: "draft",
  generatedAt: "2026-11-05T00:00:00.000Z",
  sections,
  recordOfChanges: [],
});

/** Tài liệu đủ lớn (10 mục) để ngưỡng "đổi diện rộng" không ảnh hưởng các ca nhỏ. */
const base = () => Array.from({ length: 10 }, (_, i) => section(`fixed:${i + 1}`, [para(`text ${i + 1}`)]));

describe("diffDocument", () => {
  it("không đổi gì ⇒ không mục / vùng nào", () => {
    const diff = diffDocument(doc(...base()), doc(...base()));
    expect(diff.sections.size).toBe(0);
    expect(diff.regions).toEqual([]);
    expect(diff.broad).toBe(false);
  });

  it("một mục đổi nội dung (một block duy nhất) ⇒ tô cả mục", () => {
    const next = base();
    next[2] = section("fixed:3", [para("khác")]);
    const diff = diffDocument(doc(...base()), doc(...next));
    expect([...diff.sections]).toEqual([["fixed:3", "changed"]]);
    expect(diff.blocks.size).toBe(0);
    expect(diff.regions).toEqual([sectionRegionKey("fixed:3")]);
  });

  it("mục mới ⇒ added, tô cả mục", () => {
    const next = [...base(), section("fixed:11", [para("mới")])];
    const diff = diffDocument(doc(...base()), doc(...next));
    expect(diff.sections.get("fixed:11")).toBe("added");
    expect(diff.regions).toEqual([sectionRegionKey("fixed:11")]);
  });

  it("mục bị xoá bị bỏ qua", () => {
    const next = base().slice(1);
    const diff = diffDocument(doc(...base()), doc(...next));
    expect(diff.sections.size).toBe(0);
  });

  it("chèn một đoạn giữa mục nhiều đoạn ⇒ chỉ đoạn đó được đánh dấu", () => {
    const before = base();
    before[0] = section("fixed:1", [para("a"), para("b"), para("c")]);
    const after = base();
    after[0] = section("fixed:1", [para("a"), para("MỚI"), para("b"), para("c")]);
    const diff = diffDocument(doc(...before), doc(...after));
    expect(diff.blocks.get("fixed:1")).toEqual(new Set([1]));
    expect(diff.regions).toEqual([blockRegionKey("fixed:1", 1)]);
  });

  it("sửa một câu trong mục nhiều đoạn ⇒ chỉ đoạn đó sáng", () => {
    const before = base();
    before[4] = section("fixed:5", [para("a"), para("b"), para("c"), para("d")]);
    const after = base();
    after[4] = section("fixed:5", [para("a"), para("b đã sửa"), para("c"), para("d")]);
    const diff = diffDocument(doc(...before), doc(...after));
    expect(diff.blocks.get("fixed:5")).toEqual(new Set([1]));
  });

  it("chèn mục ở giữa không làm các mục sau thành 'đổi' dù số mục bị đánh lại", () => {
    const before = base();
    const after = [before[0], section("fixed:1b", [para("chèn")]), ...before.slice(1).map((s) => ({ ...s, number: `${s.number}.x` }))];
    const diff = diffDocument(doc(...before), doc(...after));
    expect([...diff.sections.keys()]).toEqual(["fixed:1b"]);
  });

  it("đổi nhãn trạng thái / chờ duyệt lại không phải đổi nội dung", () => {
    const next = base().map((s, i) => (i === 1 ? { ...s, status: "accepted" as const, awaiting_reaccept: true } : s));
    expect(diffDocument(doc(...base()), doc(...next)).sections.size).toBe(0);
  });

  it("đổi tiêu đề mục ⇒ tô cả mục, không tô riêng block", () => {
    const before = base();
    before[0] = section("fixed:1", [para("a"), para("b")]);
    const after = base();
    after[0] = section("fixed:1", [para("a"), para("b mới")], { heading: "Tên khác" });
    const diff = diffDocument(doc(...before), doc(...after));
    expect(diff.sections.get("fixed:1")).toBe("changed");
    expect(diff.blocks.has("fixed:1")).toBe(false);
  });

  it("chỉ xoá bớt đoạn ⇒ cả mục đổi, không block nào để tô", () => {
    const before = base();
    before[0] = section("fixed:1", [para("a"), para("b"), para("c")]);
    const after = base();
    after[0] = section("fixed:1", [para("a"), para("c")]);
    const diff = diffDocument(doc(...before), doc(...after));
    expect(diff.sections.get("fixed:1")).toBe("changed");
    expect(diff.blocks.has("fixed:1")).toBe(false);
    expect(diff.regions).toEqual([sectionRegionKey("fixed:1")]);
  });

  it("đổi quá nửa mục ⇒ broad, không vùng nào để tô", () => {
    const after = base().map((s, i) => (i < 6 ? section(s.id, [para(`đổi ${i}`)]) : s));
    const diff = diffDocument(doc(...base()), doc(...after));
    expect(diff.sections.size).toBe(6);
    expect(diff.broad).toBe(true);
    expect(diff.regions).toEqual([]);
  });

  it("tài liệu nhỏ (dưới 4 mục) không bị coi là broad chỉ vì một mục đổi", () => {
    const diff = diffDocument(doc(section("a", [para("1")]), section("b", [para("2")])), doc(section("a", [para("1")]), section("b", [para("3")])));
    expect(diff.broad).toBe(false);
    expect(diff.regions).toEqual([sectionRegionKey("b")]);
  });

  describe("block ảnh", () => {
    const image = (png: string): Block => ({ type: "image", png, caption: "UC" });
    const withImage = (png: string) => {
      const sections = base();
      sections[3] = section("fixed:4", [para("intro"), image(png), para("outro")]);
      return doc(...sections);
    };

    it("ảnh base64 đổi ⇒ chỉ block ảnh sáng", () => {
      const a = `iVBORw0KGgo${"A".repeat(5000)}`;
      const b = `iVBORw0KGgo${"AB".repeat(2500)}`; // cùng độ dài, khác nội dung
      const diff = diffDocument(withImage(a), withImage(b));
      expect(diff.blocks.get("fixed:4")).toEqual(new Set([1]));
    });

    it("ảnh y hệt ⇒ không đổi", () => {
      const a = `iVBORw0KGgo${"xyz".repeat(3000)}`;
      expect(diffDocument(withImage(a), withImage(a)).sections.size).toBe(0);
    });

    it("tham chiếu có hash: cùng id khác hash ⇒ đổi; cùng hash ⇒ không", () => {
      expect(diffDocument(withImage("diagram-ref:D1@aaa"), withImage("diagram-ref:D1@bbb")).blocks.get("fixed:4")).toEqual(new Set([1]));
      expect(diffDocument(withImage("diagram-ref:D1@aaa"), withImage("diagram-ref:D1@aaa")).sections.size).toBe(0);
    });
  });
});

describe("imageKey", () => {
  it("tham chiếu chuỗi dùng nguyên, không băm", () => {
    expect(imageKey("diagram-ref:D1@h1")).toBe("diagram-ref:D1@h1");
    expect(imageKey("diagram-error:D1")).toBe("diagram-error:D1");
  });

  it("tham chiếu object dùng id + hash + locale", () => {
    expect(imageKey({ ref: "diagram", id: "D1", locale: "vi", hash: "h1" })).toBe("ref:D1@h1:vi");
    expect(imageKey({ ref: "diagram", id: "D1", hash: "h2" })).not.toBe(imageKey({ ref: "diagram", id: "D1", hash: "h1" }));
  });

  it("base64 dài ⇒ khoá ngắn (không chứa cả chuỗi) nhưng vẫn phân biệt ảnh khác nhau", () => {
    const long = "A".repeat(500_000);
    const key = imageKey(long);
    expect(key.length).toBeLessThan(400);
    expect(imageKey(`${long}B`)).not.toBe(key);
    expect(imageKey("AB".repeat(250_000))).not.toBe(key); // cùng độ dài, khác nội dung
  });
});
