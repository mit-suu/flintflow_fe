import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithIntl } from "@/test/intl";
import UntranslatedNotice from "./UntranslatedNotice";

describe("UntranslatedNotice", () => {
  it("hiện tên mục khi còn đoạn chưa dịch", () => {
    renderWithIntl(<UntranslatedNotice summary={{ translated: 290, untranslated: 3, sections: [{ section_id: "a", title: "Chức năng đăng nhập" }, { section_id: "b", title: "Màn hình" }] }} />);
    expect(screen.getByRole("status")).toHaveTextContent("3 đoạn chưa dịch được");
    expect(screen.getByRole("status")).toHaveTextContent("Chức năng đăng nhập, Màn hình");
  });

  it("không hiện khi bằng 0 hoặc thiếu", () => {
    const { container, rerender } = renderWithIntl(<UntranslatedNotice summary={{ translated: 5, untranslated: 0, sections: [] }} />);
    expect(container).toBeEmptyDOMElement();
    rerender(<UntranslatedNotice summary={undefined} />);
    expect(container).toBeEmptyDOMElement();
  });
});
