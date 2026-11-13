import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderWithIntl, vietnameseLeftovers } from "@/test/intl";
import type { TextSection } from "@/types/import";
import TextSections from "./text-sections";

const sections: TextSection[] = [
  { key: "B0002", title: "1 Introduction", level: 1, dropped: false },
  { key: "B0005", title: "2.1 Actors", level: 2, dropped: true },
  { key: "B0009", title: "4 Core Banking Integration", level: 1, dropped: false },
];

describe("TextSections - Giữ / Bỏ chữ theo mục ở màn đọc khung", () => {
  it("bấm Bỏ chữ / Giữ nội dung một mục ⇒ gửi cả tập mục bỏ chữ mới", () => {
    const onChange = vi.fn();
    renderWithIntl(<TextSections sections={sections} onChange={onChange} />);
    const intro = screen.getByRole("group", { name: /1 Introduction/ });
    fireEvent.click(intro.querySelectorAll("button")[1]);
    expect(onChange).toHaveBeenLastCalledWith(["B0005", "B0002"]);
    const actors = screen.getByRole("group", { name: /2.1 Actors/ });
    expect(actors.querySelectorAll("button")[1]).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(actors.querySelectorAll("button")[0]);
    expect(onChange).toHaveBeenLastCalledWith([]);
  });

  it("Bỏ tất cả ⇒ mọi mục; khi đã bỏ hết thì nút thành Giữ tất cả", () => {
    const onChange = vi.fn();
    const { rerender } = renderWithIntl(<TextSections sections={sections} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Bỏ tất cả" }));
    expect(onChange).toHaveBeenLastCalledWith(["B0002", "B0005", "B0009"]);
    rerender(<TextSections sections={sections.map((s) => ({ ...s, dropped: true }))} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Giữ tất cả" }));
    expect(onChange).toHaveBeenLastCalledWith([]);
  });

  it("có giải thích ⓘ cho từng lựa chọn; không có mục có chữ thì không hiện gì", () => {
    const { container, unmount } = renderWithIntl(<TextSections sections={sections} onChange={vi.fn()} />);
    expect(screen.getAllByRole("tooltip").map((el) => el.textContent)).toEqual(
      expect.arrayContaining([expect.stringContaining("soạn lại"), expect.stringContaining("dữ liệu của dự án")])
    );
    expect(container.textContent).not.toContain("—");
    unmount();
    const en = renderWithIntl(<TextSections sections={sections} onChange={vi.fn()} />, "en");
    expect(vietnameseLeftovers(en.container)).toEqual([]);
    en.unmount();
    const empty = renderWithIntl(<TextSections sections={[]} onChange={vi.fn()} />);
    expect(empty.container).toBeEmptyDOMElement();
  });
});
