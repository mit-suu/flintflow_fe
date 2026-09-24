"use client";

import { screen } from "@testing-library/react";
import { renderWithIntl } from "@/test/intl";
import { describe, expect, it } from "vitest";
import ReadinessSummary from "./ReadinessSummary";

describe("ReadinessSummary", () => {
  it("null ⇒ hiện trạng thái đang tải", () => {
    renderWithIntl(<ReadinessSummary counts={null} />);
    expect(screen.getByText("Đang kiểm tra tài liệu…")).toBeInTheDocument();
  });

  it("có vấn đề ⇒ nói số vấn đề cần xử lý, mục chờ bước sau tách riêng", () => {
    const { container } = renderWithIntl(<ReadinessSummary counts={{ blocking: 2, suggestions: 5, later: 11 }} />);
    expect(container.textContent).toContain("2 vấn đề cần bạn xử lý");
    expect(container.textContent).toContain("11 mục chờ bước sau");
    // Không phải điều kiện chốt nên không trình bày bằng %
    expect(container.textContent).not.toContain("%");
  });

  it("không còn vấn đề ⇒ báo xong, không nhắc mục chờ khi không có", () => {
    const { container } = renderWithIntl(<ReadinessSummary counts={{ blocking: 0, suggestions: 3, later: 0 }} />);
    expect(screen.getByText("Không có vấn đề cần xử lý")).toBeInTheDocument();
    expect(container.textContent).not.toContain("chờ bước sau");
  });
});
