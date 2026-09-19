import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import UploadStep, { MAX_IMPORT_BYTES } from "./UploadStep";

const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const docx = (name = "SRS_Lumen.docx", size?: number) => {
  const file = new File(["PK mock"], name, { type: DOCX_MIME });
  if (size !== undefined) Object.defineProperty(file, "size", { value: size });
  return file;
};

const DEFAULT_TITLE = "Tải lên SRS có sẵn (.docx)";
const zone = (name = DEFAULT_TITLE) => screen.getByRole("button", { name });
const drop = (target: HTMLElement, file: File) => fireEvent.drop(target, { dataTransfer: { files: [file] } });

describe("UploadStep — kéo thả / chọn file .docx (UC-20, 1.1)", () => {
  it("chọn file qua hộp chọn ⇒ gọi onUpload với đúng file; hộp chọn chỉ nhận .docx", () => {
    const onUpload = vi.fn();
    render(<UploadStep onUpload={onUpload} />);
    const input = screen.getByTestId("docx-input");
    expect(input).toHaveAttribute("accept", `.docx,${DOCX_MIME}`);

    const file = docx();
    fireEvent.change(input, { target: { files: [file] } });
    expect(onUpload).toHaveBeenCalledTimes(1);
    expect(onUpload).toHaveBeenCalledWith(file);
  });

  it("kéo thả file ⇒ gọi onUpload; kéo qua đổi viền, rời đi thì trả lại", () => {
    const onUpload = vi.fn();
    render(<UploadStep onUpload={onUpload} />);
    const target = zone();

    fireEvent.dragOver(target);
    expect(target.className).toContain("border-[#4F46E5] bg-[#F4F3FE]");
    fireEvent.dragLeave(target);
    expect(target.className).not.toContain("bg-[#F4F3FE]");

    const file = docx("SRS_keo_tha.docx");
    drop(target, file);
    expect(onUpload).toHaveBeenCalledWith(file);
    expect(target.className).not.toContain("bg-[#F4F3FE]");
  });

  it("file lớn hơn 10MB (kéo thả hoặc chọn) ⇒ báo lỗi, không gọi upload; chọn lại file hợp lệ thì xoá lỗi", () => {
    const onUpload = vi.fn();
    render(<UploadStep onUpload={onUpload} />);

    drop(zone(), docx("to.docx", MAX_IMPORT_BYTES + 1));
    expect(screen.getByText(/File to\.docx lớn hơn 10MB/)).toBeInTheDocument();
    fireEvent.change(screen.getByTestId("docx-input"), { target: { files: [docx("to2.docx", 20 * 1024 * 1024)] } });
    expect(screen.getByText(/File to2\.docx lớn hơn 10MB/)).toBeInTheDocument();
    expect(onUpload).not.toHaveBeenCalled();

    const ok = docx("vua.docx", MAX_IMPORT_BYTES); // đúng 10MB vẫn nhận
    fireEvent.change(screen.getByTestId("docx-input"), { target: { files: [ok] } });
    expect(onUpload).toHaveBeenCalledWith(ok);
    expect(screen.queryByText(/lớn hơn 10MB/)).not.toBeInTheDocument();
  });

  it("file không phải .docx kéo thả vào: FE không tự chặn theo đuôi mà gửi lên để BE kiểm magic bytes (NOT_DOCX / LEGACY_DOC)", () => {
    const onUpload = vi.fn();
    render(<UploadStep onUpload={onUpload} />);
    const pdf = new File(["%PDF"], "SRS.pdf", { type: "application/pdf" });
    drop(zone(), pdf);
    expect(onUpload).toHaveBeenCalledWith(pdf);
  });

  it("bấm hoặc Enter/Space trên vùng thả ⇒ mở hộp chọn file", () => {
    render(<UploadStep onUpload={vi.fn()} />);
    const input = screen.getByTestId("docx-input") as HTMLInputElement;
    const click = vi.spyOn(input, "click");

    // input nằm trong vùng thả nên click của input nổi bọt lên lại vùng thả ⇒ spy thấy thêm một lần gọi lồng
    // (trình duyệt bỏ qua click() lồng khi đang dispatch) — chỉ cần mỗi thao tác có mở hộp chọn.
    const opens = (act: () => void) => {
      click.mockClear();
      act();
      return click.mock.calls.length;
    };
    expect(opens(() => fireEvent.click(zone()))).toBeGreaterThan(0);
    expect(opens(() => fireEvent.keyDown(zone(), { key: "Enter" }))).toBeGreaterThan(0);
    expect(opens(() => fireEvent.keyDown(zone(), { key: " " }))).toBeGreaterThan(0);
    expect(opens(() => fireEvent.keyDown(zone(), { key: "a" }))).toBe(0);
  });

  it("đang tải (busy) ⇒ hiện trạng thái, bỏ qua kéo thả và không mở hộp chọn", () => {
    const onUpload = vi.fn();
    render(<UploadStep onUpload={onUpload} busy />);
    expect(screen.getByText("Đang tải lên và kiểm tra file…")).toBeInTheDocument();
    const input = screen.getByTestId("docx-input") as HTMLInputElement;
    const click = vi.spyOn(input, "click");

    fireEvent.click(zone());
    fireEvent.keyDown(zone(), { key: "Enter" });
    drop(zone(), docx());
    expect(click).not.toHaveBeenCalled();
    expect(onUpload).not.toHaveBeenCalled();
  });

  it("tiêu đề/gợi ý tuỳ biến (tải lại file đã sửa); không chọn file thì không gọi gì", () => {
    const onUpload = vi.fn();
    render(<UploadStep onUpload={onUpload} title="Tải lên file đã sửa" hint="Gợi ý riêng" />);
    expect(zone("Tải lên file đã sửa")).toBeInTheDocument();
    expect(screen.getByText("Gợi ý riêng")).toBeInTheDocument();
    fireEvent.change(screen.getByTestId("docx-input"), { target: { files: [] } });
    expect(onUpload).not.toHaveBeenCalled();
  });
});
