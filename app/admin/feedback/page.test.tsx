import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { fetchAdminFeedback } from "@/lib/api/admin";
import AdminFeedbackPage from "./page";

vi.mock("@/lib/api/admin", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/admin")>()),
  fetchAdminFeedback: vi.fn(),
}));

describe("AdminFeedbackPage", () => {
  it("hiện góp ý thật: loại, người gửi, nội dung", async () => {
    vi.mocked(fetchAdminFeedback).mockResolvedValue([
      { _id: "f1", category: "bug", message: "Nút lưu không chạy", createdAt: "2026-09-19T03:00:00Z", user: { _id: "u1", email: "a@x.vn", name: "An" } },
      { _id: "f2", category: "other", message: "Hi", createdAt: "2026-09-18T03:00:00Z", user: null },
    ]);
    render(<AdminFeedbackPage />);

    expect(await screen.findByText("Nút lưu không chạy")).toBeInTheDocument();
    expect(screen.getByText("Báo lỗi")).toBeInTheDocument();
    expect(screen.getByText("An")).toBeInTheDocument();
    expect(screen.getByText("Tài khoản đã xoá")).toBeInTheDocument();
  });

  it("rỗng ⇒ thông báo chưa có phản hồi", async () => {
    vi.mocked(fetchAdminFeedback).mockResolvedValue([]);
    render(<AdminFeedbackPage />);
    expect(await screen.findByText("Chưa có phản hồi nào.")).toBeInTheDocument();
  });
});
