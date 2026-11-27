import { fireEvent, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderWithIntl } from "@/test/intl";
import { emptyGroups, migrationFixture, placeableFixture as placeable } from "./migration-fixture.test-helper";
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

  it("Chuyển vào: chọn được mục đã có cặp (gộp sau nội dung đang có) và heading nhóm (mục con cuối); gợi ý top kèm lý do", () => {
    const onDecide = vi.fn();
    const m = placeable();
    render(m, { onDecide });
    const select = screen.getByLabelText("Mục tiêu") as HTMLSelectElement;
    const suggested = within(select).getByRole("group", { name: "Gợi ý" });
    expect(within(suggested).getByRole("option", { name: "Gộp vào “1.2 Phạm vi” (sau nội dung đang có) · khớp hướng dẫn, hợp loại dữ liệu" })).toBeInTheDocument();
    expect(within(select).getByRole("group", { name: "Mọi mục của mẫu mới · mục trống" })).toHaveTextContent("Chuyển vào “1.1 Mục đích”");
    expect(within(select).getByRole("group", { name: "Mọi mục của mẫu mới · mục con mới của nhóm" })).toHaveTextContent("Thêm thành mục con cuối của “1 Giới thiệu”");
    expect(screen.getByText("Hợp nghĩa nhất với “1.2 Phạm vi” (tên, hướng dẫn, loại dữ liệu)")).toBeInTheDocument();
    fireEvent.change(select, { target: { value: "move_to:n2" } });
    expect(onDecide).toHaveBeenCalledWith({ decisions: [{ id: "e:o1", choice: "move_to:n2" }] });
  });

  it("bản ghi cũ không có targets: không có nhóm Gợi ý, mọi lựa chọn vẫn chọn được", () => {
    const m = placeable();
    delete m.groups.extra[0].targets;
    render(m);
    const select = screen.getByLabelText("Mục tiêu");
    expect(within(select).queryByRole("group", { name: "Gợi ý" })).not.toBeInTheDocument();
    expect(within(select).getByRole("option", { name: "Gộp vào “1.2 Phạm vi” (sau nội dung đang có)" })).toBeInTheDocument();
  });

  it("chọn Không in ra cho mục có dữ liệu ⇒ cảnh báo số phần tử sẽ không in", () => {
    const m = placeable();
    m.decisions = [{ id: "e:o1", choice: "drop_from_print" }];
    const { rerender } = render(m);
    expect(screen.getByText("12 phần tử sẽ không in")).toBeInTheDocument();
    rerender(<ReviewStep migration={{ ...m, groups: { ...m.groups, extra: [{ ...m.groups.extra[0], data_size: 0 }] } }} busy={false} onDecide={noop} onEditPairs={noop} onContinue={noop} onCancel={noop} />);
    expect(screen.queryByText(/phần tử sẽ không in/)).not.toBeInTheDocument();
  });

  it("ô thống kê và tiêu đề danh sách cùng một con số, ghi tách thẻ cần xem và bảng đổi cột", () => {
    const m = suggestedOnly();
    m.groups.conflict = [{ id: "c:table_columns:o0", kind: "table_columns", old_key: "o0", new_key: "n0", candidate_keys: [], old_columns: [["A"]], new_columns: [["B"]], choices: ["map_by_header", "keep_old_table", "ai_resolve"], ai_choices: ["ai_resolve"], decision_required: true, suggested: "map_by_header", suggested_reason: "map_columns", confidence: "high" }];
    render(m);
    expect(screen.getByRole("heading", { name: "Đã chọn sẵn (2)" })).toBeInTheDocument();
    const stat = screen.getByText("đã chọn sẵn").closest("li")!;
    expect(stat).toHaveTextContent("2");
    expect(stat).toHaveTextContent("1 cần xem · 1 bảng đổi cột");
    expect(screen.getByRole("region", { name: "Bảng đổi cột (1)" })).toBeInTheDocument();
  });

  it("thẻ ghép chưa đúng nghĩa: giữ cặp hiện tại hoặc gộp vào mục hợp hơn", () => {
    const onDecide = vi.fn();
    const m = placeable();
    m.groups.conflict = [{ id: "c:placement:o0", kind: "placement", old_key: "o0", new_key: "n3", candidate_keys: [], old_columns: [], new_columns: [], choices: ["keep_pair", "move_to:n2", "keep_custom"], ai_choices: [], decision_required: true, suggested: "move_to:n2", suggested_reason: "same_data", confidence: "guess", targets: [{ new_key: "n2", score: 0.7, why: ["data_fit"] }], data_size: 4 }];
    render(m, { onDecide });
    const select = screen.getAllByLabelText("Yêu cầu khác")[0] as HTMLSelectElement;
    expect(screen.getByText("Ghép chưa đúng nghĩa")).toBeInTheDocument();
    expect(screen.getByText("“1.2 Phạm vi” đã in đúng dữ liệu này, gộp vào để không in hai lần")).toBeInTheDocument();
    fireEvent.change(select, { target: { value: "keep_pair" } });
    expect(onDecide).toHaveBeenCalledWith({ decisions: [{ id: "c:placement:o0", choice: "keep_pair" }] });
  });

  it("chia theo từng yêu cầu có nhãn riêng; chú thích vì sao chỉ một số lựa chọn dùng AI", () => {
    const m = suggestedOnly();
    m.groups.conflict = [{ id: "c:split_section:o0", kind: "split_section", old_key: "o0", new_key: "n0", candidate_keys: ["n0", "n2"], old_columns: [], new_columns: [], choices: ["to:n0", "to:n2", "distribute", "ai_resolve"], ai_choices: ["ai_resolve"], decision_required: true, suggested: "distribute", suggested_reason: "best_fit", confidence: "high", item_targets: [{ id: "NFR-1", new_key: "n2" }] }];
    render(m);
    // Dòng xem lại đứng trước ô sửa cặp của nhóm Chuyển nguyên (cùng tên mục)
    expect((screen.getAllByLabelText("Giới thiệu")[0] as HTMLSelectElement).value).toBe("distribute");
    expect(screen.getByRole("option", { name: "Chia theo từng yêu cầu" })).toBeInTheDocument();
    expect(screen.getByText("Các yêu cầu của mục này hợp với nhiều mục khác nhau của mẫu mới")).toBeInTheDocument();
    expect(screen.getByText(/Chỉ bảng đổi cột, mục bị tách, bảng lịch sử và mục chữ tự do/)).toBeInTheDocument();
  });

  it("mẫu lớn: ô tìm lọc danh sách mục của mẫu mới, giữ lựa chọn đang hiệu lực", () => {
    const m = placeable();
    const extra = Array.from({ length: 10 }, (_, i) => ({ key: `z${i}`, heading_text: `3.${i} Mục số ${i}`, section_id: `custom:z${i}`, level: 2 }));
    m.to.headings.push(...extra);
    m.groups.extra[0].choices.push(...extra.map((h) => `move_to:${h.key}`));
    render(m);
    const select = screen.getByLabelText("Mục tiêu");
    expect(within(select).getByRole("option", { name: "Chuyển vào “3.4 Mục số 4”" })).toBeInTheDocument();
    fireEvent.change(screen.getByRole("searchbox", { name: "Tìm mục trong mẫu mới" }), { target: { value: "muc so 7" } });
    expect(within(select).getByRole("option", { name: "Chuyển vào “3.7 Mục số 7”" })).toBeInTheDocument();
    expect(within(select).queryByRole("option", { name: "Chuyển vào “3.4 Mục số 4”" })).not.toBeInTheDocument();
    // Gợi ý và lựa chọn đang hiệu lực không bị lọc mất
    expect(within(select).getByRole("option", { name: /Gộp vào “1.2 Phạm vi”/ })).toBeInTheDocument();
  });

  it("mục in từ dữ liệu Spine không nằm trong Cần viết", () => {
    const m = suggestedOnly();
    m.groups.missing = [{ ...m.groups.missing[0], filled_from_spine: true }];
    render(m);
    expect(screen.queryByRole("region", { name: /Cần viết sau khi đổi/ })).not.toBeInTheDocument();
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
