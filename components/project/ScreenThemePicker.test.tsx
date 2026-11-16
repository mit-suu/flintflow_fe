import { fireEvent, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { renderWithIntl, vietnameseLeftovers } from "@/test/intl";
import type { ScreenTheme } from "@/types/project";
import ScreenThemePicker, { DEFAULT_PRIMARY_COLOR, isHexColor, textOn } from "./ScreenThemePicker";

const EMPTY: ScreenTheme = { primaryColor: null, domain: null, platforms: null };

/** Picker có state thật như trong dialog; `onChange` ghi lại mọi theme mới. */
function Harness({ initial = EMPTY, onChange = () => {}, disabled = false }: { initial?: ScreenTheme; onChange?: (t: ScreenTheme) => void; disabled?: boolean }) {
  const [theme, setTheme] = useState(initial);
  const [hex, setHex] = useState(initial.primaryColor ?? "");
  return (
    <ScreenThemePicker
      value={theme}
      onChange={(t) => {
        setTheme(t);
        onChange(t);
      }}
      hexDraft={hex}
      onHexDraftChange={setHex}
      disabled={disabled}
    />
  );
}

describe("textOn / isHexColor", () => {
  it("chữ trắng trên màu đậm, đen trên màu sáng; hex phải đủ 6 ký tự", () => {
    expect(textOn(DEFAULT_PRIMARY_COLOR)).toBe("#FFFFFF");
    expect(textOn("#FFD400")).toBe("#000000");
    expect(isHexColor("#3f5591")).toBe(true);
    expect(isHexColor("#3F559")).toBe(false);
    expect(isHexColor("3F5591")).toBe(false);
  });
});

describe("ScreenThemePicker (FLF-410)", () => {
  it("chưa chọn màu ⇒ swatch mặc định được đánh dấu + ghi chú mặc định; nền tảng tự động", () => {
    renderWithIntl(<Harness />);
    expect(screen.getAllByRole("radio")).toHaveLength(8);
    expect(screen.getByRole("radio", { name: DEFAULT_PRIMARY_COLOR })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByText("Chưa chọn: đang dùng màu mặc định.")).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Tự động theo mô tả dự án" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Web" })).toBeDisabled();
    expect(screen.getByRole("checkbox", { name: "Mobile" })).toBeDisabled();
  });

  it("bấm swatch ⇒ đổi màu; gõ hex hợp lệ ⇒ đổi màu chữ hoa; hex dở ⇒ báo lỗi, không đổi", () => {
    const onChange = vi.fn();
    renderWithIntl(<Harness onChange={onChange} />);
    fireEvent.click(screen.getByRole("radio", { name: "#00897B" }));
    expect(onChange).toHaveBeenLastCalledWith({ ...EMPTY, primaryColor: "#00897B" });
    expect(screen.getByRole("radio", { name: "#00897B" })).toHaveAttribute("aria-checked", "true");

    const hex = screen.getByLabelText("Mã màu (#RRGGBB)");
    fireEvent.change(hex, { target: { value: "#12ab" } });
    expect(hex).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByText("Mã màu phải dạng #RRGGBB, ví dụ #3F5591.")).toBeInTheDocument();
    expect(onChange).toHaveBeenCalledTimes(1);

    fireEvent.change(hex, { target: { value: "#12abef" } });
    expect(onChange).toHaveBeenLastCalledWith({ ...EMPTY, primaryColor: "#12ABEF" });
    expect(screen.queryByText("Mã màu phải dạng #RRGGBB, ví dụ #3F5591.")).not.toBeInTheDocument();
  });

  it("domain: gõ ⇒ lưu; xoá trắng ⇒ null; nút xoá ⇒ null", () => {
    const onChange = vi.fn();
    renderWithIntl(<Harness onChange={onChange} initial={{ ...EMPTY, domain: "shop.example.com" }} />);
    const input = screen.getByLabelText("Domain");
    expect(input).toHaveValue("shop.example.com");
    fireEvent.change(input, { target: { value: "   " } });
    expect(onChange).toHaveBeenLastCalledWith({ ...EMPTY, domain: null });
    fireEvent.change(input, { target: { value: "techmart.vn" } });
    expect(onChange).toHaveBeenLastCalledWith({ ...EMPTY, domain: "techmart.vn" });
    fireEvent.click(screen.getByRole("button", { name: "Xoá domain" }));
    expect(onChange).toHaveBeenLastCalledWith({ ...EMPTY, domain: null });
    expect(screen.queryByRole("button", { name: "Xoá domain" })).not.toBeInTheDocument();
  });

  it("nền tảng: bỏ tự động ⇒ web; thêm mobile giữ thứ tự web, mobile; không bỏ được ô cuối", () => {
    const onChange = vi.fn();
    renderWithIntl(<Harness onChange={onChange} />);
    fireEvent.click(screen.getByRole("checkbox", { name: "Tự động theo mô tả dự án" }));
    expect(onChange).toHaveBeenLastCalledWith({ ...EMPTY, platforms: ["web"] });
    expect(screen.getByRole("checkbox", { name: "Web" })).toBeDisabled(); // ô cuối cùng

    fireEvent.click(screen.getByRole("checkbox", { name: "Mobile" }));
    expect(onChange).toHaveBeenLastCalledWith({ ...EMPTY, platforms: ["web", "mobile"] });
    fireEvent.click(screen.getByRole("checkbox", { name: "Web" }));
    expect(onChange).toHaveBeenLastCalledWith({ ...EMPTY, platforms: ["mobile"] });
    expect(screen.getByRole("checkbox", { name: "Mobile" })).toBeDisabled();

    fireEvent.click(screen.getByRole("checkbox", { name: "Tự động theo mô tả dự án" }));
    expect(onChange).toHaveBeenLastCalledWith({ ...EMPTY, platforms: null });
  });

  it("disabled ⇒ mọi ô bị tắt; giao diện tiếng Anh không còn chữ Việt", () => {
    // jsdom vẫn phát click qua <fieldset disabled> nên kiểm trạng thái tắt (trình duyệt chặn click theo đó)
    const { container } = renderWithIntl(<Harness disabled />, "en");
    expect(screen.getByRole("radio", { name: "#00897B" })).toBeDisabled();
    expect(screen.getByLabelText("Color code (#RRGGBB)")).toBeDisabled();
    expect(screen.getByRole("checkbox", { name: /auto/i })).toBeDisabled();
    expect(screen.getByLabelText("Domain")).toBeDisabled();
    expect(vietnameseLeftovers(container)).toEqual([]);
  });
});
