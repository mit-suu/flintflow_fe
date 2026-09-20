import { fireEvent, screen } from "@testing-library/react";
import { renderWithIntl } from "@/test/intl";
import { describe, expect, it, vi } from "vitest";
import { formatDateTime } from "./labels";
import PausedBanner from "./PausedBanner";

const AT = "2026-09-19T03:15:00.000Z";

describe("PausedBanner — bước AI tạm dừng (UC-61, UC-75)", () => {
  it("hết credit ⇒ lý do credit, link nạp credit, bấm Tiếp tục gọi onResume", () => {
    const onResume = vi.fn();
    renderWithIntl(<PausedBanner paused={{ reason: "credits", at: AT }} what="Trích field" onResume={onResume} />);

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Trích field đang tạm dừng — hết credit");
    expect(alert).toHaveTextContent("Nạp thêm credit rồi bấm Tiếp tục");
    expect(screen.getByRole("link", { name: "Nạp credit" })).toHaveAttribute("href", "/home/billing");
    expect(screen.getByText("savings")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Tiếp tục" }));
    expect(onResume).toHaveBeenCalledTimes(1);
  });

  it("lỗi AI sau 2 lần thử (resume_later) ⇒ báo đã hoàn credit, không có link nạp; vẫn tiếp tục được", () => {
    const onResume = vi.fn();
    renderWithIntl(<PausedBanner paused={{ reason: "resume_later", at: AT }} what="Đề xuất sửa" onResume={onResume} />);

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Đề xuất sửa đang tạm dừng — AI lỗi, đã thử lại 2 lần");
    expect(alert).toHaveTextContent("Credit đã giữ được hoàn lại");
    expect(screen.queryByRole("link", { name: "Nạp credit" })).not.toBeInTheDocument();
    expect(screen.getByText("cloud_off")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Tiếp tục" }));
    expect(onResume).toHaveBeenCalledTimes(1);
  });

  it("đang chạy lại (busy) ⇒ nút đổi nhãn và bị khoá", () => {
    const onResume = vi.fn();
    renderWithIntl(<PausedBanner paused={{ reason: "credits", at: AT }} what="Kiểm tra" onResume={onResume} busy />);
    const button = screen.getByRole("button", { name: "Đang chạy…" });
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(onResume).not.toHaveBeenCalled();
  });

  it("hiện thời điểm dừng; thời điểm không hợp lệ giữ nguyên chuỗi", () => {
    const { rerender } = renderWithIntl(<PausedBanner paused={{ reason: "credits", at: AT }} what="Trích field" onResume={vi.fn()} />);
    expect(formatDateTime(AT)).not.toBe(AT);
    expect(screen.getByRole("alert")).toHaveTextContent(`(${formatDateTime(AT)})`);
    rerender(<PausedBanner paused={{ reason: "credits", at: "không-phải-ngày" }} what="Trích field" onResume={vi.fn()} />);
    expect(screen.getByRole("alert")).toHaveTextContent("(không-phải-ngày)");
  });
});
