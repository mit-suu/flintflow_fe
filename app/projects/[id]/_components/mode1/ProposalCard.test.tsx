import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { CrLocation } from "@/types/change-request";
import type { DocBlock } from "@/types/import";
import ProposalCard from "./ProposalCard";

const block = (over: Partial<DocBlock> = {}): DocBlock => ({
  block_id: "B0008",
  doc_version: "0.0",
  kind: "paragraph",
  level: null,
  heading_path: ["3.2.4 Log out of system"],
  text: "The user logs out of the current browser session.",
  section_id: "fixed:3.1.2",
  mentions: [],
  editable: true,
  locked_by_cr: "CR-001",
  ...over,
});

const location = (over: Partial<CrLocation> = {}): CrLocation => ({
  location_id: "L001",
  block_id: "B0008",
  block: block(),
  found_by: ["mention"],
  entity_paths: [],
  owner_step: null,
  conclusion: null,
  reason: null,
  proposal: null,
  manual: false,
  redo_count: 0,
  verify: null,
  group_id: null,
  ...over,
});

const OLD = "The user logs out of the current browser session.";
const proposal = (over: Partial<NonNullable<CrLocation["proposal"]>> = {}): NonNullable<CrLocation["proposal"]> => ({
  old_text: OLD,
  new_text: null,
  comment_text: null,
  spine_ops: [],
  ...over,
});

const card = () => screen.getByRole("article", { name: "Vị trí L001" });

describe("ProposalCard — đề xuất cho một vị trí (C-4, UC-81)", () => {
  it("chưa kết luận: hiện block, nguồn tìm thấy, bước sở hữu, đường dẫn field; không có huy hiệu kết luận", () => {
    render(
      <ProposalCard
        location={location({ found_by: ["spine_link", "mention", "keyword"], owner_step: "S-3.2", entity_paths: ["use_cases[id=UC-2.4].flow"] })}
        editable={false}
        onPatch={vi.fn()}
      />
    );
    const c = card();
    expect(within(c).getByText("B0008")).toBeInTheDocument();
    expect(within(c).getByText("Liên kết field")).toBeInTheDocument();
    expect(within(c).getByText("Nhắc mã")).toBeInTheDocument();
    expect(within(c).getByText("Từ khoá")).toBeInTheDocument();
    expect(within(c).getByText("· bước S-3.2")).toBeInTheDocument();
    expect(within(c).getByText("3.2.4 Log out of system")).toBeInTheDocument();
    expect(within(c).getByText("use_cases[id=UC-2.4].flow")).toBeInTheDocument();
    expect(within(c).getByText(OLD)).toBeInTheDocument();
    expect(within(c).queryByText("Sửa")).not.toBeInTheDocument();
    expect(within(c).queryByRole("button", { name: "Sửa tay" })).not.toBeInTheDocument();
  });

  it("kết luận sửa ⇒ diff cũ (del) / mới (ins), nhãn “Sửa”, lý do", () => {
    render(
      <ProposalCard
        location={location({ conclusion: "edit", reason: "UC-2.4 đổi phạm vi", proposal: proposal({ new_text: "The user is signed out of every device." }) })}
        editable={false}
        onPatch={vi.fn()}
      />
    );
    const changes = within(card()).getByLabelText("Track Changes");
    expect(within(changes).getByText(OLD).tagName).toBe("DEL");
    expect(within(changes).getByText("The user is signed out of every device.").tagName).toBe("INS");
    expect(within(changes).getByText("Cũ")).toBeInTheDocument();
    expect(within(changes).getByText("Mới")).toBeInTheDocument();
    expect(within(card()).getByText("Sửa")).toBeInTheDocument();
    expect(within(card()).getByText("Lý do: UC-2.4 đổi phạm vi")).toBeInTheDocument();
  });

  it("kết luận chỉ comment ⇒ text giữ nguyên + nội dung comment, không có diff", () => {
    render(<ProposalCard location={location({ conclusion: "comment", proposal: proposal({ comment_text: "Cần xác nhận với PM" }) })} editable={false} onPatch={vi.fn()} />);
    expect(within(card()).getByText("Chỉ comment")).toBeInTheDocument();
    expect(within(card()).getByText("💬 Cần xác nhận với PM")).toBeInTheDocument();
    expect(within(card()).getByText(OLD).tagName).toBe("P");
    expect(within(card()).queryByLabelText("Track Changes")).not.toBeInTheDocument();
  });

  it("kết luận không liên quan ⇒ nhãn + lý do; sửa tay có huy hiệu “sửa tay”", () => {
    render(
      <ProposalCard location={location({ conclusion: "not_related", reason: "Chỉ nhắc tên, không đổi nghĩa", manual: true, proposal: proposal() })} editable={false} onPatch={vi.fn()} />
    );
    expect(within(card()).getByText("Không liên quan")).toBeInTheDocument();
    expect(within(card()).getByText("Lý do: Chỉ nhắc tên, không đổi nghĩa")).toBeInTheDocument();
    expect(within(card()).getByText("sửa tay")).toBeInTheDocument();
  });

  it("kiểm trượt ⇒ viền đỏ + kết quả kiểm trong thẻ", () => {
    render(
      <ProposalCard
        location={location({
          conclusion: "edit",
          proposal: proposal({ new_text: "FAIL" }),
          verify: { code_ok: false, violations: [{ rule: "OLD_TEXT", message: "old text lệch" }], ai_flags: [], at: "2026-09-19T00:00:00.000Z" },
        })}
        editable={false}
        onPatch={vi.fn()}
      />
    );
    expect(card().className).toContain("border-[#F2CACA]");
    expect(within(card()).getByText("Kiểm code: trượt")).toBeInTheDocument();
  });
});

