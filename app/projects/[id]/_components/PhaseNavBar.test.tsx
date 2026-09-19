"use client";

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import PhaseNavBar, { phaseState } from "./PhaseNavBar";
import type { StepSummary } from "@/types/pipeline";

const step = (id: string, status: StepSummary["status"]): StepSummary => ({
  id,
  phase: id.split(".")[0],
  label_vi: id,
  label_en: id,
  kind: "fixed",
  status,
  deterministic: false,
  calls_used: 0,
  calls_limit: 8,
  regenerate_used: 0,
  regenerate_limit: 3,
  accepted_at: null,
});

describe("PhaseNavBar", () => {
  const defaultProps = {
    currentPhase: "S-3",
    steps: [step("S-2.1", "accepted"), step("S-3.1", "in_progress"), step("S-4.1", "pending")],
    sidebarOpen: false,
    onToggleSidebar: vi.fn(),
    onExportClick: vi.fn(),
  };

  it("chưa có danh sách step ⇒ hiển thị đủ 12 phase B-0…S-9", () => {
    render(<PhaseNavBar {...defaultProps} steps={[]} />);
    for (const phase of ["B-0", "B-1", "B-2", "S-1", "S-2", "S-3", "S-4", "S-5", "S-6", "S-7", "S-8", "S-9"]) {
      expect(screen.getByText(phase)).toBeInTheDocument();
    }
  });

  it("chỉ hiện phase có step trong danh sách BE (mode 1: step không áp dụng bị bỏ — FLF-185); đánh dấu phase đang chạy và đã xong", () => {
    render(<PhaseNavBar {...defaultProps} />);
    for (const phase of ["B-0", "S-1", "S-5", "S-9"]) expect(screen.queryByText(phase)).not.toBeInTheDocument();
    expect(screen.getByText("S-3").closest("li")).toHaveAttribute("data-state", "active");
    expect(screen.getByText("S-2").closest("li")).toHaveAttribute("data-state", "completed");
    expect(screen.getByText("S-4").closest("li")).toHaveAttribute("data-state", "upcoming");
  });

  it("phaseState: phase không có step chưa tính là xong", () => {
    expect(phaseState("S-5", "S-3", defaultProps.steps)).toBe("upcoming");
  });

  it("Export & Handoff luôn bấm được và gọi onExportClick", () => {
    const onExportClick = vi.fn();
    render(<PhaseNavBar {...defaultProps} onExportClick={onExportClick} />);
    const exportButton = screen.getByRole("button", { name: /Export & Handoff/i });
    expect(exportButton).not.toBeDisabled();
    fireEvent.click(exportButton);
    expect(onExportClick).toHaveBeenCalledTimes(1);
  });

  it("Export đổi style khi active", () => {
    const { rerender } = render(<PhaseNavBar {...defaultProps} />);
    expect(screen.getByRole("button", { name: /Export & Handoff/i })).toHaveClass("bg-[#F4F3FE]");
    rerender(<PhaseNavBar {...defaultProps} exportActive />);
    expect(screen.getByRole("button", { name: /Export & Handoff/i })).toHaveClass("bg-[#191817]");
  });
});
