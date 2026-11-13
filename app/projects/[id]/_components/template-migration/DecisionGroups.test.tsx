import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderWithIntl } from "@/test/intl";
import { emptyGroups, migrationFixture } from "./migration-fixture.test-helper";
import DecisionGroups from "./DecisionGroups";

describe("DecisionGroups", () => {
  it("mục thừa bắt buộc chọn: Tiếp tục khoá tới khi chọn, lựa chọn báo đúng id", () => {
    const onDecide = vi.fn();
    const onContinue = vi.fn();
    const { rerender } = renderWithIntl(<DecisionGroups migration={migrationFixture()} busy={false} onDecide={onDecide} onContinue={onContinue} />);
    expect(screen.getByText("Còn 1 mục cần chọn")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tiếp tục" })).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/Ghi chú triển khai/), { target: { value: "move_to:n1" } });
    expect(onDecide).toHaveBeenCalledWith({ decisions: [{ id: "e:o1", choice: "move_to:n1" }] });
    rerender(<DecisionGroups migration={migrationFixture({ decisions: [{ id: "e:o1", choice: "keep_custom" }], undecided: [] })} busy={false} onDecide={onDecide} onContinue={onContinue} />);
    fireEvent.click(screen.getByRole("button", { name: "Tiếp tục" }));
    expect(onContinue).toHaveBeenCalled();
  });

  it("mục thừa thuộc khung: lựa chọn Bỏ khỏi bản in kèm lời giải thích dữ liệu vẫn giữ", () => {
    const m = migrationFixture();
    m.groups.extra[0] = { ...m.groups.extra[0], choices: ["keep_custom", "drop_from_print"] };
    renderWithIntl(<DecisionGroups migration={m} busy={false} onDecide={() => {}} onContinue={() => {}} />);
    expect(screen.getByRole("option", { name: "Bỏ khỏi bản in" })).toBeInTheDocument();
    expect(screen.getByText(/dữ liệu vẫn được giữ/)).toBeInTheDocument();
  });

  it("đổi ngược: số mục trở về nguyên bản, nhóm đã sửa mặc định Giữ, Giữ hết / Hoàn tác hết", () => {
    const onDecide = vi.fn();
    const migration = migrationFixture({
      direction: "reverse",
      undecided: [],
      groups: emptyGroups({
        restored_from_snapshot: 4,
        edited_since: [{ id: "s:o0", old_key: "o0", heading_text: "Giới thiệu", changes: 2, last_at: "2026-11-11T00:00:00.000Z", chars: 120, choices: ["keep", "discard"], default: "keep" }],
      }),
    });
    renderWithIntl(<DecisionGroups migration={migration} busy={false} onDecide={onDecide} onContinue={() => {}} />);
    expect(screen.getByText("4 mục chưa sửa sẽ trở lại nguyên bản")).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Giữ" })).toBeChecked();
    fireEvent.click(screen.getByRole("radio", { name: "Bỏ" }));
    expect(onDecide).toHaveBeenLastCalledWith({ decisions: [{ id: "s:o0", choice: "discard" }] });
    fireEvent.click(screen.getByRole("button", { name: "Hoàn tác hết" }));
    expect(onDecide).toHaveBeenLastCalledWith({ batch: "discard_all" });
    fireEvent.click(screen.getByRole("button", { name: "Giữ hết" }));
    expect(onDecide).toHaveBeenLastCalledWith({ batch: "keep_all" });
  });

  it("đổi xuôi không hiện nhóm đã sửa; mục thiếu cần viết có nhãn", () => {
    renderWithIntl(<DecisionGroups migration={migrationFixture()} busy={false} onDecide={() => {}} onContinue={() => {}} />);
    expect(screen.queryByText(/Đã sửa sau lần đổi mẫu trước/)).not.toBeInTheDocument();
    expect(screen.getByText("Cần viết")).toBeInTheDocument();
    expect(screen.getByText("[Nêu phạm vi]")).toBeInTheDocument();
  });
});
