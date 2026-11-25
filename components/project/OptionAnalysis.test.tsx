import { describe, expect, it } from "vitest";
import { fireEvent, screen } from "@testing-library/react";
import { renderWithIntl, vietnameseLeftovers } from "@/test/intl";
import { OptionAnalysisDetails, OptionAnalysisToggle, RecommendationReason, hasOptionAnalysis } from "./OptionAnalysis";

const option = { pros: ["Fast"], cons: ["Costly"], risks: ["Assumes stable network"] };

describe("FLF-449 OptionAnalysis (dùng chung: thẻ hỏi, hàng việc, danh sách rút)", () => {
  it("hasOptionAnalysis: có ít nhất một mục ở ưu / nhược / rủi ro", () => {
    expect(hasOptionAnalysis({})).toBe(false);
    expect(hasOptionAnalysis({ pros: [], cons: [], risks: [] })).toBe(false);
    expect(hasOptionAnalysis({ risks: ["x"] })).toBe(true);
  });

  it("OptionAnalysisDetails chỉ vẽ danh sách có mục", () => {
    renderWithIntl(<OptionAnalysisDetails option={{ pros: ["Nhanh"], cons: [] }} label="Chi tiết" />);
    expect(screen.getByRole("group", { name: "Chi tiết" })).toBeInTheDocument();
    expect(screen.getByRole("list", { name: "Ưu" })).toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "Nhược" })).toBeNull();
    expect(screen.queryByText("Rủi ro, giả định")).toBeNull();
  });

  it("OptionAnalysisToggle thu gọn mặc định, bấm thì mở / đóng; không có gì thì không vẽ", () => {
    const { container, unmount } = renderWithIntl(<OptionAnalysisToggle option={{}} label="Web" />);
    expect(container).toBeEmptyDOMElement();
    unmount();

    renderWithIntl(<OptionAnalysisToggle option={option} label="Web" />, "en");
    const toggle = screen.getByRole("button", { name: "Show pros and cons" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("Costly")).toBeNull();

    fireEvent.click(toggle);
    expect(screen.getByRole("group", { name: "Pros, cons and risks of option Web" })).toBeInTheDocument();
    expect(screen.getByText("Fast")).toBeInTheDocument();
    expect(screen.getByText("Costly")).toBeInTheDocument();
    expect(screen.getByText("Assumes stable network")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Hide pros and cons" }));
    expect(screen.queryByText("Costly")).toBeNull();
  });

  it("RecommendationReason hiện tiêu đề + lý do; bản en không sót chữ Việt", () => {
    const { container } = renderWithIntl(
      <div>
        <RecommendationReason reason="You said most patients book by phone" />
        <OptionAnalysisToggle option={option} label="Phone" defaultOpen />
      </div>,
      "en",
    );
    expect(screen.getByText("Why recommended:")).toBeInTheDocument();
    expect(screen.getByText("You said most patients book by phone")).toBeInTheDocument();
    expect(vietnameseLeftovers(container)).toEqual([]);
  });
});
