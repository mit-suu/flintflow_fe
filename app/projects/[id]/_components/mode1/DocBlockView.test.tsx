import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { DocBlock } from "@/types/import";
import DocBlockView, { Revisions } from "./DocBlockView";

const P = "650000000000000000000002";

const block = (over: Partial<DocBlock>): DocBlock => ({
  block_id: "B0001",
  doc_version: "0.1",
  kind: "paragraph",
  level: null,
  heading_path: [],
  text: "",
  section_id: null,
  mentions: [],
  editable: true,
  locked_by_cr: null,
  ...over,
});

const byBlock = (id: string) => document.querySelector(`[data-block-id="${id}"]`) as HTMLElement;

describe("DocBlockView — Track Changes (ins/del) và huy hiệu khoá (UC-54)", () => {
  it("Revisions: del gạch bỏ, ins gạch chân, giữ thứ tự và tác giả từng đoạn", () => {
    render(
      <Revisions
        revisions={[
          { kind: "del", text: "one session", author: "CR-001" },
          { kind: "ins", text: "all sessions", author: "CR-001" },
          { kind: "ins", text: "on every device", author: "CR-004" },
        ]}
      />
    );
    const box = screen.getByLabelText("Track Changes");
    const marks = box.querySelectorAll("del, ins");
    expect([...marks].map((m) => `${m.tagName}:${m.textContent}`)).toEqual(["DEL:one session", "INS:all sessions", "INS:on every device"]);
    expect(within(box).getByText("CR-004")).toBeInTheDocument();
  });

  it("block không có revisions (hoặc mảng rỗng) ⇒ không vẽ khung Track Changes", () => {
    render(<DocBlockView projectId={P} blocks={[block({ text: "Plain text." }), block({ block_id: "B0002", text: "Other", revisions: [] })]} />);
    expect(screen.queryByLabelText("Track Changes")).not.toBeInTheDocument();
  });

  it("huy hiệu khoá: link tới CR đang giữ, title nêu CR; block không khoá thì không có huy hiệu", () => {
    render(
      <DocBlockView
        projectId={P}
        blocks={[
          block({ block_id: "B0007", kind: "heading", level: 3, text: "3.2.4 Log out of system", locked_by_cr: "CR-002" }),
          block({ block_id: "B0008", text: "The user logs out." }),
        ]}
      />
    );
    const badge = within(byBlock("B0007")).getByRole("link", { name: /CR-002/ });
    expect(badge).toHaveAttribute("href", `/projects/${P}/change-requests/CR-002`);
    expect(badge).toHaveAttribute("title", "Block đang được CR-002 sửa");
    expect(within(byBlock("B0008")).queryByRole("link")).not.toBeInTheDocument();
  });

  it("block vừa bị khoá vừa có Track Changes ⇒ hiện cả hai", () => {
    render(
      <DocBlockView
        projectId={P}
        blocks={[block({ block_id: "B0010", text: "new", locked_by_cr: "CR-005", revisions: [{ kind: "ins", text: "new", author: "CR-003" }] })]}
      />
    );
    const el = byBlock("B0010");
    expect(within(el).getByRole("link", { name: /CR-005/ })).toBeInTheDocument();
    expect(within(el).getByText("new", { selector: "ins" })).toBeInTheDocument();
  });
});

describe("DocBlockView — các loại block", () => {
  it("rỗng ⇒ báo version không có block", () => {
    render(<DocBlockView projectId={P} blocks={[]} />);
    expect(screen.getByText("Version này không có block nào.")).toBeInTheDocument();
  });

  it("heading theo cấp (cấp lạ dùng kiểu cấp 3), ảnh, chú thích, unsupported không text", () => {
    render(
      <DocBlockView
        projectId={P}
        blocks={[
          block({ block_id: "B0001", kind: "heading", level: 1, text: "1 Product Overview" }),
          block({ block_id: "B0002", kind: "heading", level: 5, text: "Deep heading" }),
          block({ block_id: "B0003", kind: "image", text: "" }),
          block({ block_id: "B0004", kind: "caption", text: "Figure 1: Use case diagram" }),
          block({ block_id: "B0005", kind: "unsupported", text: "", editable: false }),
        ]}
      />
    );
    expect(screen.getByText("1 Product Overview").className).toContain("text-[18px]");
    expect(screen.getByText("Deep heading").className).toContain("text-[14.5px]");
    expect(screen.getByText("[Hình ảnh]")).toBeInTheDocument();
    expect(screen.getByText("Figure 1: Use case diagram").className).toContain("italic");
    expect(screen.getByText("[Nội dung không hỗ trợ] · giữ nguyên, không sửa qua CR")).toBeInTheDocument();
  });

  it("ô bảng sau bảng: ẩn nếu không có gì đặc biệt; hiện nếu có Track Changes hoặc đang được làm nổi", () => {
    render(
      <DocBlockView
        projectId={P}
        highlight={new Set(["B0023"])}
        blocks={[
          block({ block_id: "B0020", kind: "table", text: "Actor | Description\nStudent | Learns" }),
          block({ block_id: "B0021", kind: "table_cell", text: "Student" }),
          block({ block_id: "B0022", kind: "table_cell", text: "Learner", revisions: [{ kind: "ins", text: "Learner", author: "CR-001" }] }),
          block({ block_id: "B0023", kind: "table_cell", text: "Learns" }),
        ]}
      />
    );
    expect(screen.queryByText("Ô bảng: Student")).not.toBeInTheDocument();
    expect(screen.getByText("Ô bảng: Learner")).toBeInTheDocument();
    expect(screen.getByText("Ô bảng: Learns")).toBeInTheDocument();
    expect(byBlock("B0023").className).toContain("ring-1");
    expect(byBlock("B0022").className).not.toContain("ring-1");
  });

  it("ô bảng không đứng sau block bảng (bảng chưa tách) ⇒ vẫn hiện riêng", () => {
    render(
      <DocBlockView
        projectId={P}
        blocks={[
          block({ block_id: "B0030", kind: "heading", level: 2, text: "2.1 Actors" }),
          block({ block_id: "B0031", kind: "table_cell", text: "Student — Enrolls" }),
          block({ block_id: "B0032", kind: "table", text: "A | B" }),
          block({ block_id: "B0033", kind: "paragraph", text: "After table" }),
          block({ block_id: "B0034", kind: "table_cell", text: "Orphan cell" }),
        ]}
      />
    );
    expect(screen.getByText("Ô bảng: Student — Enrolls")).toBeInTheDocument();
    expect(screen.getByText("After table")).toBeInTheDocument();
    // đoạn văn giữa chừng ngắt chuỗi "sau bảng"
    expect(screen.getByText("Ô bảng: Orphan cell")).toBeInTheDocument();
  });
});
