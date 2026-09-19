import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { HeadingMapEntry, TableMapEntry, TemplateProfile } from "@/types/import";
import MappingReviewTable from "./MappingReviewTable";

const heading = (block_id: string, heading_text: string, section_id: string, confidence: number, detected_by: HeadingMapEntry["detected_by"] = "style"): HeadingMapEntry => ({
  block_id,
  heading_text,
  section_id,
  confidence,
  detected_by,
  confirmed: false,
});

const column = (block_id: string, column_index: number, header: string, field_path: string | null, confidence = 0.9): TableMapEntry => ({
  block_id,
  column_index,
  header,
  field_path,
  confidence,
  confirmed: false,
});

const profile = (over: Partial<TemplateProfile> = {}): TemplateProfile => ({
  doc_version: "0.0",
  heading_map: [
    heading("B0001", "1 Product Overview", "fixed:1", 0.97),
    heading("B0004", "2.1 Actors", "fixed:2.1", 0.95, "outline_level"),
    heading("B0007", "3.2.4 Log out of system", "feature:@B0007", 0.62, "numbering_pattern"),
    heading("B0011", "Phụ lục B — Biên bản họp", "unmapped", 0.3),
  ],
  table_map: [column("B0005", 0, "Actor", "actors[].name"), column("B0005", 1, "Description", "actors[].description", 0.55)],
  required_sections: ["fixed:1", "fixed:2.1", "fixed:5.3"],
  language: "en",
  layout: [],
  ...over,
});

const HEADING = { selector: "td div" };
const rowTexts = () => screen.getAllByRole("row").map((r) => r.textContent ?? "");
const submit = () => fireEvent.click(screen.getByRole("button", { name: "Xác nhận mapping" }));

