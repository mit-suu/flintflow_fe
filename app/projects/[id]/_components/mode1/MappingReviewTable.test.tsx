import { fireEvent, screen, within } from "@testing-library/react";
import { renderWithIntl } from "@/test/intl";
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
    renderWithIntl(<MappingReviewTable profile={profile()} onSubmit={vi.fn()} />);

    expect(screen.getByText(/4 heading, 2 dòng độ tin dưới 80%/)).toBeInTheDocument();
    const filter = screen.getByRole("checkbox", { name: "Chỉ hiện dòng độ tin thấp" });
    expect(filter).toBeChecked();
    expect(screen.getByText("3.2.4 Log out of system", HEADING)).toBeInTheDocument();
    expect(screen.getByText("Phụ lục B — Biên bản họp", HEADING)).toBeInTheDocument();
    expect(screen.queryByText("1 Product Overview", HEADING)).not.toBeInTheDocument();
    expect(screen.getByText("62%")).toBeInTheDocument();
    expect(screen.getByText("Nhận theo số mục")).toBeInTheDocument();

    fireEvent.click(filter);
    expect(filter).not.toBeChecked();
    expect(screen.getByText("1 Product Overview", HEADING)).toBeInTheDocument();
    expect(screen.getByText("Nhận theo cấp đề mục")).toBeInTheDocument();
    expect(rowTexts().filter((t) => t.includes("Nhận theo"))).toHaveLength(4);
    expect(rowTexts().some((t) => /B\d{4}/.test(t) && !t.includes("(tạm)"))).toBe(false);
  });

  it("không có dòng độ tin thấp ⇒ mặc định hiện hết; bật lọc thì báo không có dòng nào", () => {
    const high = profile({ heading_map: [heading("B0001", "1 Product Overview", "fixed:1", 0.97)] });
    renderWithIntl(<MappingReviewTable profile={high} onSubmit={vi.fn()} />);
    const filter = screen.getByRole("checkbox", { name: "Chỉ hiện dòng độ tin thấp" });
    expect(filter).not.toBeChecked();
    expect(screen.getByText("1 Product Overview", HEADING)).toBeInTheDocument();

    fireEvent.click(filter);
    expect(screen.getByText(/Không có dòng độ tin thấp/)).toBeInTheDocument();
  });

  it("danh sách section gồm section chuẩn FPT, section tạm feature do BE sinh và “Không khớp”", () => {
    renderWithIntl(<MappingReviewTable profile={profile()} onSubmit={vi.fn()} />);
    const select = screen.getByRole("combobox", { name: "Section cho 3.2.4 Log out of system" });
    expect(select).toHaveValue("feature:@B0007");
    const options = within(select).getAllByRole("option").map((o) => o.textContent);
    expect(options).toContain("1 Product Overview");
    expect(options).toContain("3.1.2 Screen Descriptions");
    expect(options).toContain("Tính năng (tạm) — 3.2.4 Log out of system");
    expect(options.at(-1)).toBe("Không khớp (giữ nguyên, không trích)");
    // section tạm không bị lặp
    expect(options.filter((o) => o === "Tính năng (tạm) — 3.2.4 Log out of system")).toHaveLength(1);
    expect(options.some((o) => /B\d{4}|fixed:/.test(o ?? ""))).toBe(false);
  });

  it("đổi section + sửa cột bảng ⇒ lưu chỉ gửi các dòng đã đổi, kèm confirm_all; cột bỏ trống ⇒ field_path null", () => {
    const onSubmit = vi.fn();
    renderWithIntl(<MappingReviewTable profile={profile()} onSubmit={onSubmit} />);

    fireEvent.change(screen.getByRole("combobox", { name: "Section cho 3.2.4 Log out of system" }), { target: { value: "fixed:3.1.2" } });
    fireEvent.change(screen.getByRole("combobox", { name: "Section cho Phụ lục B — Biên bản họp" }), { target: { value: "fixed:5.3" } });
    fireEvent.change(screen.getByRole("combobox", { name: "Dữ liệu cho cột Actor" }), { target: { value: "actors[].id" } });
    fireEvent.change(screen.getByRole("combobox", { name: "Dữ liệu cho cột Description" }), { target: { value: "" } });
    expect(screen.getByRole("combobox", { name: "Dữ liệu cho cột Description" })).toHaveValue("");
    submit();

    expect(onSubmit).toHaveBeenCalledWith({
      headings: [
        { block_id: "B0007", section_id: "fixed:3.1.2" },
        { block_id: "B0011", section_id: "fixed:5.3" },
      ],
      tables: [
        { block_id: "B0005", column_index: 0, field_path: "actors[].id" },
        { block_id: "B0005", column_index: 1, field_path: null },
      ],
      confirm_all: true,
    });
  });

  it("không đổi gì ⇒ vẫn chốt tất cả như BE đề xuất (mảng rỗng + confirm_all)", () => {
    const onSubmit = vi.fn();
    renderWithIntl(<MappingReviewTable profile={profile()} onSubmit={onSubmit} />);
    submit();
    expect(onSubmit).toHaveBeenCalledWith({ headings: [], tables: [], confirm_all: true });
  });

  it("section bắt buộc chưa có heading ⇒ cảnh báo; gán heading vào section đó thì hết cảnh báo", () => {
    renderWithIntl(<MappingReviewTable profile={profile()} onSubmit={vi.fn()} />);
    expect(screen.getByText(/Chưa có heading nào cho section bắt buộc: 5.3 Application Messages List/)).toBeInTheDocument();

    fireEvent.change(screen.getByRole("combobox", { name: "Section cho Phụ lục B — Biên bản họp" }), { target: { value: "fixed:5.3" } });
    expect(screen.queryByText(/Chưa có heading nào cho section bắt buộc/)).not.toBeInTheDocument();
  });

  it("không có bảng ⇒ không hiện phần cột bảng; đang lưu ⇒ nút khoá", () => {
    renderWithIntl(<MappingReviewTable profile={profile({ table_map: [] })} onSubmit={vi.fn()} busy />);
    expect(screen.queryByText(/Cột trong bảng → dữ liệu SRS/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Đang lưu…" })).toBeDisabled();
  });
});

