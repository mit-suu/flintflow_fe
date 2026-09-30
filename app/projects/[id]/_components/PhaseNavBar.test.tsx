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

  it("chưa có danh sách step ⇒ đủ 12 giai đoạn, gọi bằng tên đời thường, không mã B-x / S-x", () => {
    renderWithIntl(<PhaseNavBar {...defaultProps} steps={[]} />);
    const names = ["Ý tưởng", "Làm rõ ý tưởng", "Chốt tóm tắt", "Phân tích", "Tổng quan", "Người dùng", "Hệ thống", "Chi tiết màn", "Phi chức năng", "Phụ lục", "Hoàn thiện", "Kiểm & chốt"];
    for (const name of names) expect(screen.getByRole("button", { name })).toBeInTheDocument();
    expect(screen.getAllByRole("button")).toHaveLength(12);
  });

  it("mã giai đoạn chỉ nằm trong tooltip, không hiện trên nhãn", () => {
    renderWithIntl(<PhaseNavBar {...defaultProps} steps={[]} />);
    const button = screen.getByRole("button", { name: "Người dùng" });
    expect(button).toHaveAttribute("title", "Giai đoạn S-3");
    expect(button).not.toHaveTextContent(/S-?3/);
  });

  it("Ý tưởng (B-0) là một mục đơn: không mũi tên, không aria-expanded, không xổ bước con", () => {
    renderWithIntl(
      <PhaseNavBar
        currentPhase="B-0"
        steps={[step("B-0.1", "in_progress"), step("B-0.2", "pending"), step("B-0.3", "pending")]}
        openPhases={new Set(["B-0"])}
        renderPhaseBody={() => <span>BUOC-CON</span>}
      />
    );
    const idea = screen.getByRole("button", { name: "Ý tưởng" });
    expect(idea).not.toHaveAttribute("aria-expanded");
    expect(screen.queryByText("BUOC-CON")).toBeNull();
  });

  it("chỉ hiện phase có step trong danh sách BE (mode 1: step không áp dụng bị bỏ — FLF-185); ô tô màu theo trạng thái", () => {
    renderWithIntl(<PhaseNavBar {...defaultProps} />);
    for (const name of ["Ý tưởng", "Phân tích", "Chi tiết màn", "Kiểm & chốt"]) expect(screen.queryByRole("button", { name })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Người dùng" }).closest("li")).toHaveAttribute("data-state", "active");
    expect(screen.getByRole("button", { name: "Người dùng" }).closest("button")).toHaveClass("bg-primary");
    expect(screen.getByRole("button", { name: "Tổng quan" }).closest("li")).toHaveAttribute("data-state", "completed");
    expect(screen.getByRole("button", { name: "Tổng quan" }).closest("button")).toHaveClass("text-primary-hover");
    expect(screen.getByRole("button", { name: "Tổng quan" }).closest("button")).not.toHaveClass("bg-primary");
    expect(screen.getByRole("button", { name: "Hệ thống" }).closest("li")).toHaveAttribute("data-state", "upcoming");
  });

  it("phaseState: phase không có step chưa tính là xong", () => {
    expect(phaseState("S-5", "S-3", defaultProps.steps)).toBe("upcoming");
  });
});