describe("MappingReviewTable — xác nhận mapping heading → section (UC-21, 1.7)", () => {
  it("mặc định chỉ hiện dòng độ tin < 80%; bỏ lọc thì hiện đủ; độ tin + cách nhận heading hiển thị", () => {
    render(<MappingReviewTable profile={profile()} onSubmit={vi.fn()} />);

    expect(screen.getByText(/4 heading, 2 dòng độ tin dưới 80%/)).toBeInTheDocument();
    const filter = screen.getByRole("checkbox", { name: "Chỉ hiện dòng độ tin thấp" });
    expect(filter).toBeChecked();
    expect(screen.getByText("3.2.4 Log out of system", HEADING)).toBeInTheDocument();
    expect(screen.getByText("Phụ lục B — Biên bản họp", HEADING)).toBeInTheDocument();
    expect(screen.queryByText("1 Product Overview", HEADING)).not.toBeInTheDocument();
    expect(screen.getByText("62%")).toBeInTheDocument();
    expect(screen.getByText("B0007 · nhận theo số mục")).toBeInTheDocument();

    fireEvent.click(filter);
    expect(filter).not.toBeChecked();
    expect(screen.getByText("1 Product Overview", HEADING)).toBeInTheDocument();
    expect(screen.getByText("B0004 · nhận theo outline level")).toBeInTheDocument();
    expect(rowTexts().filter((t) => t.includes("nhận theo"))).toHaveLength(4);
  });

  it("không có dòng độ tin thấp ⇒ mặc định hiện hết; bật lọc thì báo không có dòng nào", () => {
    const high = profile({ heading_map: [heading("B0001", "1 Product Overview", "fixed:1", 0.97)] });
    render(<MappingReviewTable profile={high} onSubmit={vi.fn()} />);
    const filter = screen.getByRole("checkbox", { name: "Chỉ hiện dòng độ tin thấp" });
    expect(filter).not.toBeChecked();
    expect(screen.getByText("1 Product Overview", HEADING)).toBeInTheDocument();

    fireEvent.click(filter);
    expect(screen.getByText(/Không có dòng độ tin thấp/)).toBeInTheDocument();
  });

  it("danh sách section gồm section chuẩn FPT, section tạm feature do BE sinh và “Không khớp”", () => {
    render(<MappingReviewTable profile={profile()} onSubmit={vi.fn()} />);
    const select = screen.getByRole("combobox", { name: "Section cho 3.2.4 Log out of system" });
    expect(select).toHaveValue("feature:@B0007");
    const options = within(select).getAllByRole("option").map((o) => o.textContent);
    expect(options).toContain("1 Product Overview");
    expect(options).toContain("3.1.2 Screen Descriptions");
    expect(options).toContain("Feature (tạm) · B0007");
    expect(options.at(-1)).toBe("Không khớp (giữ nguyên, không trích)");
    // section tạm không bị lặp
    expect(options.filter((o) => o === "Feature (tạm) · B0007")).toHaveLength(1);
  });

  it("đổi section + sửa cột bảng ⇒ lưu chỉ gửi các dòng đã đổi, kèm confirm_all; cột bỏ trống ⇒ field_path null", () => {
    const onSubmit = vi.fn();
    render(<MappingReviewTable profile={profile()} onSubmit={onSubmit} />);

    fireEvent.change(screen.getByRole("combobox", { name: "Section cho 3.2.4 Log out of system" }), { target: { value: "fixed:3.1.2" } });
    fireEvent.change(screen.getByRole("combobox", { name: "Section cho Phụ lục B — Biên bản họp" }), { target: { value: "fixed:5.3" } });
    fireEvent.change(screen.getByRole("textbox", { name: "Field cho cột Actor" }), { target: { value: "  actors[].title  " } });
    fireEvent.change(screen.getByRole("textbox", { name: "Field cho cột Description" }), { target: { value: "   " } });
    expect(screen.getByRole("textbox", { name: "Field cho cột Description" })).toHaveValue("");
    submit();

    expect(onSubmit).toHaveBeenCalledWith({
      headings: [
        { block_id: "B0007", section_id: "fixed:3.1.2" },
        { block_id: "B0011", section_id: "fixed:5.3" },
      ],
      tables: [
        { block_id: "B0005", column_index: 0, field_path: "actors[].title" },
        { block_id: "B0005", column_index: 1, field_path: null },
      ],
      confirm_all: true,
    });
  });

  it("không đổi gì ⇒ vẫn chốt tất cả như BE đề xuất (mảng rỗng + confirm_all)", () => {
    const onSubmit = vi.fn();
    render(<MappingReviewTable profile={profile()} onSubmit={onSubmit} />);
    submit();
    expect(onSubmit).toHaveBeenCalledWith({ headings: [], tables: [], confirm_all: true });
  });

  it("section bắt buộc chưa có heading ⇒ cảnh báo; gán heading vào section đó thì hết cảnh báo", () => {
    render(<MappingReviewTable profile={profile()} onSubmit={vi.fn()} />);
    expect(screen.getByText(/Chưa có heading nào cho section bắt buộc: 5.3 Application Messages List/)).toBeInTheDocument();

    fireEvent.change(screen.getByRole("combobox", { name: "Section cho Phụ lục B — Biên bản họp" }), { target: { value: "fixed:5.3" } });
    expect(screen.queryByText(/Chưa có heading nào cho section bắt buộc/)).not.toBeInTheDocument();
  });

  it("không có bảng ⇒ không hiện phần cột bảng; đang lưu ⇒ nút khoá", () => {
    render(<MappingReviewTable profile={profile({ table_map: [] })} onSubmit={vi.fn()} busy />);
    expect(screen.queryByText(/Cột bảng → field/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Đang lưu…" })).toBeDisabled();
  });
});

describe("MappingReviewTable — cột bảng không có tiêu đề (FLF-179)", () => {
  it("header rỗng ⇒ hiện \"Cột N (không có tiêu đề)\" và vẫn gán field được", () => {
    const onSubmit = vi.fn();
    render(<MappingReviewTable profile={profile({ table_map: [column("B0005", 2, "", null, 0.3)] })} onSubmit={onSubmit} />);
    expect(screen.getByText("Cột 3 (không có tiêu đề)")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Field cho cột Cột 3 (không có tiêu đề)"), { target: { value: "use_cases[].name" } });
    submit();
    expect(onSubmit.mock.calls[0][0].tables).toEqual([{ block_id: "B0005", column_index: 2, field_path: "use_cases[].name" }]);
  });
});

