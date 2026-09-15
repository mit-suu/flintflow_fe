"use client";

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import FlagsPanel from "./FlagsPanel";
import type { Flag } from "@/types/flags";

const baseFlag: Flag = {
  id: "FL01",
  level: "red",
  rule_id: "unconfirmed_assumption",
  section_id: "fixed:5.4",
  target_id: null,
  message: "Còn assumption chưa xác nhận",
  remediation_step: "S-6.2",
  opened_at_version: 2,
  resolved_at: null,
  waived_by_user: false,
  waive_reason: null,
  waived_at_version: null,
};

const notWaivableFlag: Flag = {
  ...baseFlag,
  id: "FL02",
  rule_id: "dead_reference",
  message: "Tham chiếu chết tới F01",
};

describe("FlagsPanel", () => {
  it("hiển thị cờ từ fixture với level/rule_id/section/message/remediation_step", () => {
    render(<FlagsPanel flags={[baseFlag]} onWaive={vi.fn()} onRecompute={vi.fn()} />);

    expect(screen.getByText("red")).toBeInTheDocument();
    expect(screen.getByText("unconfirmed_assumption")).toBeInTheDocument();
    expect(screen.getByText("fixed:5.4")).toBeInTheDocument();
    expect(screen.getByText("Còn assumption chưa xác nhận")).toBeInTheDocument();
    expect(screen.getByText("S-6.2")).toBeInTheDocument();
  });

  it("luật không waive được (dead_reference) không có nút Waive", () => {
    render(<FlagsPanel flags={[notWaivableFlag]} onWaive={vi.fn()} onRecompute={vi.fn()} />);

    expect(screen.queryByRole("button", { name: "Waive" })).not.toBeInTheDocument();
    expect(screen.getByText("Không thể waive")).toBeInTheDocument();
  });

  it("waive hợp lệ (>= 20 ký tự) gọi onWaive rồi đóng modal", async () => {
    const onWaive = vi.fn().mockResolvedValue(undefined);
    render(<FlagsPanel flags={[baseFlag]} onWaive={onWaive} onRecompute={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Waive" }));
    const textarea = await screen.findByLabelText(/Lý do/);
    fireEvent.change(textarea, { target: { value: "Chấp nhận rủi ro vì phạm vi MVP hiện tại" } });

    const confirm = screen.getByRole("button", { name: "Xác nhận waive" });
    expect(confirm).not.toBeDisabled();
    fireEvent.click(confirm);

    await waitFor(() => expect(onWaive).toHaveBeenCalledWith("FL01", "Chấp nhận rủi ro vì phạm vi MVP hiện tại"));
    await waitFor(() => expect(screen.queryByLabelText(/Lý do/)).not.toBeInTheDocument());
  });

  it("lý do dưới 20 ký tự thì nút xác nhận bị khoá", async () => {
    render(<FlagsPanel flags={[baseFlag]} onWaive={vi.fn()} onRecompute={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Waive" }));
    const textarea = await screen.findByLabelText(/Lý do/);
    fireEvent.change(textarea, { target: { value: "Quá ngắn" } });

    expect(screen.getByRole("button", { name: "Xác nhận waive" })).toBeDisabled();
  });

  it("bấm Recompute gọi onRecompute", () => {
    const onRecompute = vi.fn();
    render(<FlagsPanel flags={[]} onWaive={vi.fn()} onRecompute={onRecompute} />);

    fireEvent.click(screen.getByRole("button", { name: /Recompute/ }));
    expect(onRecompute).toHaveBeenCalledTimes(1);
  });

  it("không có cờ mở thì hiện thông báo trống", () => {
    render(<FlagsPanel flags={[]} onWaive={vi.fn()} onRecompute={vi.fn()} />);
    expect(screen.getByText("Không có cờ nào đang mở.")).toBeInTheDocument();
  });
});
