import { fireEvent, screen, within } from "@testing-library/react";
import { renderWithIntl } from "@/test/intl";
import { describe, expect, it, vi } from "vitest";
import type { CrLocation } from "@/types/change-request";
import ImpactList from "./ImpactList";

const location = (id: string, over: Partial<CrLocation> = {}): CrLocation => ({
  location_id: id,
  path: `x[id=${id}]`,
  section_id: "fixed:1",
  section_title: "Product Overview",
  current_text: "",
  found_by: ["keyword"],
  entity_paths: [],
  owner_step: null,
  conclusion: null,
  reason: null,
  proposal: { old_text: `text ${id}`, new_text: null, comment_text: null, spine_ops: [] },
  manual: false,
  redo_count: 0,
  verify: null,
  group_id: null,
  ...over,
});

const LOCATIONS = [
  location("L001", { found_by: ["spine_link", "mention"], conclusion: "edit", proposal: { old_text: "a", new_text: "b", comment_text: null, spine_ops: [] } }),
  location("L002", { found_by: ["mention"], conclusion: "edit", proposal: { old_text: "c", new_text: "d", comment_text: null, spine_ops: [] } }),
  location("L003", { found_by: ["keyword"], conclusion: "comment", proposal: { old_text: "e", new_text: null, comment_text: "note", spine_ops: [] } }),
  location("L004", { found_by: ["keyword"], conclusion: "not_related", reason: "chỉ nhắc tên" }),
  location("L005", { found_by: ["spine_link"] }),
];

const tagsOf = (id: string) =>
  within(screen.getByRole("article", { name: `Vị trí ${id}` }))
    .getAllByText(/^(Liên kết field|Nhắc mã|Từ khoá)$/)
    .map((el) => el.textContent);

describe("ImpactList — vị trí ảnh hưởng (C-3, UC-50)", () => {
  it("không có vị trí ⇒ không render", () => {
    const { container } = renderWithIntl(<ImpactList locations={[]} editable onPatch={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("tiêu đề đếm vị trí + tóm tắt theo kết luận, kể cả số chưa kết luận", () => {
    renderWithIntl(<ImpactList locations={LOCATIONS} editable={false} onPatch={vi.fn()} />);
    expect(screen.getByRole("heading", { name: "Vị trí ảnh hưởng (5)" })).toBeInTheDocument();
    expect(screen.getByText("2 sửa · 1 chỉ comment · 1 không liên quan · 1 chưa kết luận")).toBeInTheDocument();
    expect(screen.getAllByRole("article")).toHaveLength(5);
  });

  it("vừa tìm xong (chưa AI đề xuất) ⇒ chỉ đếm chưa kết luận", () => {
    renderWithIntl(<ImpactList locations={[location("L001"), location("L002")]} editable onPatch={vi.fn()} />);
    expect(screen.getByText("2 chưa kết luận")).toBeInTheDocument();
  });

  it("tag found_by của từng vị trí theo nguồn tìm thấy (liên kết field / nhắc mã / từ khoá)", () => {
    renderWithIntl(<ImpactList locations={LOCATIONS} editable={false} onPatch={vi.fn()} />);
    expect(tagsOf("L001")).toEqual(["Liên kết field", "Nhắc mã"]);
    expect(tagsOf("L002")).toEqual(["Nhắc mã"]);
    expect(tagsOf("L003")).toEqual(["Từ khoá"]);
    expect(tagsOf("L005")).toEqual(["Liên kết field"]);
  });

  it("CR đang giữ khoá ở trạng thái sửa được ⇒ mỗi vị trí có “Sửa tay”, lưu gửi kèm location_id đúng", () => {
    const onPatch = vi.fn();
    renderWithIntl(<ImpactList locations={LOCATIONS} editable onPatch={onPatch} />);
    expect(screen.getAllByRole("button", { name: "Sửa tay" })).toHaveLength(5);

    const third = screen.getByRole("article", { name: "Vị trí L003" });
    fireEvent.click(within(third).getByRole("button", { name: "Sửa tay" }));
    fireEvent.click(within(third).getByRole("radio", { name: "Không liên quan" }));
    fireEvent.change(within(third).getByLabelText("Lý do"), { target: { value: "Ngoài phạm vi" } });
    fireEvent.click(within(third).getByRole("button", { name: "Lưu sửa tay" }));
    expect(onPatch).toHaveBeenCalledWith("L003", { conclusion: "not_related", reason: "Ngoài phạm vi" });
  });

  it("CR không cho sửa (paused / đang kiểm / đã khoá duyệt) ⇒ không có nút sửa tay", () => {
    renderWithIntl(<ImpactList locations={LOCATIONS} editable={false} onPatch={vi.fn()} />);
    expect(screen.queryByRole("button", { name: "Sửa tay" })).not.toBeInTheDocument();
  });

  it("đang lưu sửa tay ⇒ nút lưu trong form bị khoá", () => {
    renderWithIntl(<ImpactList locations={[location("L001")]} editable busy onPatch={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Sửa tay" }));
    expect(screen.getByRole("button", { name: "Đang lưu…" })).toBeDisabled();
  });
});
