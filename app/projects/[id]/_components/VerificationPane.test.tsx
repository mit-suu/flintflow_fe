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
  it("tiêu đề dễ hiểu; tóm tắt đếm vấn đề từ danh sách cờ, không từ % accepted", () => {
    const fix: Flag = { ...redFlag, id: "FL03", rule_id: "nfr_missing_number", message: "Chưa có NFR reliability nào" };
    const { container } = renderWithIntl(
      <VerificationPane {...baseProps} flags={[fix, redFlag]} flagsLoading={false} flagsError={null} flagsBusy={false} />
    );

    expect(screen.getByRole("heading", { name: "Kiểm tra tài liệu" })).toBeInTheDocument();
    // array_empty = mục chờ bước sau, không phải vấn đề
    expect(container.textContent).toContain("1 vấn đề cần bạn xử lý");
    expect(container.textContent).toContain("1 mục chờ bước sau");
    expect(screen.queryByText("72% accepted")).toBeNull();
  });

  it("mục trống vì bước chưa chạy nằm ở nhóm Sẽ điền ở bước sau, không có nút Bỏ qua", () => {
    renderWithIntl(<VerificationPane {...baseProps} flags={[redFlag]} flagsLoading={false} flagsError={null} flagsBusy={false} />);

    expect(screen.getByText("Sẽ điền ở bước sau")).toBeInTheDocument();
    expect(screen.queryByText("array_empty")).toBeNull();
    expect(screen.queryByRole("button", { name: "Bỏ qua" })).toBeNull();
  });

  it("vấn đề bỏ qua được thì có nút Bỏ qua", () => {
    renderWithIntl(
      <VerificationPane
        {...baseProps}
        flags={[{ ...redFlag, id: "FL02", rule_id: "unconfirmed_assumption" }]}
        flagsLoading={false}
        flagsError={null}
        flagsBusy={false}
      />
    );

    expect(screen.getByRole("button", { name: "Bỏ qua" })).toBeInTheDocument();
  });

  it("không còn cờ mở thì hiện thông báo trống", () => {
    renderWithIntl(<VerificationPane {...baseProps} flags={[]} flagsLoading={false} flagsError={null} flagsBusy={false} />);

    expect(screen.getByText("Không còn vấn đề nào chặn việc chốt bản.")).toBeInTheDocument();
  });

  it("flagsLoading = true hiện spinner, không render FlagsPanel", () => {
    renderWithIntl(<VerificationPane {...baseProps} flags={[]} flagsLoading={true} flagsError={null} flagsBusy={false} />);

    expect(screen.getByText("Đang tải danh sách vấn đề…")).toBeInTheDocument();
    expect(screen.queryByText("Không còn vấn đề nào chặn việc chốt bản.")).not.toBeInTheDocument();
  });

  it("không còn chuỗi demo cũ (Sinh viên & Tài xế, 84%) trong VerificationPane thật", () => {
    renderWithIntl(<VerificationPane {...baseProps} flags={[redFlag]} flagsLoading={false} flagsError={null} flagsBusy={false} />);

    expect(screen.queryByText(/Sinh viên & Tài xế/)).not.toBeInTheDocument();
    expect(screen.queryByText("84%")).not.toBeInTheDocument();
  });
});
