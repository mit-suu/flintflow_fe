import { fireEvent, screen, within } from "@testing-library/react";
import { renderWithIntl } from "@/test/intl";
import { describe, expect, it, vi } from "vitest";
import { DECISION_REASON_MIN_LENGTH, type CrGroup, type CrLocation } from "@/types/change-request";
import ChangeGroupPanel from "./ChangeGroupPanel";
import { formatDateTime } from "./labels";

const location = (id: string, over: Partial<CrLocation> = {}): CrLocation => ({
  location_id: id,
  path: `x[id=${id}]`,
  section_id: "fixed:1",
  section_title: "Product Overview",
  current_text: "",
  found_by: ["mention"],
  entity_paths: [],
  owner_step: null,
  conclusion: "edit",
  reason: null,
  proposal: { old_text: JSON.stringify({ statement: `old ${id}` }), new_text: JSON.stringify({ statement: `new ${id}` }), comment_text: null, spine_ops: [], assumptions: [] },
  manual: false,
  redo_count: 0,
  verify: null,
  group_id: null,
  ...over,
});

const group = (id: string, location_ids: string[], over: Partial<CrGroup> = {}): CrGroup => ({
  group_id: id,
  title: `Nhóm ${id}`,
  location_ids,
  decision: "pending",
  reason: null,
  decided_by: null,
  decided_at: null,
  ...over,
});

const LOCATIONS = [
  location("L001"),
  location("L002", { conclusion: "comment", proposal: { old_text: "x", new_text: null, comment_text: "Xác nhận với PM", spine_ops: [], assumptions: [] } }),
  location("L003", { conclusion: null, proposal: null }),
];

const G1 = "G1";
const article = (id = G1) => screen.getByRole("article", { name: `Nhóm ${id}` });

