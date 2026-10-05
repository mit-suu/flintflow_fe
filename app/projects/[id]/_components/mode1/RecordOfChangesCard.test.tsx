import { fireEvent, screen } from "@testing-library/react";
import { renderWithIntl } from "@/test/intl";
import { describe, expect, it, vi } from "vitest";
import type { RocRow } from "@/types/document";
import RecordOfChangesCard from "./RecordOfChangesCard";

const row = (n: number): RocRow => ({ date: `0${n}/05/2026`, version: `0.${n}`, change_type: "M", in_charge: "An", description: `Thay đổi ${n}` });

describe("RecordOfChangesCard (FLF-252)", () => {
  it("dòng đọc từ file: sửa ô, đổi loại, xoá dòng, thêm dòng ⇒ gọi onChange với danh sách mới", () => {
    const onChange = vi.fn();
    renderWithIntl(<RecordOfChangesCard rows={[row(1), row(2)]} fromFile={2} onChange={onChange} />);
    expect(screen.getByText(/Đọc được 2 dòng lịch sử thay đổi từ file/)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Mô tả dòng 1"), { target: { value: "Bản đầu" } });
    expect(onChange).toHaveBeenLastCalledWith([{ ...row(1), description: "Bản đầu" }, row(2)]);

    fireEvent.change(screen.getByLabelText("Loại thay đổi dòng 2"), { target: { value: "D" } });
    expect(onChange).toHaveBeenLastCalledWith([row(1), { ...row(2), change_type: "D" }]);

    fireEvent.click(screen.getByRole("button", { name: "Xoá dòng 1" }));
    expect(onChange).toHaveBeenLastCalledWith([row(2)]);

    fireEvent.click(screen.getByRole("button", { name: "+ Thêm dòng" }));
    expect(onChange).toHaveBeenLastCalledWith([row(1), row(2), { date: "", version: "", change_type: "M", in_charge: "", description: "" }]);
  });

  it("không tìm thấy bảng ⇒ nói rõ, vẫn thêm dòng tay được", () => {
    renderWithIntl(<RecordOfChangesCard rows={[]} fromFile={0} onChange={vi.fn()} />);
    expect(screen.getByText(/Không tìm thấy bảng Record of Changes trong file/)).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "+ Thêm dòng" })).toBeEnabled();
  });

  it("nhiều dòng (file FlintFlow xuất ra) ⇒ thu gọn 5 dòng, bấm để hiện tất cả", () => {
    renderWithIntl(<RecordOfChangesCard rows={Array.from({ length: 8 }, (_, i) => row(i + 1))} fromFile={8} onChange={vi.fn()} />);
    expect(screen.getAllByLabelText(/^Mô tả dòng/)).toHaveLength(5);
    fireEvent.click(screen.getByRole("button", { name: "Hiện tất cả 8 dòng" }));
    expect(screen.getAllByLabelText(/^Mô tả dòng/)).toHaveLength(8);
  });
});
