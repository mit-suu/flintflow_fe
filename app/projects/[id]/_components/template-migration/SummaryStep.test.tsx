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

  it("mục đã có cặp nhận phần gộp: liệt kê phần theo parts, đếm vào Nhận nội dung; mục in từ dữ liệu có nhãn riêng", () => {
    const m = migrationFixture({
      undecided: [],
      outline: [
        { heading_text: "1.1 Mục đích", level: 2, status: "kept", from_spine: true },
        {
          heading_text: "3.2 Chức năng",
          level: 2,
          status: "receives",
          from_heading: ["Đặc tả use case", "Quy tắc nghiệp vụ"],
          parts: [
            { heading_text: "3.2 Nhóm chức năng", kind: "pair" },
            { heading_text: "Đặc tả use case", kind: "merged" },
            { heading_text: "Quy tắc nghiệp vụ", kind: "merged" },
          ],
        },
        { heading_text: "Đặc tả use case", level: 3, status: "kept", from_heading: ["Đặc tả use case"] },
        { heading_text: "3.3.4 Tính sẵn sàng", level: 3, status: "receives", parts: [{ heading_text: "Độ tin cậy", kind: "distributed" }] },
        { heading_text: "2.5 Giả định", level: 2, status: "receives", from_heading: ["Yêu cầu khác"] },
      ],
    });
    renderWithIntl(<SummaryStep migration={m} applying={false} busy={false} brokenLinks={[]} onApply={() => {}} onCancel={() => {}} />);
    const rows = screen.getAllByRole("listitem").filter((li) => li.hasAttribute("data-status"));
    expect(rows[0]).toHaveTextContent("In từ dữ liệu");
    expect(rows[1]).toHaveTextContent("từ “Đặc tả use case, Quy tắc nghiệp vụ”");
    expect(rows[1]).not.toHaveTextContent("3.2 Nhóm chức năng");
    expect(rows[3]).toHaveTextContent("từ “Độ tin cậy (một phần)”");
    // Bản BE cũ chưa có parts ⇒ theo from_heading
    expect(rows[4]).toHaveTextContent("từ “Yêu cầu khác”");
    expect(screen.getByText(/Nhận nội dung \(3\)/)).toBeInTheDocument();
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
