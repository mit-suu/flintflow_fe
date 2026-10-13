import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderWithIntl } from "@/test/intl";
import DocumentLanguagePicker from "./DocumentLanguagePicker";

describe("DocumentLanguagePicker (FLF-265)", () => {
  it("radiogroup 2 lựa chọn; chỉ nút đang chọn nhận Tab", () => {
    renderWithIntl(<DocumentLanguagePicker value="en" onChange={() => {}} />);
    expect(screen.getByRole("radiogroup", { name: "Ngôn ngữ tài liệu" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Tiếng Anh" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("radio", { name: "Tiếng Anh" })).toHaveAttribute("tabindex", "0");
    expect(screen.getByRole("radio", { name: "Tiếng Việt" })).toHaveAttribute("tabindex", "-1");
  });

  it("bấm, mũi tên (vòng lại) và Space đều gọi onChange", () => {
    const onChange = vi.fn();
    renderWithIntl(<DocumentLanguagePicker value="vi" onChange={onChange} />);
    fireEvent.click(screen.getByRole("radio", { name: "Tiếng Anh" }));
    expect(onChange).toHaveBeenLastCalledWith("en");
    fireEvent.keyDown(screen.getByRole("radio", { name: "Tiếng Việt" }), { key: "ArrowLeft" });
    expect(onChange).toHaveBeenLastCalledWith("en");
    fireEvent.keyDown(screen.getByRole("radio", { name: "Tiếng Việt" }), { key: " " });
    expect(onChange).toHaveBeenLastCalledWith("vi");
  });

  it("disabled ⇒ không đổi được", () => {
    const onChange = vi.fn();
    renderWithIntl(<DocumentLanguagePicker value="vi" onChange={onChange} disabled />);
    fireEvent.click(screen.getByRole("radio", { name: "Tiếng Anh" }));
    expect(onChange).not.toHaveBeenCalled();
  });

  it("nhãn ngoài qua labelledBy; giao diện tiếng Anh dịch nhãn lựa chọn", () => {
    renderWithIntl(
      <>
        <span id="lang-label">Document language</span>
        <DocumentLanguagePicker value="en" onChange={() => {}} labelledBy="lang-label" />
      </>,
      "en"
    );
    expect(screen.getByRole("radiogroup", { name: "Document language" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Vietnamese" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "English" })).toBeInTheDocument();
  });
});
