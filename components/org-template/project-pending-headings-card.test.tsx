import { fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithIntl } from "@/test/intl";
import * as api from "@/lib/api/org-library";
import ProjectPendingHeadingsCard from "./project-pending-headings-card";

vi.mock("@/lib/api/org-library", () => ({
  getSkeletonPending: vi.fn(),
  decideSkeletonPending: vi.fn(),
  suggestSkeletonNames: vi.fn(),
}));

const pending = (count: number) => ({ template_id: "t1", name: "Khung", version: 1, pending_count: count, headings: [], suggest_credit_cost: 1 });

beforeEach(() => vi.clearAllMocks());

describe("ProjectPendingHeadingsCard", () => {
  it("không có khung hoặc hết mục chờ ⇒ không hiện gì", async () => {
    vi.mocked(api.getSkeletonPending).mockResolvedValue(null);
    const { container } = renderWithIntl(<ProjectPendingHeadingsCard projectId="p1" canReview />);
    await waitFor(() => expect(api.getSkeletonPending).toHaveBeenCalledWith("p1"));
    expect(container).toBeEmptyDOMElement();
  });

  it("có mục chờ ⇒ báo số mục và mở danh sách duyệt tại chỗ", async () => {
    vi.mocked(api.getSkeletonPending).mockResolvedValue(pending(2));
    renderWithIntl(<ProjectPendingHeadingsCard projectId="p1" canReview />);
    fireEvent.click(await screen.findByRole("button", { name: "Duyệt" }));
    expect(screen.getByRole("button", { name: "Thu gọn" })).toBeInTheDocument();
  });

  it("refreshToken đổi (baseline đầu vừa tạo khung) ⇒ đọc lại số mục chờ", async () => {
    vi.mocked(api.getSkeletonPending).mockResolvedValue(null);
    const { rerender } = renderWithIntl(<ProjectPendingHeadingsCard projectId="p1" canReview refreshToken={0} />);
    await waitFor(() => expect(api.getSkeletonPending).toHaveBeenCalledTimes(1));
    vi.mocked(api.getSkeletonPending).mockResolvedValue(pending(1));
    rerender(<ProjectPendingHeadingsCard projectId="p1" canReview refreshToken={1} />);
    await waitFor(() => expect(api.getSkeletonPending).toHaveBeenCalledTimes(2));
    expect(await screen.findByRole("button", { name: "Duyệt" })).toBeInTheDocument();
  });
});
