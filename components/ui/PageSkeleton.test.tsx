import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import PageSkeleton from "./PageSkeleton";

describe("PageSkeleton — khối giữ chỗ lúc vào trang", () => {
  it("mặc định là variant `page`, có nhãn cho trình đọc màn hình", () => {
    render(<PageSkeleton label="Đang tải hồ sơ" />);

    const root = screen.getByRole("status", { name: "Đang tải hồ sơ" });
    expect(root).toHaveAttribute("aria-busy", "true");
    expect(root).toHaveAttribute("data-variant", "page");
  });

  it("`rows` quyết định số khối giữ chỗ — mỗi khối là một vệt gradient `.ff-skeleton`", () => {
    const { container } = render(<PageSkeleton variant="list" rows={3} />);

    // 3 dòng × (avatar + 2 dòng chữ + mốc thời gian)
    expect(container.querySelectorAll(".ff-skeleton")).toHaveLength(12);
  });

  it("`bare` ⇒ bỏ nền/viền vì trang đã tự bọc thẻ trắng rồi", () => {
    const { container: plain } = render(<PageSkeleton variant="table" rows={1} />);
    const { container: bare } = render(<PageSkeleton variant="table" rows={1} bare />);

    expect(plain.querySelector(".rounded-card")).toBeInTheDocument();
    expect(bare.querySelector(".rounded-card")).not.toBeInTheDocument();
  });
});
