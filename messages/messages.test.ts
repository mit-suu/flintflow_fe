import { describe, expect, it } from "vitest";
import en from "./en.json";
import vi from "./vi.json";

type Tree = { [key: string]: string | Tree };

const flatten = (tree: Tree, prefix = ""): Record<string, string> =>
  Object.entries(tree).reduce<Record<string, string>>((acc, [key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return typeof value === "string" ? { ...acc, [path]: value } : { ...acc, ...flatten(value, path) };
  }, {});

/** Tên tham số ICU (`{count}`, `{k, plural, …}`) và thẻ rich text (`<em>`) trong một chuỗi. */
const placeholders = (message: string): string[] =>
  [...new Set([...message.matchAll(/\{(\w+)[,}]|<(\w+)>/g)].map((m) => m[1] ?? `<${m[2]}>`))].sort();

const VI = flatten(vi);
const EN = flatten(en);

describe("messages vi ↔ en", () => {
  it("cùng một tập key — thêm chuỗi ở vi thì phải có bản en và ngược lại", () => {
    expect(Object.keys(EN).sort()).toEqual(Object.keys(VI).sort());
  });

  it("không có chuỗi rỗng", () => {
    const empty = Object.entries({ ...VI, ...EN }).filter(([, v]) => !v.trim());
    expect(empty).toEqual([]);
  });

  it("cùng tham số và thẻ rich text — dịch không được làm rơi `{count}` hay `<em>`", () => {
    const mismatched = Object.keys(VI).filter(
      (key) => JSON.stringify(placeholders(VI[key])) !== JSON.stringify(placeholders(EN[key] ?? ""))
    );
    expect(mismatched).toEqual([]);
  });
});
