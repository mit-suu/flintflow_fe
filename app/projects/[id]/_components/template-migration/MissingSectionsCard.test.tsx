import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithIntl } from "@/test/intl";
import MissingSectionsCard from "./MissingSectionsCard";

const items = [{ id: "f1", label: "Phạm vi", guidance: "[Nêu phạm vi]" }];

describe("MissingSectionsCard", () => {
  it("nút Viết mở form change request điền sẵn tên mục", () => {
    renderWithIntl(<MissingSectionsCard projectId="p1" items={items} canWrite />);
    expect(screen.getByText("Chặn phát hành")).toBeInTheDocument();
    const href = screen.getByRole("link", { name: "Viết" }).getAttribute("href") ?? "";
    const params = new URL(href, "http://localhost").searchParams;
    expect(params.get("panel")).toBe("cr");
    expect(params.get("new")).toBe("1");
    expect(params.get("ref")).toBe("Phạm vi");
    expect(params.get("source")).toBe("gap_report");
  });

  it("có sectionId thì tham chiếu nguồn của CR là mã mục, để biết đúng mục cần viết", () => {
    renderWithIntl(<MissingSectionsCard projectId="p1" items={[{ ...items[0], sectionId: "fixed:5.4" }]} canWrite />);
    const href = screen.getByRole("link", { name: "Viết" }).getAttribute("href") ?? "";
    expect(new URL(href, "http://localhost").searchParams.get("ref")).toBe("fixed:5.4");
  });

  it("Viewer không có nút viết; không có mục thiếu thì không hiện gì", () => {
    const { container, rerender } = renderWithIntl(<MissingSectionsCard projectId="p1" items={items} canWrite={false} />);
    expect(screen.queryByRole("link", { name: "Viết" })).not.toBeInTheDocument();
    rerender(<MissingSectionsCard projectId="p1" items={[]} canWrite />);
    expect(container).toBeEmptyDOMElement();
  });
});
