import { fireEvent, screen, waitFor } from "@testing-library/react";
import { renderWithIntl } from "@/test/intl";
import { describe, expect, it, vi } from "vitest";
import { stepLabel } from "@/lib/constants/step-registry";
import WorkspaceProgressRail from "../WorkspaceProgressRail";
import type { StepSummary } from "@/types/pipeline";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

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

const STEPS = [step("S-2.1", "accepted"), step("S-3.1", "accepted"), step("S-3.2", "in_progress"), step("S-4.1", "pending")];
const PROGRESS = { done: 2, total: 4, current_phase: "S-3", current_step: "S-3.2", show_percent: false };

const renderRail = (onHide = vi.fn()) =>
  renderWithIntl(
    <WorkspaceProgressRail
      onHide={onHide}
      currentPhase="S-3"
      steps={STEPS}
      progress={PROGRESS}
      selectedStepId={null}
      onSelectStep={vi.fn()}
      readinessPercent={24}
      workingMode="fast"
      onChangeWorkingMode={vi.fn()}
    />
  );

describe("WorkspaceProgressRail", () => {
  it("giai đoạn đang làm mở sẵn; mở thêm giai đoạn khác không đóng cái cũ; nút thu gọn tất cả", async () => {
    renderRail();
    const current = screen.getByRole("button", { name: /^S-3\.2/ });
    expect(current).toHaveAttribute("aria-current", "step");
    expect(current).toHaveTextContent(stepLabel("S-3.2"));
    expect(screen.getByText("24% accepted")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /^S2 · / }));
    expect(screen.getByRole("button", { name: /^S-2\.1/ })).toBeInTheDocument();
    // Mở giai đoạn khác không tự đóng giai đoạn đang mở
    expect(screen.getByRole("button", { name: /^S-3\.2/ })).toBeInTheDocument();

    // Một nút bật/tắt: đang mở ⇒ gập hết; gập hết ⇒ mở hết
    fireEvent.click(screen.getByRole("button", { name: "Thu gọn tất cả bước" }));
    // Danh sách bước trượt đóng xong mới gỡ khỏi DOM
    await waitFor(() => expect(screen.queryByRole("button", { name: /^S-2\.1/ })).not.toBeInTheDocument());
    expect(screen.queryByRole("button", { name: /^S-3\.2/ })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Mở rộng tất cả bước" }));
    for (const id of [/^S-2\.1/, /^S-3\.2/, /^S-4\.1/]) expect(screen.getByRole("button", { name: id })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Thu gọn tất cả bước" })).toBeInTheDocument();
  });

  it("nút ẩn ở đầu rail", () => {
    const onHide = vi.fn();
    renderRail(onHide);
    fireEvent.click(screen.getByRole("button", { name: "Ẩn tiến độ" }));
    expect(onHide).toHaveBeenCalledTimes(1);
  });
});
