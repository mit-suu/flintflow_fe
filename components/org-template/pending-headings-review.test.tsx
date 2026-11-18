import { fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithIntl } from "@/test/intl";
import * as api from "@/lib/api/org-library";
import type { SkeletonPending } from "@/types/org-library";
import PendingHeadingsReview from "./pending-headings-review";

vi.mock("@/lib/api/org-library", () => ({
  getSkeletonPending: vi.fn(),
  decideSkeletonPending: vi.fn(),
  suggestSkeletonNames: vi.fn(),
}));

const pending = (over: Partial<SkeletonPending> = {}): SkeletonPending => ({
  template_id: "t1",
  name: "Dự án A — khung",
  version: 1,
  pending_count: 1,
  suggest_credit_cost: 1,
  headings: [
    { key: "B0007", heading_text: "Tích hợp Core Banking ACME", level: 2, kind: "custom", standard_title: null, suggestion: "Tích hợp Core Banking {Tên khách hàng}", suggestion_reason: null, decision: "pending", generic_text: null },
  ],
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(api.getSkeletonPending).mockResolvedValue(pending());
});

describe("PendingHeadingsReview — duyệt mục BA tự đặt", () => {
  it("giữ dạng chung với chữ gợi ý sửa được, rồi lưu quyết định", async () => {
    vi.mocked(api.decideSkeletonPending).mockResolvedValue(pending({ pending_count: 0 }));
    const onChange = vi.fn();
    renderWithIntl(<PendingHeadingsReview projectId="p1" canReview onChange={onChange} />);
    expect(await screen.findByText("Tích hợp Core Banking ACME")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Lưu quyết định" })).toBeDisabled();
    fireEvent.click(screen.getByRole("radio", { name: "Giữ dạng chung" }));
    const input = screen.getByLabelText(/Tên dạng chung/);
    expect(input).toHaveValue("Tích hợp Core Banking {Tên khách hàng}");
    fireEvent.change(input, { target: { value: "Tích hợp hệ thống lõi {Tên khách hàng}" } });
    fireEvent.click(screen.getByRole("button", { name: "Lưu quyết định" }));
    await waitFor(() =>
      expect(api.decideSkeletonPending).toHaveBeenCalledWith("p1", [{ key: "B0007", decision: "generic", generic_text: "Tích hợp hệ thống lõi {Tên khách hàng}" }])
    );
    await waitFor(() => expect(onChange).toHaveBeenCalled());
  });

  it("Gợi ý tên chung hiện credit trước và chỉ gọi khi bấm", async () => {
    vi.mocked(api.suggestSkeletonNames).mockResolvedValue(pending());
    renderWithIntl(<PendingHeadingsReview projectId="p1" canReview />);
    const button = await screen.findByRole("button", { name: "Gợi ý tên chung (1 credit)" });
    expect(api.suggestSkeletonNames).not.toHaveBeenCalled();
    fireEvent.click(button);
    await waitFor(() => expect(api.suggestSkeletonNames).toHaveBeenCalledWith("p1"));
  });

  it("người chỉ xem không có nút lưu / gợi ý; dự án không có khung ⇒ không hiện gì", async () => {
    const { container, rerender } = renderWithIntl(<PendingHeadingsReview projectId="p1" canReview={false} />);
    await screen.findByText("Tích hợp Core Banking ACME");
    expect(screen.queryByRole("button", { name: "Lưu quyết định" })).not.toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Bỏ" })).toBeDisabled();
    vi.mocked(api.getSkeletonPending).mockResolvedValue(null);
    rerender(<PendingHeadingsReview projectId="p2" canReview />);
    await waitFor(() => expect(container).toBeEmptyDOMElement());
  });
});
