"use client";

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import PhaseNavBar from "./PhaseNavBar";
import type { SectionItem } from "@/types/document";

describe("PhaseNavBar", () => {
  const mockSections: SectionItem[] = [
    {
      type: "vision",
      content: "Vision content",
      status: "accepted",
    },
  ];

  const defaultProps = {
    currentPhase: "discovery" as const,
    sections: mockSections,
    progressPercent: 0,
    sidebarOpen: false,
    onToggleSidebar: vi.fn(),
    onPhaseClick: vi.fn(),
    onVerificationClick: vi.fn(),
    verificationOpen: false,
    verificationFlagsCount: 0,
  };

  it("Export button luôn bấm được (enabled) khi progressPercent = 0", () => {
    render(<PhaseNavBar {...defaultProps} progressPercent={0} />);

    const exportButton = screen.getByRole("button", {
      name: /Export & Handoff/i,
    });

    expect(exportButton).not.toBeDisabled();
    expect(exportButton).toHaveClass("cursor-pointer");
  });

  it("Export button luôn bấm được (enabled) khi progressPercent = 50", () => {
    render(<PhaseNavBar {...defaultProps} progressPercent={50} />);

    const exportButton = screen.getByRole("button", {
      name: /Export & Handoff/i,
    });

    expect(exportButton).not.toBeDisabled();
    expect(exportButton).toHaveClass("cursor-pointer");
  });

  it("Export button luôn bấm được (enabled) khi progressPercent = 99", () => {
    render(<PhaseNavBar {...defaultProps} progressPercent={99} />);

    const exportButton = screen.getByRole("button", {
      name: /Export & Handoff/i,
    });

    expect(exportButton).not.toBeDisabled();
    expect(exportButton).toHaveClass("cursor-pointer");
  });

  it("gọi onPhaseClick('export') khi bấm Export button", () => {
    const onPhaseClick = vi.fn();
    render(
      <PhaseNavBar
        {...defaultProps}
        onPhaseClick={onPhaseClick}
      />
    );

    const exportButton = screen.getByRole("button", {
      name: /Export & Handoff/i,
    });

    fireEvent.click(exportButton);

    expect(onPhaseClick).toHaveBeenCalledWith("export");
  });

  it("Export button thay đổi style khi active", () => {
    const { rerender } = render(
      <PhaseNavBar
        {...defaultProps}
        currentPhase="discovery"
      />
    );

    let exportButton = screen.getByRole("button", {
      name: /Export & Handoff/i,
    });
    expect(exportButton).toHaveClass("bg-[#F4F3FE]"); // inactive style

    rerender(
      <PhaseNavBar
        {...defaultProps}
        currentPhase="export"
      />
    );

    exportButton = screen.getByRole("button", {
      name: /Export & Handoff/i,
    });
    expect(exportButton).toHaveClass("bg-[#191817]"); // active style
  });
});
