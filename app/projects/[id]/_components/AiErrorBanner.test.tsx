import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderWithIntl } from "@/test/intl";
import AiErrorBanner from "./AiErrorBanner";

describe("AiErrorBanner (FLF-332 — AI lỗi: Thử lại ngay / Để sau)", () => {
  it("bước chế độ 2: nói đã thử lại 2 lần, credit đã hoàn; hiện câu BE; hai nút gọi đúng callback", () => {
    const onRetry = vi.fn();
    const onLater = vi.fn();
    renderWithIntl(<AiErrorBanner what="Soạn use case" message="Dịch vụ AI đang gặp sự cố." onRetry={onRetry} onLater={onLater} />);
    expect(screen.getByRole("alert")).toHaveTextContent("Soạn use case: AI lỗi, đã thử lại 2 lần — credit đã hoàn");
    expect(screen.getByText("Dịch vụ AI đang gặp sự cố.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Thử lại ngay" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Để sau" }));
    expect(onLater).toHaveBeenCalledTimes(1);
  });

  it("chat stream (không tự thử lại) ⇒ không nói 'đã thử lại'; không có câu BE ⇒ dùng câu mặc định", () => {
    renderWithIntl(<AiErrorBanner what="Trả lời trong chat" retried={false} onRetry={vi.fn()} onLater={vi.fn()} />);
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Trả lời trong chat: AI lỗi — credit đã hoàn");
    expect(alert).not.toHaveTextContent("đã thử lại");
    expect(alert).toHaveTextContent(/Nội dung đã duyệt giữ nguyên/);
  });

  it("đang thử lại ⇒ nút khoá", () => {
    renderWithIntl(<AiErrorBanner what="X" busy onRetry={vi.fn()} onLater={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Đang thử lại…" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Để sau" })).toBeDisabled();
  });
});
