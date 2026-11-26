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
});

