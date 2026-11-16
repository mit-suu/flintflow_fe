import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderWithIntl } from "@/test/intl";
import { migrationFixture } from "./migration-fixture.test-helper";
import SummaryStep from "./SummaryStep";

const ready = () =>
  migrationFixture({
    state: "ready",
    undecided: [],
    credit_estimate: { translation: { chars: 9000, batches: 3, credits: 6 }, structural_moves: { count: 1, credits: 1 }, ai_resolve: { count: 2, credits: 4 }, total: 11 },
    language: { source: "vi", target: "en", needs_translation: true, switches_document_language: false },
  });

describe("SummaryStep", () => {
  it("nêu credit ước tính, cảnh báo đổi ngôn ngữ và áp dụng / huỷ", () => {
    const onApply = vi.fn();
    const onCancel = vi.fn();
    renderWithIntl(<SummaryStep migration={ready()} applying={false} busy={false} brokenLinks={[]} onApply={onApply} onCancel={onCancel} />);
    expect(screen.getByText("Dịch (3 lô)")).toBeInTheDocument();
    expect(screen.getByText("11")).toBeInTheDocument();
    expect(screen.getByText(/dịch từ tiếng Việt sang tiếng Anh/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Áp dụng" }));
    expect(onApply).toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Huỷ đổi mẫu" }));
    expect(onCancel).toHaveBeenCalled();
  });

  it("đổi ngôn ngữ không dịch (mode 2): chỉ cảnh báo, không có dòng credit dịch", () => {
    const m = ready();
    renderWithIntl(<SummaryStep migration={{ ...m, language: { ...m.language, needs_translation: false, switches_document_language: true } }} applying={false} busy={false} brokenLinks={[]} onApply={() => {}} onCancel={() => {}} />);
    expect(screen.queryByText(/^Dịch \(/)).not.toBeInTheDocument();
    expect(screen.getByText(/Nội dung không bị dịch lại/)).toBeInTheDocument();
  });

  it("liên kết gãy (BE tính trước) hiện trước khi áp dụng và khoá nút Áp dụng", () => {
    const m = { ...ready(), direction: "reverse" as const, broken_links: [{ rule: "dead_reference", path: "use_cases[id=UC-03]", message: "UC-03 trỏ tới mục đã bị bỏ" }] };
    renderWithIntl(<SummaryStep migration={m} applying={false} busy={false} brokenLinks={[]} onApply={() => {}} onCancel={() => {}} />);
    expect(screen.getByRole("alert")).toHaveTextContent("UC-03 trỏ tới mục đã bị bỏ");
    expect(screen.getByRole("button", { name: "Áp dụng" })).toBeDisabled();
  });

  it("409 lúc áp dụng vẫn hiện danh sách liên kết gãy", () => {
    renderWithIntl(<SummaryStep migration={ready()} applying={false} busy={false} brokenLinks={["UC-04 trỏ tới mục đã bị bỏ"]} onApply={() => {}} onCancel={() => {}} />);
    expect(screen.getByRole("alert")).toHaveTextContent("UC-04 trỏ tới mục đã bị bỏ");
  });
});
