import { fireEvent, screen } from "@testing-library/react";
import { renderWithIntl } from "@/test/intl";
import { describe, expect, it, vi } from "vitest";
import type { ReviewField } from "@/types/import";
import FieldsReview, { textToValue, valueToText } from "./FieldsReview";

const field = (path: string, value: unknown, over: Partial<ReviewField> = {}): ReviewField => ({
  section_id: "fixed:2.1",
  path,
  value,
  confidence: 0.55,
  source_block_ids: ["B0005"],
  origin: "ai",
  confirmed: false,
  ...over,
});

const FIELDS: ReviewField[] = [
  field("actors[id=A02].kind", "human"),
  field("nfrs[id=NFR-P02].threshold_ms", 500, { section_id: "fixed:4.2.3", confidence: 0.61, source_block_ids: ["B0010"] }),
  field("actors[id=A01].aliases", ["Learner", "Student"], { origin: "deterministic", source_block_ids: [] }),
  field("project.code", "123"),
];

const box = (path: string) => screen.getByRole("textbox", { name: `Giá trị ${path}` });
const confirm = () => fireEvent.click(screen.getByRole("button", { name: "Xác nhận tất cả field" }));

describe("valueToText / textToValue — giữ kiểu gốc khi sửa", () => {
  it("chuỗi giữ nguyên; kiểu khác hiển thị dạng JSON", () => {
    expect(valueToText("human")).toBe("human");
    expect(valueToText(500)).toBe("500");
    expect(valueToText(["a", "b"])).toBe('["a","b"]');
    expect(valueToText({ a: 1 })).toBe('{"a":1}');
    expect(valueToText(null)).toBe("null");
    expect(valueToText(true)).toBe("true");
  });

  it("gốc là chuỗi ⇒ luôn trả chuỗi (kể cả khi text trông như số/JSON)", () => {
    expect(textToValue("123", "abc")).toBe("123");
    expect(textToValue('["x"]', "abc")).toBe('["x"]');
  });

  it("gốc không phải chuỗi ⇒ parse JSON được thì giữ kiểu, không được thì thành chuỗi", () => {
    expect(textToValue("750", 500)).toBe(750);
    expect(textToValue('["Learner"]', ["a"])).toEqual(["Learner"]);
    expect(textToValue('{"b":2}', { a: 1 })).toEqual({ b: 2 });
    expect(textToValue("false", true)).toBe(false);
    expect(textToValue("khoảng nửa giây", 500)).toBe("khoảng nửa giây");
  });
});

