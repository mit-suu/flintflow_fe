/** Khay thẻ nhắc trên ô chat: thu về một dòng khi khung chat đang làm việc sửa tài liệu, bấm để mở lại. */
import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithIntl } from "@/test/intl";
import NoticeTray from "./NoticeTray";

describe("NoticeTray", () => {
  it("không thu gọn ⇒ thẻ hiện như cũ, không có dòng thu gọn", () => {
    renderWithIntl(
      <NoticeTray collapsed={false}>
        <button type="button">Lưu vào thư viện</button>
      </NoticeTray>
    );
    expect(screen.getByRole("button", { name: "Lưu vào thư viện" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Thông báo khác/ })).not.toBeInTheDocument();
  });

  it("thu gọn ⇒ một dòng; thẻ không nhận focus / không bấm được tới khi mở", () => {
    renderWithIntl(
      <NoticeTray collapsed>
        <button type="button">Lưu vào thư viện</button>
      </NoticeTray>
    );
    const toggle = screen.getByRole("button", { name: /Thông báo khác đang chờ/ });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("button", { name: "Lưu vào thư viện" })).not.toBeInTheDocument();

    fireEvent.click(toggle);
    expect(screen.getByRole("button", { name: /Ẩn thông báo khác/ })).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("button", { name: "Lưu vào thư viện" })).toBeInTheDocument();
  });
});
