import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderWithIntl } from "@/test/intl";
import RevertMigrationButton from "./RevertMigrationButton";

describe("RevertMigrationButton", () => {
  it("hỏi xác nhận rồi mới hoàn tác", () => {
    const onRevert = vi.fn();
    renderWithIntl(<RevertMigrationButton busy={false} blocked={false} onRevert={onRevert} />);
    fireEvent.click(screen.getByRole("button", { name: "Hoàn tác lần đổi mẫu" }));
    expect(onRevert).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Hoàn tác" }));
    expect(onRevert).toHaveBeenCalled();
  });

  it("BE báo không hoàn tác được (không phải lần mới nhất) ⇒ nêu lý do, không có nút", () => {
    renderWithIntl(<RevertMigrationButton busy={false} blocked={false} revertable={false} reason="not_latest" onRevert={() => {}} />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Chỉ hoàn tác được lần đổi mẫu mới nhất");
  });

  it("bị BE chặn (đã có change request ghi sau) ⇒ thay nút bằng lời chỉ sang đổi mẫu ngược", () => {
    renderWithIntl(<RevertMigrationButton busy={false} blocked onRevert={() => {}} />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Dùng Đổi mẫu để quay về mẫu trước");
  });
});
