import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderWithIntl } from "@/test/intl";
import CreditGateCard from "./CreditGateCard";

const base = {
  title: "Soạn phần còn lại của SRS",
  lines: [
    { label: "Giai đoạn S-1 · 4 bước", credits: 17 },
    { label: "Giai đoạn S-2 · 5 bước", credits: 21 },
  ],
  total: 38,
};

describe("CreditGateCard (FLF-332 — cổng cứng xác nhận credit)", () => {
  it("hiện từng dòng, tổng ước tính và số khả dụng; Chạy / Huỷ gọi đúng callback", () => {
    const onRun = vi.fn();
    const onCancel = vi.fn();
    renderWithIntl(<CreditGateCard {...base} available={120} onRun={onRun} onCancel={onCancel} />);
    expect(screen.getByRole("dialog", { name: "Xác nhận credit trước khi chạy" })).toBeInTheDocument();
    expect(screen.getByText("Giai đoạn S-2 · 5 bước")).toBeInTheDocument();
    expect(screen.getByText("Tổng ước tính: ~38 credit")).toBeInTheDocument();
    expect(screen.getByText("Khả dụng: 120 credit")).toBeInTheDocument();
    expect(screen.queryByRole("status")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Huỷ" }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onRun).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Chạy" }));
    expect(onRun).toHaveBeenCalledTimes(1);
  });

  it("số dư thấp hơn ước tính ⇒ cảnh báo kèm link nạp", () => {
    renderWithIntl(<CreditGateCard {...base} available={10} onRun={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByRole("status")).toHaveTextContent(/Số dư chưa đủ/);
    expect(screen.getByRole("link", { name: "Nạp thêm" })).toHaveAttribute("href", "/home/billing");
  });

  it("không biết số dư ⇒ không hiện dòng khả dụng, không cảnh báo", () => {
    renderWithIntl(<CreditGateCard {...base} available={null} onRun={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.queryByText(/Khả dụng/)).toBeNull();
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("đang chạy ⇒ hai nút khoá, nút Chạy đổi chữ", () => {
    renderWithIntl(<CreditGateCard {...base} available={120} busy onRun={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Đang chạy…" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Huỷ" })).toBeDisabled();
  });
});
