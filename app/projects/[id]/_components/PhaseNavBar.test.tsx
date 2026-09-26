"use client";

import { screen } from "@testing-library/react";
import { renderWithIntl } from "@/test/intl";
import { describe, expect, it } from "vitest";
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
  running: false,
});

describe("PhaseNavBar", () => {
  const defaultProps = {
    currentPhase: "S-3",
    steps: [step("S-2.1", "accepted"), step("S-3.1", "in_progress"), step("S-4.1", "pending")],
  };

  it("chưa có danh sách step ⇒ hiển thị đủ 12 phase B-0…S-9", () => {
    renderWithIntl(<PhaseNavBar {...defaultProps} steps={[]} />);
    for (const phase of ["B-0", "B-1", "B-2", "S-1", "S-2", "S-3", "S-4", "S-5", "S-6", "S-7", "S-8", "S-9"]) {
      expect(screen.getByRole("button", { name: new RegExp(`^${phase.replace("-", "")} · `) })).toBeInTheDocument();
    }
  });

  it("chỉ hiện phase có step trong danh sách BE (mode 1: step không áp dụng bị bỏ — FLF-185); ô tô màu theo trạng thái", () => {
    renderWithIntl(<PhaseNavBar {...defaultProps} />);
    for (const phase of ["B-0", "S-1", "S-5", "S-9"]) expect(screen.queryByRole("button", { name: new RegExp(`^${phase.replace("-", "")} · `) })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^S3 · / }).closest("li")).toHaveAttribute("data-state", "active");
    expect(screen.getByRole("button", { name: /^S3 · / }).closest("button")).toHaveClass("bg-primary");
    expect(screen.getByRole("button", { name: /^S2 · / }).closest("li")).toHaveAttribute("data-state", "completed");
    expect(screen.getByRole("button", { name: /^S2 · / }).closest("button")).toHaveClass("text-primary-hover");
    expect(screen.getByRole("button", { name: /^S2 · / }).closest("button")).not.toHaveClass("bg-primary");
    expect(screen.getByRole("button", { name: /^S4 · / }).closest("li")).toHaveAttribute("data-state", "upcoming");
  });

  it("phaseState: phase không có step chưa tính là xong", () => {
    expect(phaseState("S-5", "S-3", defaultProps.steps)).toBe("upcoming");
  });
});
