"use client";

import { fireEvent, screen, waitFor } from "@testing-library/react";
import { renderWithIntl } from "@/test/intl";
import { describe, expect, it, vi } from "vitest";
import FlagsPanel, { sortFlags } from "./FlagsPanel";
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
    renderWithIntl(<FlagsPanel flags={[baseFlag]} onWaive={vi.fn()} onRecompute={vi.fn()} />);

    expect(screen.getByText("red")).toBeInTheDocument();
    expect(screen.getByText("unconfirmed_assumption")).toBeInTheDocument();
    expect(screen.getByText("fixed:5.4")).toBeInTheDocument();
    expect(screen.getByText("Còn assumption chưa xác nhận")).toBeInTheDocument();
    expect(screen.getByText("S-6.2")).toBeInTheDocument();
  });

  it("luật không waive được (dead_reference) không có nút Waive", () => {
    renderWithIntl(<FlagsPanel flags={[notWaivableFlag]} onWaive={vi.fn()} onRecompute={vi.fn()} />);

    expect(screen.queryByRole("button", { name: "Waive" })).not.toBeInTheDocument();
    expect(screen.getByText("Không thể waive")).toBeInTheDocument();
  });

  it("waive hợp lệ (>= 20 ký tự) gọi onWaive rồi đóng modal", async () => {
    const onWaive = vi.fn().mockResolvedValue(undefined);
    renderWithIntl(<FlagsPanel flags={[baseFlag]} onWaive={onWaive} onRecompute={vi.fn()} />);

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
    renderWithIntl(<FlagsPanel flags={[baseFlag]} onWaive={vi.fn()} onRecompute={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Waive" }));
    const textarea = await screen.findByLabelText(/Lý do/);
    fireEvent.change(textarea, { target: { value: "Quá ngắn" } });

    expect(screen.getByRole("button", { name: "Xác nhận waive" })).toBeDisabled();
  });

  it("bấm Recompute gọi onRecompute", () => {
    const onRecompute = vi.fn();
    renderWithIntl(<FlagsPanel flags={[]} onWaive={vi.fn()} onRecompute={onRecompute} />);

    fireEvent.click(screen.getByRole("button", { name: /Recompute/ }));
    expect(onRecompute).toHaveBeenCalledTimes(1);
  });

  it("không có cờ mở thì hiện thông báo trống", () => {
    renderWithIntl(<FlagsPanel flags={[]} onWaive={vi.fn()} onRecompute={vi.fn()} />);
    expect(screen.getByText("Không có cờ nào đang mở.")).toBeInTheDocument();
  });
});

describe("FlagsPanel — FLF-177", () => {
  const yellow: Flag = { ...baseFlag, id: "FL10", level: "yellow", rule_id: "orphan_actor", message: "Actor lẻ", remediation_step: "S-3.2" };
  const stale: Flag = { ...baseFlag, id: "FL11", rule_id: "diagram_stale", target_id: "D05", message: "Hình D05 không còn khớp dữ liệu", remediation_step: "S-5.3@S03" };

  it("BUG-34: cờ đỏ luôn đứng trước cờ vàng, rồi tới thứ tự step", () => {
    expect(sortFlags([yellow, stale, baseFlag]).map((f) => f.id)).toEqual(["FL11", "FL01", "FL10"]);
  });

  it("BUG-17: cờ về sơ đồ có nút Vẽ lại; cờ khác thì không", async () => {
    const onRedraw = vi.fn().mockResolvedValue(undefined);
    renderWithIntl(<FlagsPanel flags={[stale, yellow]} onWaive={vi.fn()} onRecompute={vi.fn()} onRedraw={onRedraw} />);

    const redraw = screen.getAllByRole("button", { name: "Vẽ lại" });
    expect(redraw).toHaveLength(1);
    fireEvent.click(redraw[0]);
    await waitFor(() => expect(onRedraw).toHaveBeenCalledWith(stale));
  });
});
