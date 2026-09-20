"use client";

import { screen } from "@testing-library/react";
import { renderWithIntl } from "@/test/intl";
import { describe, expect, it, vi } from "vitest";
import VerificationPane from "./VerificationPane";
import type { Flag } from "@/types/flags";
import type { Readiness } from "@/types/pipeline";

const readiness: Readiness = { accepted_pct: 72, awaiting_reaccept: 4, red_open: 2, stale: 0 };

const redFlag: Flag = {
  id: "FL01",
  level: "red",
  rule_id: "array_empty",
  section_id: "fixed:2.1",
  target_id: null,
  message: "Actors đang rỗng",
  remediation_step: "S-3.1",
  opened_at_version: 3,
  resolved_at: null,
  waived_by_user: false,
  waive_reason: null,
  waived_at_version: null,
};

const baseProps = {
  readiness,
  onClose: () => {},
  onWaive: vi.fn(),
  onRecompute: vi.fn(),
};

describe("VerificationPane", () => {
  it("hiện readiness summary theo format '% accepted · N chờ duyệt lại · N cờ đỏ'", () => {
    renderWithIntl(<VerificationPane {...baseProps} flags={[]} flagsLoading={false} flagsError={null} flagsBusy={false} />);

    expect(screen.getByText("72% accepted")).toBeInTheDocument();
    expect(screen.getByText("4 chờ duyệt lại")).toBeInTheDocument();
    expect(screen.getByText("2 cờ đỏ")).toBeInTheDocument();
  });

  it("hiện cờ từ props (page.tsx nâng useFlags lên); không cho waive rule array_empty", () => {
    renderWithIntl(<VerificationPane {...baseProps} flags={[redFlag]} flagsLoading={false} flagsError={null} flagsBusy={false} />);

    expect(screen.getByText("Actors đang rỗng")).toBeInTheDocument();
    expect(screen.getByText("array_empty")).toBeInTheDocument();
    expect(screen.getByText("Không thể waive")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Waive" })).not.toBeInTheDocument();
  });

  it("cờ waive được thì có nút Waive", () => {
    renderWithIntl(
      <VerificationPane
        {...baseProps}
        flags={[{ ...redFlag, id: "FL02", rule_id: "unconfirmed_assumption" }]}
        flagsLoading={false}
        flagsError={null}
        flagsBusy={false}
      />
    );

    expect(screen.getByRole("button", { name: "Waive" })).toBeInTheDocument();
  });

  it("không còn cờ mở thì hiện thông báo trống", () => {
    renderWithIntl(<VerificationPane {...baseProps} flags={[]} flagsLoading={false} flagsError={null} flagsBusy={false} />);

    expect(screen.getByText("Không có cờ nào đang mở.")).toBeInTheDocument();
  });

  it("flagsLoading = true hiện spinner, không render FlagsPanel", () => {
    renderWithIntl(<VerificationPane {...baseProps} flags={[]} flagsLoading={true} flagsError={null} flagsBusy={false} />);

    expect(screen.getByText("Đang tải danh sách cờ…")).toBeInTheDocument();
    expect(screen.queryByText("Không có cờ nào đang mở.")).not.toBeInTheDocument();
  });

  it("không còn chuỗi demo cũ (Sinh viên & Tài xế, 84%) trong VerificationPane thật", () => {
    renderWithIntl(<VerificationPane {...baseProps} flags={[redFlag]} flagsLoading={false} flagsError={null} flagsBusy={false} />);

    expect(screen.queryByText(/Sinh viên & Tài xế/)).not.toBeInTheDocument();
    expect(screen.queryByText("84%")).not.toBeInTheDocument();
  });
});