describe("FieldsReview — xác nhận field độ tin thấp (UC-22, 1.9)", () => {
  it("phase 5: field đọc từ ảnh diagram ⇒ nhãn 'từ ảnh' + nguồn 'AI đọc từ ảnh'; nhắc sau v0 chỉ sửa qua CR", () => {
    renderWithIntl(<FieldsReview fields={[field("actors[id=A09].name", "Guest", { origin: "vision", confidence: 0.7, section_id: "fixed:2.2.1", source_block_ids: ["B0012"] })]} onSubmit={vi.fn()} />);
    expect(screen.getByText("từ ảnh")).toBeInTheDocument();
    expect(screen.getByText("độ tin 70%")).toBeInTheDocument();
    expect(screen.getByText(/Nguồn: B0012 · AI đọc từ ảnh/)).toBeInTheDocument();
    expect(screen.getByText(/mọi thay đổi đi qua change request/)).toBeInTheDocument();
  });

  it("hiện path, section, độ tin, block nguồn và cách trích của từng field", () => {
    renderWithIntl(<FieldsReview fields={FIELDS} onSubmit={vi.fn()} />);
    expect(screen.getByText(/4 field AI chưa chắc/)).toBeInTheDocument();
    expect(screen.getByText("nfrs[id=NFR-P02].threshold_ms")).toBeInTheDocument();
    expect(screen.getByText("· 4.2.3 Performance")).toBeInTheDocument();
    expect(screen.getByText("độ tin 61%")).toBeInTheDocument();
    expect(screen.getByText(/Nguồn: B0010 · AI trích/)).toBeInTheDocument();
    expect(screen.getByText(/Nguồn: — · trích tất định/)).toBeInTheDocument();
    // chỉ field đọc từ ảnh mới có nhãn "từ ảnh"
    expect(screen.queryByText("từ ảnh")).not.toBeInTheDocument();
    expect(box("nfrs[id=NFR-P02].threshold_ms")).toHaveValue("500");
    expect(box("actors[id=A01].aliases")).toHaveValue('["Learner","Student"]');
  });

  it("sửa giá trị ⇒ đánh dấu đã sửa; xác nhận gửi field đã đổi với kiểu gốc + confirm_all", () => {
    const onSubmit = vi.fn();
    renderWithIntl(<FieldsReview fields={FIELDS} onSubmit={onSubmit} />);

    fireEvent.change(box("actors[id=A02].kind"), { target: { value: "system" } });
    fireEvent.change(box("nfrs[id=NFR-P02].threshold_ms"), { target: { value: "750" } });
    fireEvent.change(box("actors[id=A01].aliases"), { target: { value: '["Learner"]' } });
    fireEvent.change(box("project.code"), { target: { value: "456" } });
    expect(screen.getAllByText("· đã sửa")).toHaveLength(4);
    confirm();

    expect(onSubmit).toHaveBeenCalledWith({
      fields: [
        { section_id: "fixed:2.1", path: "actors[id=A02].kind", confirmed: true, edited_value: "system" },
        { section_id: "fixed:4.2.3", path: "nfrs[id=NFR-P02].threshold_ms", confirmed: true, edited_value: 750 },
        { section_id: "fixed:2.1", path: "actors[id=A01].aliases", confirmed: true, edited_value: ["Learner"] },
        { section_id: "fixed:2.1", path: "project.code", confirmed: true, edited_value: "456" },
      ],
      confirm_all: true,
    });
  });

  it("text không còn là JSON hợp lệ ⇒ gửi dạng chuỗi (BE validate)", () => {
    const onSubmit = vi.fn();
    renderWithIntl(<FieldsReview fields={FIELDS} onSubmit={onSubmit} />);
    fireEvent.change(box("nfrs[id=NFR-P02].threshold_ms"), { target: { value: "dưới 1 giây" } });
    confirm();
    expect(onSubmit.mock.calls[0][0].fields).toEqual([
      { section_id: "fixed:4.2.3", path: "nfrs[id=NFR-P02].threshold_ms", confirmed: true, edited_value: "dưới 1 giây" },
    ]);
  });

  it("sửa rồi đổi về như cũ ⇒ không tính là sửa, chỉ chốt tất cả", () => {
    const onSubmit = vi.fn();
    renderWithIntl(<FieldsReview fields={FIELDS} onSubmit={onSubmit} />);
    fireEvent.change(box("actors[id=A02].kind"), { target: { value: "system" } });
    fireEvent.change(box("actors[id=A02].kind"), { target: { value: "human" } });
    expect(screen.queryByText("· đã sửa")).not.toBeInTheDocument();
    confirm();
    expect(onSubmit).toHaveBeenCalledWith({ fields: [], confirm_all: true });
  });

  it("đang lưu ⇒ nút khoá; không có field vẫn cho xác nhận", () => {
    const onSubmit = vi.fn();
    const { rerender } = renderWithIntl(<FieldsReview fields={FIELDS} onSubmit={onSubmit} busy />);
    expect(screen.getByRole("button", { name: "Đang lưu…" })).toBeDisabled();

    rerender(<FieldsReview fields={[]} onSubmit={onSubmit} />);
    expect(screen.getByText(/0 field AI chưa chắc/)).toBeInTheDocument();
    confirm();
    expect(onSubmit).toHaveBeenCalledWith({ fields: [], confirm_all: true });
  });
});
