import { describe, expect, it } from "vitest";
import { crPrefillHref, readChatCrDraft } from "./prefill";

/** FLF-375: CR chỉ tạo bằng chat — lối vào khác mở khung chat với câu yêu cầu + nguồn điền sẵn. */
const paramsOf = (href: string) => new URL(href, "http://x").searchParams;

describe("crPrefillHref", () => {
  it("dựng link khung chat (crdraft=1) với câu = tiêu đề + mô tả và các field nguồn; không còn panel=cr / new=1", () => {
    const href = crPrefillHref("p1", {
      title: "Đổi tên actor",
      description: "Learner ⇒ Student",
      source: "viewer_comment",
      ref: "CM-001",
      requester: "Viewer Lan",
      preview_id: "pv-1",
      comment_id: "CM-001",
    });
    expect(href.startsWith("/projects/p1?crdraft=1&")).toBe(true);
    expect(href).not.toContain("panel=cr");
    expect(href).not.toContain("new=1");
    const p = paramsOf(href);
    expect(p.get("text")).toBe("Đổi tên actor\nLearner ⇒ Student");
    expect(p.get("source")).toBe("viewer_comment");
    expect(p.get("ref")).toBe("CM-001");
    expect(p.get("requester")).toBe("Viewer Lan");
    expect(p.get("preview_id")).toBe("pv-1");
    expect(p.get("comment_id")).toBe("CM-001");
  });

  it("tiêu đề trùng mô tả ⇒ câu chỉ đặt một lần; field trống không lên link", () => {
    const href = crPrefillHref("p1", { title: "Thêm NFR", description: "Thêm NFR" });
    expect(paramsOf(href).get("text")).toBe("Thêm NFR");
    expect(href).not.toMatch(/source=|ref=|requester=|preview_id=|comment_id=/);
    expect(crPrefillHref("p1", {})).toBe("/projects/p1?crdraft=1");
  });
});

describe("readChatCrDraft", () => {
  it("đọc lại đúng những gì crPrefillHref ghi", () => {
    const href = crPrefillHref("p1", { title: "Sửa theo gap report", description: "- Thiếu mục 5.3", source: "gap_report", ref: "Gap report bản 0.3" });
    expect(readChatCrDraft(paramsOf(href))).toEqual({ text: "Sửa theo gap report\n- Thiếu mục 5.3", source: "gap_report", ref: "Gap report bản 0.3" });
  });

  it("không phải link điền sẵn ⇒ null", () => {
    expect(readChatCrDraft(new URLSearchParams("panel=cr"))).toBeNull();
    expect(readChatCrDraft(new URLSearchParams(""))).toBeNull();
  });

  it("link cũ (new=1&title&description) vẫn đọc được; nguồn lạ bị bỏ", () => {
    const draft = readChatCrDraft(new URLSearchParams("panel=cr&new=1&title=A&description=B&source=hacker"));
    expect(draft).toEqual({ text: "A\nB" });
    expect(draft?.source).toBeUndefined();
  });
});
