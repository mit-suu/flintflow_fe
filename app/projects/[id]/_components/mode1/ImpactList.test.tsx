import { screen, within } from "@testing-library/react";
import { renderWithIntl } from "@/test/intl";
import { describe, expect, it } from "vitest";
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
  proposal: { old_text: `text ${id}`, new_text: null, comment_text: null, spine_ops: [], assumptions: [] },
  manual: false,
  redo_count: 0,
  verify: null,
  group_id: null,
  ...over,
});

const LOCATIONS = [
  location("L001", { found_by: ["spine_link", "mention"], conclusion: "edit", proposal: { old_text: "a", new_text: "b", comment_text: null, spine_ops: [], assumptions: [] } }),
  location("L002", { found_by: ["mention"], conclusion: "edit", proposal: { old_text: "c", new_text: "d", comment_text: null, spine_ops: [], assumptions: [] } }),
  location("L003", { found_by: ["keyword"], conclusion: "comment", proposal: { old_text: "e", new_text: null, comment_text: "note", spine_ops: [], assumptions: [] } }),
  location("L004", { found_by: ["keyword"], conclusion: "not_related", reason: "chỉ nhắc tên" }),
  location("L005", { found_by: ["spine_link"] }),
];

const tagsOf = (id: string) =>
  within(screen.getByRole("article", { name: `Vị trí ${id}` }))
    .getAllByText(/^(Liên kết field|Nhắc mã|Từ khoá)$/)
    .map((el) => el.textContent);

describe("ImpactList — vị trí ảnh hưởng (C-3, UC-50)", () => {
  it("không có vị trí ⇒ không render", () => {
    const { container } = renderWithIntl(<ImpactList locations={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("tiêu đề đếm vị trí + tóm tắt theo kết luận, kể cả số chưa kết luận", () => {
    renderWithIntl(<ImpactList locations={LOCATIONS} />);
    expect(screen.getByRole("heading", { name: "Vị trí ảnh hưởng (5)" })).toBeInTheDocument();
    expect(screen.getByText("2 sửa · 1 chỉ comment · 1 không liên quan · 1 chưa kết luận")).toBeInTheDocument();
    expect(screen.getAllByRole("article")).toHaveLength(5);
  });

  it("vừa tìm xong (chưa AI đề xuất) ⇒ chỉ đếm chưa kết luận", () => {
    renderWithIntl(<ImpactList locations={[location("L001"), location("L002")]} />);
    expect(screen.getByText("2 chưa kết luận")).toBeInTheDocument();
  });

  // FLF-279 phần B (§4.17): vector THAY keyword khi có; tắt vector ⇒ dòng tóm tắt y như cũ.
  it("đếm riêng vị trí mà gần nghĩa là lý do duy nhất; vị trí chỉ có keyword không tính", () => {
    renderWithIntl(
      <ImpactList
        locations={[
          location("L001", { found_by: ["vector"], vector_score: 0.87 }),
          location("L002", { found_by: ["vector"], vector_score: 0.83 }),
          // Có liên kết field ⇒ không phải "chỉ nhờ nghĩa"
          location("L003", { found_by: ["spine_link", "vector"], vector_score: 0.91 }),
          // Trùng TỪ, không phải gần NGHĨA — tuy cũng là truy hồi
          location("L004", { found_by: ["keyword"] }),
        ]}
      />
    );
    expect(screen.getByText("4 chưa kết luận · 2 tìm theo nghĩa")).toBeInTheDocument();
  });

  it("không vị trí nào từ vector (vector tắt) ⇒ dòng tóm tắt không nhắc gì tới nghĩa", () => {
    renderWithIntl(<ImpactList locations={LOCATIONS} />);
    expect(screen.queryByText(/tìm theo nghĩa/)).not.toBeInTheDocument();
  });

  it("tag found_by của từng vị trí theo nguồn tìm thấy (liên kết field / nhắc mã / từ khoá)", () => {
    renderWithIntl(<ImpactList locations={LOCATIONS} />);
    expect(tagsOf("L001")).toEqual(["Liên kết field", "Nhắc mã"]);
    expect(tagsOf("L002")).toEqual(["Nhắc mã"]);
    expect(tagsOf("L003")).toEqual(["Từ khoá"]);
    expect(tagsOf("L005")).toEqual(["Liên kết field"]);
  });

  it("FLF-375: danh sách chỉ đọc — không có nút sửa tay / sửa trực tiếp ở bất kỳ vị trí nào", () => {
    renderWithIntl(<ImpactList locations={LOCATIONS} />);
    expect(screen.getAllByRole("article")).toHaveLength(5);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Giá trị mới (JSON)")).not.toBeInTheDocument();
  });
});
