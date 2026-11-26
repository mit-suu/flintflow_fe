import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderWithIntl, vietnameseLeftovers } from "@/test/intl";
import SkeletonLanguage from "./skeleton-language";

describe("SkeletonLanguage - ô ngôn ngữ tài liệu khi file chỉ còn khung (FLF-456)", () => {
  it("còn mục giữ nội dung (visible false) hoặc chưa có dữ liệu ⇒ không hiện ô", () => {
    const hidden = renderWithIntl(<SkeletonLanguage state={{ visible: false, file: "en", selected: "en" }} onChange={vi.fn()} />);
    expect(hidden.container).toBeEmptyDOMElement();
    hidden.unmount();
    const none = renderWithIntl(<SkeletonLanguage state={null} onChange={vi.fn()} />);
    expect(none.container).toBeEmptyDOMElement();
  });

  it("hiện khi file chỉ còn khung, mặc định theo ngôn ngữ file; chọn ngôn ngữ khác ⇒ gửi và báo sẽ dịch khung", () => {
    const onChange = vi.fn();
    const { rerender } = renderWithIntl(<SkeletonLanguage state={{ visible: true, file: "en", selected: "en" }} onChange={onChange} />);
    expect(screen.getByRole("radio", { name: "Tiếng Anh" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("status")).toHaveTextContent("File đang viết bằng Tiếng Anh");
    fireEvent.click(screen.getByRole("radio", { name: "Tiếng Việt" }));
    expect(onChange).toHaveBeenCalledWith("vi");
    rerender(<SkeletonLanguage state={{ visible: true, file: "en", selected: "vi" }} onChange={onChange} />);
    expect(screen.getByRole("status")).toHaveTextContent("Khung sẽ được dịch sang Tiếng Việt");
  });

  it("đang lưu ⇒ khoá ô; không em dash; bản tiếng Anh không lòi tiếng Việt", () => {
    const state = { visible: true, file: "vi", selected: "vi" } as const;
    const vi_ = renderWithIntl(<SkeletonLanguage state={state} busy onChange={vi.fn()} />);
    expect(screen.getByRole("radiogroup")).toHaveAttribute("aria-disabled", "true");
    expect(vi_.container.textContent).not.toContain("—");
    vi_.unmount();
    const en = renderWithIntl(<SkeletonLanguage state={state} onChange={vi.fn()} />, "en");
    expect(vietnameseLeftovers(en.container)).toEqual([]);
    expect(en.container.textContent).not.toContain("—");
  });
});
