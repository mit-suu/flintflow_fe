import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import LanguageCommandCard from "./LanguageCommandCard";

const handlers = () => ({ onConfirm: vi.fn(), onTranslate: vi.fn(), onSendAsMessage: vi.fn(), onCancel: vi.fn() });

describe("LanguageCommandCard (FLF-265 §3.7)", () => {
  it("switch sang ngôn ngữ cần dịch: hỏi xác nhận, ước tính ở bước sau; Đồng ý / Không, gửi như tin nhắn / đóng", () => {
    const h = handlers();
    render(<LanguageCommandCard kind="switch" text="dịch sang tiếng Việt" target="vi" sourceLanguage="en" {...h} />);

    expect(screen.getByText("Đổi tài liệu sang tiếng Việt?")).toBeInTheDocument();
    expect(screen.getByText(/cần dịch sang tiếng Việt.*bước tiếp theo/)).toBeInTheDocument();
    expect(screen.getByText("Bạn gõ: “dịch sang tiếng Việt”")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Đồng ý" }));
    fireEvent.click(screen.getByRole("button", { name: "Không, gửi như tin nhắn" }));
    fireEvent.click(screen.getByRole("button", { name: "Đóng thẻ ngôn ngữ" }));
    expect(h.onConfirm).toHaveBeenCalledTimes(1);
    expect(h.onSendAsMessage).toHaveBeenCalledTimes(1);
    expect(h.onCancel).toHaveBeenCalledTimes(1);
  });

  it("switch về ngôn ngữ gốc: nói rõ không cần dịch, không tốn credit", () => {
    render(<LanguageCommandCard kind="switch" text="translate the document to English" target="en" sourceLanguage="en" {...handlers()} />);

    expect(screen.getByText("Đổi tài liệu sang tiếng Anh?")).toBeInTheDocument();
    expect(screen.getByText(/không cần dịch, không tốn credit/)).toBeInTheDocument();
  });

  it("đang đổi: khoá nút, ẩn nút đóng; lỗi hiện trong thẻ", () => {
    render(<LanguageCommandCard kind="switch" text="dịch sang tiếng Việt" target="vi" sourceLanguage="en" busy error="Không đổi được" {...handlers()} />);

    expect(screen.getByRole("button", { name: "Đang đổi…" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Không, gửi như tin nhắn" })).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Đóng thẻ ngôn ngữ" })).toBeNull();
    expect(screen.getByRole("alert")).toHaveTextContent("Không đổi được");
  });

  it("same còn mục thiếu: mời dịch nốt; không có nút Đồng ý", () => {
    const h = handlers();
    render(<LanguageCommandCard kind="same" text="dịch sang tiếng Việt" target="vi" sourceLanguage="en" missing={12} {...h} />);

    expect(screen.getByText("Tài liệu đang là tiếng Việt")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Dịch 12 mục còn thiếu" }));
    expect(h.onTranslate).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("button", { name: "Đồng ý" })).toBeNull();
    expect(screen.getByRole("button", { name: "Gửi như tin nhắn" })).toBeInTheDocument();
  });

  it("same không thiếu gì / chưa biết: chỉ còn Gửi như tin nhắn", () => {
    render(<LanguageCommandCard kind="same" text="translate to English" target="en" sourceLanguage="en" {...handlers()} />);

    expect(screen.getByText("Tài liệu đang là tiếng Anh")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /mục còn thiếu/ })).toBeNull();
  });

  it("locked (mode 1, D3): dự án upload giữ ngôn ngữ file; chỉ Gửi như tin nhắn", () => {
    const h = handlers();
    render(<LanguageCommandCard kind="locked" text="dịch sang tiếng Anh" target="en" sourceLanguage="en" {...h} />);

    expect(screen.getByText("Dự án upload giữ ngôn ngữ của file tải lên")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Đồng ý" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Gửi như tin nhắn" }));
    expect(h.onSendAsMessage).toHaveBeenCalledTimes(1);
  });
});
