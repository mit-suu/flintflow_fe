import { describe, expect, it } from "vitest";
import { versionFileName, versionLineage } from "./doc-version";

/** FLF-334: tên dự phòng FE phải khớp quy tắc `versionFileName` BE (`flintflow_be/src/modules/doc-version/versioning.ts`). */
describe("versionFileName", () => {
  it("release / nháp có CR / nháp v0 / chưa baseline / tracked / original / pdf", () => {
    expect(versionFileName({ name: "Lumen", release: true, base: "2.0" })).toBe("Lumen_v2.0.docx");
    expect(versionFileName({ name: "Lumen", release: false, base: "1.0", latestCr: "CR-014" })).toBe("Lumen_v1.0+CR-014_DRAFT.docx");
    expect(versionFileName({ name: "Lumen", release: false, base: "0" })).toBe("Lumen_v0_DRAFT.docx");
    expect(versionFileName({ name: "Lumen", release: false, base: "v1.0" })).toBe("Lumen_v1.0_DRAFT.docx");
    expect(versionFileName({ name: "Lumen", release: false, base: null })).toBe("Lumen_DRAFT.docx");
    expect(versionFileName({ name: "Lumen", release: false, base: "1.0", latestCr: "CR-001", tracked: true })).toBe("Lumen_v1.0+CR-001_tracked_DRAFT.docx");
    expect(versionFileName({ name: "Lumen", release: false, base: "0", original: true })).toBe("Lumen_v0_original.docx");
    expect(versionFileName({ name: "A/B:C", release: true, base: "2.0", ext: "pdf" })).toBe("A_B_C_v2.0.pdf");
    expect(versionFileName({ name: "A\\B", release: true, base: "2.0" })).toBe("A_B_v2.0.docx");
  });
});

describe("versionLineage", () => {
  const v = (version: string, cr_ids: string[] = []) => ({ version, cr_ids });
  const history = [v("1.2", ["CR-003"]), v("1.1", ["CR-002"]), v("1.0", ["CR-001"]), v("0.2", ["CR-001"]), v("0.1")];

  it("nháp sau 2 CR từ 1.0 ⇒ gốc 1.0 + CR của chính nó; bản nháp cũ hơn ⇒ CR của nó; release ⇒ không CR", () => {
    expect(versionLineage(history, "1.2")).toEqual({ release: false, base: "1.0", latestCr: "CR-003" });
    expect(versionLineage(history, "1.1")).toEqual({ release: false, base: "1.0", latestCr: "CR-002" });
    expect(versionLineage(history, "1.0")).toEqual({ release: true, base: "1.0", latestCr: null });
  });

  it("trước release đầu ⇒ gốc 0; bản import ⇒ không CR", () => {
    expect(versionLineage(history, "0.2")).toEqual({ release: false, base: "0", latestCr: "CR-001" });
    expect(versionLineage(history, "0.1")).toEqual({ release: false, base: "0", latestCr: null });
  });
});