describe("MappingReviewTable — chọn dữ liệu cho cột theo nhãn, không gõ field_path", () => {
  it("hiện nhãn tiếng Việt, loại bảng; nhóm cùng loại với bảng đứng đầu; có lựa chọn “Không lấy cột này”", () => {
    renderWithIntl(<MappingReviewTable profile={profile()} onSubmit={vi.fn()} />);
    const select = screen.getByRole("combobox", { name: "Dữ liệu cho cột Actor" });
    expect(select).toHaveValue("actors[].name");
    expect(within(select).getByRole("option", { selected: true })).toHaveTextContent("Tác nhân — Tên tác nhân");
    const options = within(select).getAllByRole("option").map((o) => o.textContent);
    expect(options[0]).toBe("Không lấy cột này");
    expect(options[1]).toBe("Tác nhân — Mã tác nhân");
    expect(options).toContain("Thuật ngữ — Định nghĩa");
    expect(options.some((o) => o?.includes("[]"))).toBe(false);
    expect(screen.getByText("Bảng Tác nhân · cột 1")).toBeInTheDocument();
    expect(screen.queryByText(/B0005/)).not.toBeInTheDocument();
  });

  it("cột khác loại với bảng ⇒ cảnh báo không được lấy; field lạ từ BE vẫn giữ trong danh sách", () => {
    renderWithIntl(
      <MappingReviewTable
        profile={profile({ table_map: [column("B0005", 0, "Actor", "actors[].name"), column("B0005", 1, "Ghi chú", "actors[].note")] })}
        onSubmit={vi.fn()}
      />
    );
    expect(screen.getByRole("combobox", { name: "Dữ liệu cho cột Ghi chú" })).toHaveValue("actors[].note");

    fireEvent.change(screen.getByRole("combobox", { name: "Dữ liệu cho cột Ghi chú" }), { target: { value: "glossary[].term" } });
    expect(screen.getByText(/Khác loại với các cột khác của bảng/)).toBeInTheDocument();
  });
});

describe("MappingReviewTable — cột bảng không có tiêu đề (FLF-179)", () => {
  it("header rỗng ⇒ hiện \"Cột N (không có tiêu đề)\" và vẫn gán field được", () => {
    const onSubmit = vi.fn();
    renderWithIntl(<MappingReviewTable profile={profile({ table_map: [column("B0005", 2, "", null, 0.3)] })} onSubmit={onSubmit} />);
    expect(screen.getByText("Cột 3 (không có tiêu đề)")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Dữ liệu cho cột Cột 3 (không có tiêu đề)"), { target: { value: "use_cases[].name" } });
    submit();
    expect(onSubmit.mock.calls[0][0].tables).toEqual([{ block_id: "B0005", column_index: 2, field_path: "use_cases[].name" }]);
  });
});

