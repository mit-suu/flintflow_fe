import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderWithIntl } from "@/test/intl";
import { migrationFixture } from "./migration-fixture.test-helper";
import SummaryStep from "./SummaryStep";

const ready = () =>
  migrationFixture({
    state: "ready",
    undecided: [],
    credit_estimate: { translation: { chars: 9000, batches: 3, credits: 6 }, structural_moves: { count: 0, credits: 0 }, ai_resolve: { count: 0, credits: 0 }, total: 6 },
    language: { source: "vi", target: "en", needs_translation: true, switches_document_language: false },
  });

const outlined = () =>
  migrationFixture({
    undecided: [],
    outline: [
      { heading_text: "4.2.2 Độ tin cậy", level: 3, status: "kept" },
      { heading_text: "4.2.3 Hiệu năng", level: 3, status: "dropped", dropped_items: [{ id: "NFR-17", text: "Trang chủ tải dưới 2 giây" }], dropped_total: 3 },
      { heading_text: "4.2.4 Thuộc tính đặc thù", level: 3, status: "receives", from_heading: ["4.2.4 Security"], table_change: "map" },
      { heading_text: "5.5 Thuật ngữ", level: 2, status: "needs_content" },
    ],
  });

describe("SummaryStep (Áp dụng)", () => {
  it("dàn tiêu đề theo thứ tự, màu theo trạng thái; chỉ dòng không in ra hiện nội dung", () => {
    renderWithIntl(<SummaryStep migration={outlined()} applying={false} busy={false} brokenLinks={[]} onApply={() => {}} onCancel={() => {}} />);
    const rows = screen.getAllByRole("listitem").filter((li) => li.hasAttribute("data-status"));
    expect(rows.map((r) => r.getAttribute("data-status"))).toEqual(["kept", "dropped", "receives", "needs_content"]);
    expect(rows[1].querySelector(".line-through")).not.toBeNull();
    expect(rows[1]).toHaveTextContent("NFR-17: Trang chủ tải dưới 2 giây");
    expect(rows[1]).toHaveTextContent("và 2 mục khác");
    for (const i of [0, 2, 3]) expect(rows[i].querySelector("ul")).toBeNull();
    expect(rows[2]).toHaveTextContent("Bảng");
    expect(screen.getByText("Không tốn credit")).toBeInTheDocument();
  });

  it("chi phí khi có dịch + cảnh báo đổi ngôn ngữ; Áp dụng / Quay lại / Huỷ", () => {
    const onApply = vi.fn();
    const onBack = vi.fn();
    const onCancel = vi.fn();
    renderWithIntl(<SummaryStep migration={ready()} applying={false} busy={false} brokenLinks={[]} onApply={onApply} onBack={onBack} onCancel={onCancel} />);
    expect(screen.getByText("6 credit")).toBeInTheDocument();
    expect(screen.getByText(/dịch từ tiếng Việt sang tiếng Anh/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Áp dụng mẫu mới" }));
    expect(onApply).toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Quay lại" }));
    expect(onBack).toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Huỷ lần đổi mẫu" }));
    expect(onCancel).toHaveBeenCalled();
  });

  it("liên kết gãy khoá nút Áp dụng; 409 lúc áp dụng vẫn hiện danh sách", () => {
    const m = { ...ready(), direction: "reverse" as const, broken_links: [{ rule: "dead_reference", path: "use_cases[id=UC-03]", message: "UC-03 trỏ tới mục đã bị bỏ" }] };
    const { unmount } = renderWithIntl(<SummaryStep migration={m} applying={false} busy={false} brokenLinks={[]} onApply={() => {}} onCancel={() => {}} />);
    expect(screen.getByRole("alert")).toHaveTextContent("UC-03 trỏ tới mục đã bị bỏ");
    expect(screen.getByRole("button", { name: "Áp dụng mẫu mới" })).toBeDisabled();
    unmount();
    renderWithIntl(<SummaryStep migration={ready()} applying={false} busy={false} brokenLinks={["UC-04 trỏ tới mục đã bị bỏ"]} onApply={() => {}} onCancel={() => {}} />);
    expect(screen.getByRole("alert")).toHaveTextContent("UC-04 trỏ tới mục đã bị bỏ");
  });
});