describe("ChangeGroupPanel — duyệt từng nhóm thay đổi (UC-51, UC-52)", () => {
  it("không có nhóm ⇒ không render", () => {
    const { container } = renderWithIntl(<ChangeGroupPanel groups={[]} locations={LOCATIONS} canDecide onDecide={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("mỗi nhóm chỉ liệt kê vị trí của nó: diff cho sửa, comment cho chỉ comment, “—” khi chưa kết luận", () => {
    renderWithIntl(
      <ChangeGroupPanel
        groups={[group("G1", ["L001", "L002"]), group("G2", ["L003"])]}
        locations={LOCATIONS}
        canDecide={false}
        onDecide={vi.fn()}
      />
    );
    expect(screen.getByRole("heading", { name: "Nhóm thay đổi (2)" })).toBeInTheDocument();
    const g1 = article("G1");
    // F6 (mode 1 v3): vị trí hiện theo mục của tài liệu, path Spine để ở tooltip
    expect(within(g1).getByTitle("x[id=L001]")).toHaveTextContent("Product Overview · Sửa");
    expect(within(g1).getByText("old L001").tagName).toBe("DEL");
    expect(within(g1).getByText("new L001").tagName).toBe("INS");
    expect(within(g1).getByTitle("x[id=L002]")).toHaveTextContent("Product Overview · Chỉ comment");
    expect(within(g1).getByText("💬 Xác nhận với PM")).toBeInTheDocument();
    expect(within(g1).queryByText(/L003/)).not.toBeInTheDocument();
    expect(within(article("G2")).getByTitle("x[id=L003]")).toHaveTextContent("Product Overview · —");
    expect(within(g1).getByText("Chờ duyệt")).toBeInTheDocument();
  });

  it("chưa ở in_review (canDecide = false) ⇒ không có nút duyệt/từ chối", () => {
    renderWithIntl(<ChangeGroupPanel groups={[group(G1, ["L001"])]} locations={LOCATIONS} canDecide={false} onDecide={vi.fn()} />);
    expect(screen.queryByRole("button", { name: "Duyệt" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Từ chối" })).not.toBeInTheDocument();
  });

  it(`Duyệt cũng bắt buộc lý do ≥ ${DECISION_REASON_MIN_LENGTH} ký tự (BPMN 3.12, mode 1 v3)`, () => {
    const onDecide = vi.fn();
    renderWithIntl(<ChangeGroupPanel groups={[group(G1, ["L001"])]} locations={LOCATIONS} canDecide onDecide={onDecide} />);
    fireEvent.click(within(article()).getByRole("button", { name: "Duyệt" }));
    expect(onDecide).not.toHaveBeenCalled();
    const confirm = within(article()).getByRole("button", { name: "Xác nhận duyệt" });
    expect(confirm).toBeDisabled();
    fireEvent.change(within(article()).getByLabelText(`Lý do duyệt ${G1}`), { target: { value: "  Đúng yêu cầu của khách  " } });
    fireEvent.click(confirm);
    expect(onDecide).toHaveBeenCalledWith(G1, "approved", "Đúng yêu cầu của khách");
  });

  it(`từ chối bắt buộc lý do ≥ ${DECISION_REASON_MIN_LENGTH} ký tự (không tính khoảng trắng đầu/cuối); gửi lý do đã cắt`, () => {
    const onDecide = vi.fn();
    renderWithIntl(<ChangeGroupPanel groups={[group(G1, ["L001"])]} locations={LOCATIONS} canDecide onDecide={onDecide} />);
    fireEvent.click(within(article()).getByRole("button", { name: "Từ chối" }));

    const reason = within(article()).getByLabelText(`Lý do từ chối ${G1}`);
    expect(reason).toHaveAttribute("placeholder", `Lý do từ chối (ít nhất ${DECISION_REASON_MIN_LENGTH} ký tự)`);
    const confirm = within(article()).getByRole("button", { name: "Xác nhận từ chối" });
    expect(confirm).toBeDisabled();

    fireEvent.change(reason, { target: { value: "123456789" } }); // 9 ký tự
    expect(confirm).toBeDisabled();
    fireEvent.change(reason, { target: { value: "   12345678   " } }); // dài nhưng chỉ 8 ký tự thật
    expect(confirm).toBeDisabled();
    fireEvent.click(confirm);
    expect(onDecide).not.toHaveBeenCalled();

    fireEvent.change(reason, { target: { value: "  Ngoài phạm vi 1.0  " } });
    expect(confirm).toBeEnabled();
    fireEvent.click(confirm);
    expect(onDecide).toHaveBeenCalledWith(G1, "rejected", "Ngoài phạm vi 1.0");
  });

  it("đúng 10 ký tự là đủ", () => {
    const onDecide = vi.fn();
    renderWithIntl(<ChangeGroupPanel groups={[group(G1, ["L001"])]} locations={LOCATIONS} canDecide onDecide={onDecide} />);
    fireEvent.click(within(article()).getByRole("button", { name: "Từ chối" }));
    fireEvent.change(within(article()).getByLabelText(`Lý do từ chối ${G1}`), { target: { value: "1234567890" } });
    fireEvent.click(within(article()).getByRole("button", { name: "Xác nhận từ chối" }));
    expect(onDecide).toHaveBeenCalledWith(G1, "rejected", "1234567890");
  });

  it("Huỷ từ chối ⇒ ẩn ô lý do, quay về Duyệt/Từ chối", () => {
    renderWithIntl(<ChangeGroupPanel groups={[group(G1, ["L001"])]} locations={LOCATIONS} canDecide onDecide={vi.fn()} />);
    fireEvent.click(within(article()).getByRole("button", { name: "Từ chối" }));
    fireEvent.click(within(article()).getByRole("button", { name: "Huỷ" }));
    expect(within(article()).queryByLabelText(`Lý do từ chối ${G1}`)).not.toBeInTheDocument();
    expect(within(article()).getByRole("button", { name: "Duyệt" })).toBeInTheDocument();
  });

  it("đang xử lý (busy) ⇒ Duyệt/Từ chối khoá", () => {
    renderWithIntl(<ChangeGroupPanel groups={[group(G1, ["L001"])]} locations={LOCATIONS} canDecide busy onDecide={vi.fn()} />);
    expect(within(article()).getByRole("button", { name: "Duyệt" })).toBeDisabled();
    expect(within(article()).getByRole("button", { name: "Từ chối" })).toBeDisabled();
  });

  it("nhóm đã quyết ⇒ nhãn kết quả, lý do + thời điểm; không còn nút dù canDecide", () => {
    const at = "2026-09-19T02:00:00.000Z";
    renderWithIntl(
      <ChangeGroupPanel
        groups={[
          group("G1", ["L001"], { decision: "rejected", reason: "Ngoài phạm vi bản 1.0", decided_at: at }),
          group("G2", ["L002"], { decision: "approved", decided_at: at }),
          group("G3", ["L003"]),
        ]}
        locations={LOCATIONS}
        canDecide
        onDecide={vi.fn()}
      />
    );
    expect(within(article("G1")).getByText("Từ chối", { selector: "span" })).toBeInTheDocument();
    expect(within(article("G1")).getByText(`Lý do: Ngoài phạm vi bản 1.0 · ${formatDateTime(at)}`)).toBeInTheDocument();
    expect(within(article("G1")).queryByRole("button")).not.toBeInTheDocument();
    expect(within(article("G2")).getByText("Đã duyệt")).toBeInTheDocument();
    expect(within(article("G2")).getByText(formatDateTime(at))).toBeInTheDocument();
    expect(within(article("G3")).getByRole("button", { name: "Duyệt" })).toBeInTheDocument();
  });
});
