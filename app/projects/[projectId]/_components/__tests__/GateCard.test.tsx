import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import GateCard from "../GateCard";
import type { GateAction } from "@/types/pipeline";

const ALL: GateAction[] = ["accept", "revision", "regenerate"];

describe("GateCard", () => {
  it("Accept gọi onAction ngay; Regenerate hiện số lượt đã dùng", () => {
    const onAction = vi.fn();
    render(<GateCard stepId="S-3.1" actions={ALL} regenerateUsed={1} onAction={onAction} />);

    fireEvent.click(screen.getByRole("button", { name: /Accept$/ }));
    expect(onAction).toHaveBeenCalledWith("accept");

    const regenerate = screen.getByRole("button", { name: /Regenerate \(1\/3\)/ });
    expect(regenerate).not.toBeDisabled();
    fireEvent.click(regenerate);
    expect(onAction).toHaveBeenCalledWith("regenerate");
  });

  it("hết 3 lượt Regenerate ⇒ nút tắt, Accept as-is xuất hiện", () => {
    render(<GateCard stepId="S-3.1" actions={["accept", "revision", "accept_as_is"]} regenerateUsed={3} onAction={vi.fn()} />);
    expect(screen.getByRole("button", { name: /Regenerate \(3\/3\)/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Accept as-is" })).toBeInTheDocument();
  });

  it("chưa hết Regenerate thì không hiện Accept as-is", () => {
    render(<GateCard stepId="S-3.1" actions={ALL} regenerateUsed={0} onAction={vi.fn()} />);
    expect(screen.queryByRole("button", { name: "Accept as-is" })).not.toBeInTheDocument();
  });

  it("Accept as-is bắt buộc lý do trước khi gửi", () => {
    const onAction = vi.fn();
    render(<GateCard stepId="S-3.1" actions={["accept", "accept_as_is"]} regenerateUsed={3} onAction={onAction} />);

    fireEvent.click(screen.getByRole("button", { name: "Accept as-is" }));
    const confirm = screen.getByRole("button", { name: "Xác nhận Accept as-is" });
    expect(confirm).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/Lý do chấp nhận/), { target: { value: "   " } });
    expect(confirm).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/Lý do chấp nhận/), { target: { value: "Khách hàng đồng ý bản này" } });
    fireEvent.click(confirm);
    expect(onAction).toHaveBeenCalledWith("accept_as_is", "Khách hàng đồng ý bản này");
  });

  it("Request revision cần ghi chú", () => {
    const onAction = vi.fn();
    render(<GateCard stepId="S-3.1" actions={ALL} regenerateUsed={0} onAction={onAction} />);
    fireEvent.click(screen.getByRole("button", { name: /Request revision/ }));
    fireEvent.change(screen.getByLabelText("Cần sửa gì?"), { target: { value: "Thiếu actor Guest" } });
    fireEvent.click(screen.getByRole("button", { name: "Gửi yêu cầu sửa" }));
    expect(onAction).toHaveBeenCalledWith("revision", "Thiếu actor Guest");
  });

  it("busy thì khoá mọi hành động", () => {
    render(<GateCard stepId="S-3.1" actions={ALL} regenerateUsed={0} busy onAction={vi.fn()} />);
    expect(screen.getByRole("button", { name: /Accept$/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Regenerate/ })).toBeDisabled();
  });
});
