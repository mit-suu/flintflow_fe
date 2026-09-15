"use client";

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import ReadinessSummary from "./ReadinessSummary";
import type { Readiness } from "@/types/pipeline";

describe("ReadinessSummary", () => {
  it("null ⇒ hiện trạng thái đang tải, không có nội dung readiness", () => {
    render(<ReadinessSummary readiness={null} />);
    expect(screen.getByText("Đang tải điểm sẵn sàng…")).toBeInTheDocument();
  });

  it("hiện '72% accepted · 4 chờ duyệt lại · 2 cờ đỏ' — chỉ một chỗ dùng '%' (mô tả tình trạng, không phải điều kiện chốt)", () => {
    const readiness: Readiness = { accepted_pct: 72, awaiting_reaccept: 4, red_open: 2, stale: 0 };
    const { container } = render(<ReadinessSummary readiness={readiness} />);

    expect(screen.getByText("72% accepted")).toBeInTheDocument();
    expect(screen.getByText("4 chờ duyệt lại")).toBeInTheDocument();
    expect(screen.getByText("2 cờ đỏ")).toBeInTheDocument();
    // Đúng một dấu "%" trong toàn panel — không có điều kiện chốt nào khác trình bày bằng %.
    expect(container.textContent?.match(/%/g)?.length).toBe(1);
  });

  it("stale = 0 thì không hiện 'mục cũ'", () => {
    render(<ReadinessSummary readiness={{ accepted_pct: 50, awaiting_reaccept: 0, red_open: 0, stale: 0 }} />);
    expect(screen.queryByText(/mục cũ/)).not.toBeInTheDocument();
  });

  it("stale > 0 thì hiện 'N mục cũ'", () => {
    render(<ReadinessSummary readiness={{ accepted_pct: 50, awaiting_reaccept: 0, red_open: 0, stale: 3 }} />);
    expect(screen.getByText("3 mục cũ")).toBeInTheDocument();
  });

  it("red_open = 0 không dùng màu cảnh báo cho '0 cờ đỏ'", () => {
    render(<ReadinessSummary readiness={{ accepted_pct: 100, awaiting_reaccept: 0, red_open: 0, stale: 0 }} />);
    const redOpen = screen.getByText("0 cờ đỏ");
    expect(redOpen.className).toContain("#1F7A45");
  });
});
