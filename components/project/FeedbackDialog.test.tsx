import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { submitFeedback } from "@/lib/api/feedback";
import FeedbackDialog from "./FeedbackDialog";

vi.mock("@/lib/api/feedback", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/feedback")>()),
  submitFeedback: vi.fn(),
}));

describe("FeedbackDialog (UC-12)", () => {
  beforeEach(() => {
    vi.mocked(submitFeedback).mockReset();
  });

  it("nút gửi khoá khi nội dung rỗng", () => {
    render(<FeedbackDialog open onClose={() => {}} />);
    expect(screen.getByRole("button", { name: "Gửi góp ý" })).toBeDisabled();
  });

  it("gửi category + message đã trim, xong hiện lời cảm ơn", async () => {
    vi.mocked(submitFeedback).mockResolvedValue({ data: null, error: null } as never);
    render(<FeedbackDialog open onClose={() => {}} />);

    fireEvent.click(screen.getByRole("radio", { name: "Báo lỗi" }));
    fireEvent.change(screen.getByLabelText("Nội dung"), { target: { value: "  Nút lưu không chạy  " } });
    fireEvent.click(screen.getByRole("button", { name: "Gửi góp ý" }));

    expect(await screen.findByRole("status")).toHaveTextContent("Cảm ơn bạn");
    expect(submitFeedback).toHaveBeenCalledWith({ category: "bug", message: "Nút lưu không chạy" });
  });

  it("lỗi BE hiện ngay trong form, giữ nội dung đã nhập", async () => {
    vi.mocked(submitFeedback).mockRejectedValue(new Error("Mất kết nối"));
    render(<FeedbackDialog open onClose={() => {}} />);

    fireEvent.change(screen.getByLabelText("Nội dung"), { target: { value: "Ý kiến" } });
    fireEvent.click(screen.getByRole("button", { name: "Gửi góp ý" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Mất kết nối");
    await waitFor(() => expect(screen.getByLabelText("Nội dung")).toHaveValue("Ý kiến"));
  });
});
