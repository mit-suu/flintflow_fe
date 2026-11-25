import { fireEvent, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderWithIntl } from "@/test/intl";
import { emptyGroups, migrationFixture } from "./migration-fixture.test-helper";
import ReviewStep from "./ReviewStep";

const noop = () => {};
type Handler = (...args: unknown[]) => void;
const render = (m = migrationFixture(), handlers: Partial<Record<"onDecide" | "onEditPairs" | "onContinue" | "onCancel", Handler>> = {}) =>
  renderWithIntl(<ReviewStep migration={m} busy={false} onDecide={handlers.onDecide ?? noop} onEditPairs={handlers.onEditPairs ?? noop} onContinue={handlers.onContinue ?? noop} onCancel={handlers.onCancel ?? noop} />);

/** Mục thừa chọn sẵn chắc chắn (không đoán) — không còn dòng chờ xác nhận. */
const suggestedOnly = () => {
  const m = migrationFixture({ undecided: [] });
  m.groups.extra[0] = { ...m.groups.extra[0], suggested: "drop_from_print", suggested_reason: "no_place", confidence: "high" };
  return m;
};

describe("ReviewStep", () => {
  it("chọn sẵn: lựa chọn hiện sẵn, Tiếp tục bật ngay, không cần chạm dòng nào", () => {
    const onContinue = vi.fn();
    render(suggestedOnly(), { onContinue });
    expect((screen.getByLabelText("Ghi chú triển khai") as HTMLSelectElement).value).toBe("drop_from_print");
    expect(screen.getByText("Gợi ý")).toBeInTheDocument();
    expect(screen.getByText("Mẫu mới không có chỗ cho mục này")).toBeInTheDocument();
    expect(screen.getByText(/Bản xuất không còn mục này/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Tiếp tục" }));
    expect(onContinue).toHaveBeenCalled();
  });

  it("dòng đoán: Tiếp tục khoá kèm số mục cần xác nhận; bấm Đúng gửi đúng lựa chọn đoán", () => {
    const onDecide = vi.fn();
    render(migrationFixture(), { onDecide });
    expect(screen.getByText("Đoán")).toBeInTheDocument();
    expect(screen.getByText("Còn 1 mục cần xác nhận")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tiếp tục" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Đúng" }));
    expect(onDecide).toHaveBeenCalledWith({ decisions: [{ id: "e:o1", choice: "move_to:n1" }] });
  });

  it("đổi lựa chọn gửi quyết định; dòng giữ nguyên chỗ (thứ tự theo BE)", () => {
    const onDecide = vi.fn();
    const m = suggestedOnly();
    m.groups.conflict = [{ id: "c:split_section:o0", kind: "split_section", old_key: "o0", new_key: "n0", candidate_keys: ["n0", "n2"], old_columns: [], new_columns: [], choices: ["to:n0", "to:n2", "ai_resolve"], ai_choices: ["ai_resolve"], decision_required: true, suggested: "to:n0", suggested_reason: "first_heading", confidence: "high" }];
    const { rerender } = render(m, { onDecide });
    const before = screen.getAllByRole("listitem").map((li) => li.textContent);
    fireEvent.change(screen.getByLabelText("Ghi chú triển khai"), { target: { value: "keep_custom" } });
    expect(onDecide).toHaveBeenCalledWith({ decisions: [{ id: "e:o1", choice: "keep_custom" }] });
    rerender(<ReviewStep migration={{ ...m, decisions: [{ id: "e:o1", choice: "keep_custom" }] }} busy={false} onDecide={onDecide} onEditPairs={noop} onContinue={noop} onCancel={noop} />);
    const after = screen.getAllByRole("listitem").map((li) => li.textContent);
    expect(after.length).toBe(before.length);
    expect(after.findIndex((x) => x?.includes("Ghi chú triển khai"))).toBe(before.findIndex((x) => x?.includes("Ghi chú triển khai")));
    // Lựa chọn dùng AI có nhãn, không bao giờ là lựa chọn sẵn
    expect(screen.getByRole("option", { name: /Để AI sắp xếp \(dùng AI\)/ })).toBeInTheDocument();
  });

  it("ghép với mục thiếu khác ⇒ sửa cặp qua PATCH pairs", () => {
    const onEditPairs = vi.fn();
    const m = suggestedOnly();
    m.groups.missing.push({ id: "x:n2", new_key: "n2", heading_text: "Phụ lục", section_id: "unmapped", needs_content: true, guidance: null });
    render(m, { onEditPairs });
    fireEvent.change(screen.getByLabelText("Ghi chú triển khai"), { target: { value: "pair:n2" } });
    expect(onEditPairs).toHaveBeenCalledWith([{ old_key: "o1", new_key: "n2" }]);
  });

  it("mục chuyển nguyên ghép sai: chọn mục khác hoặc Không ghép ⇒ PATCH pairs; mục đã có chủ khác bị khoá", () => {
    const onEditPairs = vi.fn();
    render(suggestedOnly(), { onEditPairs });
    const select = screen.getByLabelText("Giới thiệu") as HTMLSelectElement;
    expect(select.value).toBe("n0");
    fireEvent.change(select, { target: { value: "n2" } });
    expect(onEditPairs).toHaveBeenCalledWith([{ old_key: "o0", new_key: "n2" }]);
    fireEvent.change(select, { target: { value: "" } });
    expect(onEditPairs).toHaveBeenLastCalledWith([{ old_key: "o0", new_key: null }]);
  });

  it("bảng đổi cột gom vào bảng gọn; mục chuyển nguyên gập; mục cần viết liệt kê", () => {
    const m = suggestedOnly();
    m.groups.conflict = [{ id: "c:table_columns:o0", kind: "table_columns", old_key: "o0", new_key: "n0", candidate_keys: [], old_columns: [["Actor", "Description"]], new_columns: [["Mã", "Tên"]], choices: ["map_by_header", "keep_old_table", "ai_resolve"], ai_choices: ["ai_resolve"], decision_required: true, suggested: "map_by_header", suggested_reason: "map_columns", confidence: "high" }];
    render(m);
    const compact = screen.getByRole("region", { name: "Bảng đổi cột (1)" });
    expect(within(compact).getByText(/Cũ: Actor \| Description/)).toBeInTheDocument();
    expect(screen.getByText("Chuyển nguyên (1)")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Cần viết sau khi đổi (1)" })).toHaveTextContent("Phạm vi");
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
    render(migration, { onDecide });
    expect(screen.getByText("4 mục chưa sửa trở lại nguyên bản")).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Giữ" })).toBeChecked();
    fireEvent.click(screen.getByRole("radio", { name: "Bỏ" }));
    expect(onDecide).toHaveBeenLastCalledWith({ decisions: [{ id: "s:o0", choice: "discard" }] });
    fireEvent.click(screen.getByRole("button", { name: "Hoàn tác hết" }));
    expect(onDecide).toHaveBeenLastCalledWith({ batch: "discard_all" });
  });
});
