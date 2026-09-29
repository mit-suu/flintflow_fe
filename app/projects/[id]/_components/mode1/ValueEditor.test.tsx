import { fireEvent, screen } from "@testing-library/react";
import { renderWithIntl } from "@/test/intl";
import { describe, expect, it, vi } from "vitest";
import ValueEditor from "./ValueEditor";

/** Phase 8 — "Tự sửa" một phần trong chat: từng trường có nhãn, mục riêng theo đoạn, không bắt gõ JSON. */
describe("ValueEditor", () => {
  it("trường chữ + danh sách: sửa theo nhãn, mã giữ nguyên, xem trước rồi lưu", () => {
    const old = JSON.stringify({ id: "NFR-01", statement: "Phản hồi trong 2 giây", tags: ["hiệu năng"] });
    const onSave = vi.fn();
    renderWithIntl(<ValueEditor oldText={old} startText={old} onSave={onSave} />);
    expect(screen.queryByDisplayValue("NFR-01")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Lưu bản tự sửa" })).toBeDisabled();

    fireEvent.change(screen.getByDisplayValue("Phản hồi trong 2 giây"), { target: { value: "Phản hồi trong 1 giây" } });
    fireEvent.change(screen.getByDisplayValue("hiệu năng"), { target: { value: "hiệu năng\ntra cứu" } });
    expect(screen.getByText("Xem trước thay đổi")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Lưu bản tự sửa" }));
    expect(onSave).toHaveBeenCalledWith({ id: "NFR-01", statement: "Phản hồi trong 1 giây", tags: ["hiệu năng", "tra cứu"] });
  });

  it("mục riêng: sửa đoạn, sửa bảng (hàng / ô), thêm đoạn; ảnh giữ nguyên", () => {
    const old = JSON.stringify({
      id: "CS02",
      heading: "Team Notes",
      level: 2,
      source: "import",
      blocks: [
        { kind: "paragraph", text: "Họp hằng tuần", rows: null, image_ref: null },
        { kind: "table", text: "", rows: [["Ngày", "Việc"], ["T2", "Họp"]], image_ref: null },
        { kind: "image", text: "", rows: null, image_ref: "word/media/image1.png" },
      ],
    });
    const onSave = vi.fn();
    renderWithIntl(<ValueEditor oldText={old} startText={old} onSave={onSave} />);
    expect(screen.getByText("(ảnh trong tài liệu — giữ nguyên)")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Đoạn 1"), { target: { value: "Họp mỗi thứ Hai" } });
    fireEvent.change(screen.getByLabelText("Bảng 2"), { target: { value: "Ngày | Việc\nT2 | Họp\nT6 | Tổng kết" } });
    fireEvent.click(screen.getByRole("button", { name: "+ Thêm đoạn" }));
    fireEvent.change(screen.getByLabelText("Đoạn 4"), { target: { value: "Ghi chú mới" } });
    fireEvent.click(screen.getByRole("button", { name: "Lưu bản tự sửa" }));

    const saved = onSave.mock.calls[0][0];
    expect(saved).toMatchObject({ id: "CS02", level: 2, source: "import", heading: "Team Notes" });
    expect(saved.blocks.map((b: { kind: string }) => b.kind)).toEqual(["paragraph", "table", "image", "paragraph"]);
    expect(saved.blocks[0].text).toBe("Họp mỗi thứ Hai");
    expect(saved.blocks[1].rows).toEqual([["Ngày", "Việc"], ["T2", "Họp"], ["T6", "Tổng kết"]]);
    expect(saved.blocks[2].image_ref).toBe("word/media/image1.png");
    expect(saved.blocks[3].text).toBe("Ghi chú mới");
  });
});