describe("ProposalCard — sửa tay (3.9)", () => {
  const open = () => fireEvent.click(within(card()).getByRole("button", { name: "Sửa tay" }));
  const save = () => within(card()).getByRole("button", { name: "Lưu sửa tay" });
  const radio = (label: string) => within(card()).getByRole("radio", { name: label });

  it("mặc định kết luận Sửa, nội dung mới = text cũ ⇒ chưa đổi thì không lưu được; đổi rồi lưu gửi new_text", () => {
    const onPatch = vi.fn();
    render(<ProposalCard location={location()} editable onPatch={onPatch} />);
    open();
    expect(radio("Sửa")).toBeChecked();
    const text = within(card()).getByLabelText("Nội dung mới");
    expect(text).toHaveValue(OLD);
    expect(save()).toBeDisabled();

    fireEvent.change(text, { target: { value: "   " } });
    expect(save()).toBeDisabled();
    fireEvent.change(text, { target: { value: "The user is signed out of every device." } });
    fireEvent.click(save());
    expect(onPatch).toHaveBeenCalledWith({ conclusion: "edit", new_text: "The user is signed out of every device." });
    // lưu xong đóng form
    expect(within(card()).queryByLabelText("Nội dung mới")).not.toBeInTheDocument();
  });

  it("không liên quan bắt buộc lý do; lưu gửi reason đã cắt khoảng trắng, không gửi new_text", () => {
    const onPatch = vi.fn();
    render(<ProposalCard location={location({ conclusion: "edit", proposal: proposal({ new_text: "x" }) })} editable onPatch={onPatch} />);
    open();
    fireEvent.click(radio("Không liên quan"));
    expect(within(card()).queryByLabelText("Nội dung mới")).not.toBeInTheDocument();
    const reason = within(card()).getByLabelText("Lý do");
    expect(reason).toHaveAttribute("placeholder", "Lý do không liên quan (bắt buộc)");
    expect(save()).toBeDisabled();

    fireEvent.change(reason, { target: { value: "  Chỉ nhắc tên  " } });
    fireEvent.click(save());
    expect(onPatch).toHaveBeenCalledWith({ conclusion: "not_related", reason: "Chỉ nhắc tên" });
  });

  it("chỉ comment bắt buộc nội dung comment; lý do tuỳ chọn", () => {
    const onPatch = vi.fn();
    render(<ProposalCard location={location()} editable onPatch={onPatch} />);
    open();
    fireEvent.click(radio("Chỉ comment"));
    expect(within(card()).getByLabelText("Lý do")).toHaveAttribute("placeholder", "Lý do (tuỳ chọn)");
    expect(save()).toBeDisabled();
    fireEvent.change(within(card()).getByLabelText("Nội dung comment"), { target: { value: " Xác nhận với PM " } });
    fireEvent.click(save());
    expect(onPatch).toHaveBeenCalledWith({ conclusion: "comment", comment_text: "Xác nhận với PM" });
  });

  it("mở lại form giữ giá trị đề xuất hiện có; Huỷ đóng form không gọi onPatch; đang lưu ⇒ nút khoá", () => {
    const onPatch = vi.fn();
    const loc = location({ conclusion: "comment", reason: "cũ", proposal: proposal({ comment_text: "Ghi chú AI" }) });
    const { rerender } = render(<ProposalCard location={loc} editable onPatch={onPatch} />);
    open();
    expect(radio("Chỉ comment")).toBeChecked();
    expect(within(card()).getByLabelText("Nội dung comment")).toHaveValue("Ghi chú AI");
    expect(within(card()).getByLabelText("Lý do")).toHaveValue("cũ");
    fireEvent.click(within(card()).getByRole("button", { name: "Huỷ" }));
    expect(within(card()).queryByLabelText("Nội dung comment")).not.toBeInTheDocument();
    expect(onPatch).not.toHaveBeenCalled();

    rerender(<ProposalCard location={loc} editable onPatch={onPatch} busy />);
    open();
    expect(within(card()).getByRole("button", { name: "Đang lưu…" })).toBeDisabled();
  });
});
