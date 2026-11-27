import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithIntl } from "@/test/intl";
import CrTimeline from "./CrTimeline";

describe("CrTimeline FLF-466", () => {
  it("status released ⇒ bước cuối hiện nhãn Đã phát hành (VI) / Released (EN)", () => {
    const { unmount } = renderWithIntl(<CrTimeline status="released" />, "vi");
    expect(screen.getByText("Đã phát hành")).toBeInTheDocument();
    expect(screen.queryByText("Ghi Track Changes")).not.toBeInTheDocument();
    unmount();

    renderWithIntl(<CrTimeline status="released" />, "en");
    expect(screen.getByText("Released")).toBeInTheDocument();
    expect(screen.queryByText("Write Track Changes")).not.toBeInTheDocument();
  });

  it("compact (khung chat): 5 bước tới Gửi Lead, nháp gộp vào Làm rõ, bước đã qua có ✓", () => {
    const { unmount } = renderWithIntl(<CrTimeline status="proposing" compact />, "vi");
    const items = screen.getAllByRole("listitem");
    expect(items.map((li) => li.textContent)).toEqual(["✓ Làm rõ", "✓ Phần liên quan", "Đề xuất", "Kiểm tra", "Gửi Lead"]);
    expect(items[2]).toHaveAttribute("aria-current", "step");
    unmount();

    renderWithIntl(<CrTimeline status="draft" compact />, "vi");
    expect(screen.getByText("Làm rõ").closest("li")).toHaveAttribute("aria-current", "step");
  });

  it("CR bị huỷ ⇒ cả thanh xám, thêm pill trạng thái; trang CR vẫn đủ 8 bước", () => {
    const { unmount } = renderWithIntl(<CrTimeline status="cancelled" compact />, "vi");
    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(6);
    expect(items.some((li) => li.getAttribute("aria-current") === "step")).toBe(false);
    unmount();

    renderWithIntl(<CrTimeline status="in_review" />, "vi");
    expect(screen.getAllByRole("listitem")).toHaveLength(8);
    expect(screen.getByText("Duyệt").closest("li")).toHaveAttribute("aria-current", "step");
  });
});

