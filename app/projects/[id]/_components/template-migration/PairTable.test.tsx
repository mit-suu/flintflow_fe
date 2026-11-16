import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderWithIntl } from "@/test/intl";
import { migrationFixture } from "./migration-fixture.test-helper";
import PairTable from "./PairTable";

describe("PairTable", () => {
  it("đổi cặp báo đúng mục cũ → mục mới, mục mới đã có cặp khác bị khoá", () => {
    const onEdit = vi.fn();
    renderWithIntl(<PairTable migration={migrationFixture({ state: "mapping_review" })} busy={false} onEdit={onEdit} onConfirm={() => {}} />);
    const select = screen.getByLabelText("Ghi chú triển khai") as HTMLSelectElement;
    const owned = Array.from(select.options).find((o) => o.textContent === "1 Introduction");
    expect(owned).toBeDisabled();
    fireEvent.change(select, { target: { value: "n1" } });
    expect(onEdit).toHaveBeenCalledWith([{ old_key: "o1", new_key: "n1" }]);
    fireEvent.change(screen.getByLabelText("Giới thiệu"), { target: { value: "" } });
    expect(onEdit).toHaveBeenLastCalledWith([{ old_key: "o0", new_key: null }]);
  });

  it("file mẫu của dự án: sửa mapping heading báo đúng khoá; mẫu tổ chức chỉ xem", () => {
    const onEditMapping = vi.fn();
    const own = migrationFixture({ state: "mapping_review" });
    own.to.visibility = "project";
    const { unmount } = renderWithIntl(<PairTable migration={own} busy={false} onEdit={() => {}} onEditMapping={onEditMapping} onConfirm={() => {}} />);
    fireEvent.change(screen.getByLabelText("Phụ lục"), { target: { value: "fixed:1" } });
    expect(onEditMapping).toHaveBeenCalledWith([{ key: "n2", section_id: "fixed:1" }]);
    unmount();
    renderWithIntl(<PairTable migration={migrationFixture({ state: "mapping_review" })} busy={false} onEdit={() => {}} onEditMapping={onEditMapping} onConfirm={() => {}} />);
    expect(screen.getByLabelText("Phụ lục")).toBeDisabled();
  });

  it("đổi ngược: mapping của bản riêng không sửa được (chỉ đổi xuôi mới sửa)", () => {
    const m = migrationFixture({ state: "mapping_review", direction: "reverse" });
    m.to.visibility = "project";
    renderWithIntl(<PairTable migration={m} busy={false} onEdit={() => {}} onEditMapping={() => {}} onConfirm={() => {}} />);
    expect(screen.getByLabelText("Phụ lục")).toBeDisabled();
  });

  it("xác nhận ghép mục và nêu cảnh báo của mẫu đích", () => {
    const onConfirm = vi.fn();
    renderWithIntl(<PairTable migration={migrationFixture({ state: "mapping_review", warnings: ["Không đối chiếu được bảng"] })} busy={false} onEdit={() => {}} onConfirm={onConfirm} />);
    expect(screen.getByText("Không đối chiếu được bảng")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Xác nhận ghép mục" }));
    expect(onConfirm).toHaveBeenCalled();
  });
});
