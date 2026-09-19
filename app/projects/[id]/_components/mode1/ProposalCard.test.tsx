import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { CrLocation } from "@/types/change-request";
import ProposalCard from "./ProposalCard";

/** Giá trị phần tử dạng JSON khoá sắp xếp như BE `valueText` (FLF-186). */
const json = (value: Record<string, unknown>) =>
  JSON.stringify(
    Object.fromEntries(Object.keys(value).sort().map((k) => [k, value[k]])),
    null,
    2
  );

const UC = { id: "UC-2.4", name: "Log out of system", description: "The user logs out of the current browser session." };
const OLD = json(UC);
const NEW = json({ ...UC, description: "The user is signed out of every device." });

const location = (over: Partial<CrLocation> = {}): CrLocation => ({
  location_id: "L001",
  path: "use_cases[id=UC-2.4]",
  section_id: "fixed:2.2.2",
  section_title: "Use Case Descriptions",
  current_text: OLD,
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

const proposal = (over: Partial<NonNullable<CrLocation["proposal"]>> = {}): NonNullable<CrLocation["proposal"]> => ({
  old_text: OLD,
  new_text: null,
  comment_text: null,
  spine_ops: [],
  ...over,
});

const card = () => screen.getByRole("article", { name: "Vị trí L001" });

describe("ProposalCard — đề xuất cho một phần tử Spine (C-4, UC-81, FLF-186)", () => {
  it("chưa kết luận: hiện path, mục, tóm tắt phần tử, nguồn tìm thấy, bước sở hữu, phần tử liên quan; không có huy hiệu kết luận", () => {
    render(
      <ProposalCard
        location={location({ found_by: ["spine_link", "mention", "keyword"], owner_step: "S-3.2", entity_paths: ["actors[id=A01]"] })}
        editable={false}
        onPatch={vi.fn()}
      />
    );
    const c = card();
    expect(within(c).getByText("use_cases[id=UC-2.4]")).toBeInTheDocument();
    expect(within(c).getByText("Mục: Use Case Descriptions")).toBeInTheDocument();
    expect(within(c).getByText("Log out of system")).toBeInTheDocument();
    expect(within(c).getByText("Liên kết field")).toBeInTheDocument();
    expect(within(c).getByText("Nhắc mã")).toBeInTheDocument();
    expect(within(c).getByText("Từ khoá")).toBeInTheDocument();
    expect(within(c).getByText("· bước S-3.2")).toBeInTheDocument();
    expect(within(c).getByText("liên quan: actors[id=A01]")).toBeInTheDocument();
    expect(within(c).queryByText("Sửa")).not.toBeInTheDocument();
    expect(within(c).queryByRole("button", { name: "Sửa tay" })).not.toBeInTheDocument();
  });

  it("kết luận sửa ⇒ thay đổi theo field: cũ (del) → mới (ins), nhãn “Sửa”, lý do", () => {
    render(<ProposalCard location={location({ conclusion: "edit", reason: "UC-2.4 đổi phạm vi", proposal: proposal({ new_text: NEW }) })} editable={false} onPatch={vi.fn()} />);
    const changes = within(card()).getByLabelText("Thay đổi theo field");
    expect(within(changes).getByText("description")).toBeInTheDocument();
    expect(within(changes).getByText(UC.description).tagName).toBe("DEL");
    expect(within(changes).getByText("The user is signed out of every device.").tagName).toBe("INS");
    expect(within(changes).queryByText("name")).not.toBeInTheDocument();
    expect(within(card()).getByText("Sửa")).toBeInTheDocument();
    expect(within(card()).getByText("Lý do: UC-2.4 đổi phạm vi")).toBeInTheDocument();
  });

  it("kết luận chỉ comment ⇒ nội dung comment, không có thay đổi", () => {
    render(<ProposalCard location={location({ conclusion: "comment", proposal: proposal({ comment_text: "Cần xác nhận với PM" }) })} editable={false} onPatch={vi.fn()} />);
    expect(within(card()).getByText("Chỉ comment")).toBeInTheDocument();
    expect(within(card()).getByText("💬 Cần xác nhận với PM")).toBeInTheDocument();
    expect(within(card()).queryByLabelText("Thay đổi theo field")).not.toBeInTheDocument();
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
          proposal: proposal({ new_text: NEW }),
          verify: { code_ok: false, violations: [{ rule: "path_not_locked", message: "mất khoá" }], ai_flags: [], at: "2026-09-19T00:00:00.000Z" },
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

  it("mặc định kết luận Sửa, giá trị mới = giá trị hiện tại (JSON) ⇒ chưa đổi / JSON sai thì không lưu được; đổi rồi lưu gửi new_value", () => {
    const onPatch = vi.fn();
    render(<ProposalCard location={location()} editable onPatch={onPatch} />);
    open();
    expect(radio("Sửa")).toBeChecked();
    const text = within(card()).getByLabelText("Giá trị mới (JSON)");
    expect(text).toHaveValue(OLD);
    expect(save()).toBeDisabled();

    fireEvent.change(text, { target: { value: "{ không phải json" } });
    expect(within(card()).getByText("JSON chưa hợp lệ.")).toBeInTheDocument();
    expect(save()).toBeDisabled();
    fireEvent.change(text, { target: { value: NEW } });
    // xem trước thay đổi theo field ngay trong form
    expect(within(within(card()).getByLabelText("Sửa tay L001")).getByText("The user is signed out of every device.").tagName).toBe("INS");
    fireEvent.click(save());
    expect(onPatch).toHaveBeenCalledWith({ conclusion: "edit", new_value: { ...UC, description: "The user is signed out of every device." } });
    // lưu xong đóng form
    expect(within(card()).queryByLabelText("Giá trị mới (JSON)")).not.toBeInTheDocument();
  });

  it("không liên quan bắt buộc lý do; lưu gửi reason đã cắt khoảng trắng, không gửi new_value", () => {
    const onPatch = vi.fn();
    render(<ProposalCard location={location({ conclusion: "edit", proposal: proposal({ new_text: NEW }) })} editable onPatch={onPatch} />);
    open();
    fireEvent.click(radio("Không liên quan"));
    expect(within(card()).queryByLabelText("Giá trị mới (JSON)")).not.toBeInTheDocument();
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
