import { fireEvent, screen } from "@testing-library/react";
import { renderWithIntl } from "@/test/intl";
import { describe, expect, it, vi } from "vitest";
import { stepLabel } from "@/lib/constants/step-registry";
import StepProgressBar from "../StepProgressBar";
import type { StepProgress, StepSummary } from "@/types/pipeline";

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

const steps = [step("S-2.5", "accepted"), step("S-3.1", "pending"), step("S-3.2", "pending")];
const progress = (over: Partial<StepProgress> = {}): StepProgress => ({
  done: 17,
  total: 56,
  current_phase: "S-3",
  current_step: "S-3.1",
  show_percent: false,
  ...over,
});

describe("StepProgressBar", () => {
  it("mỗi bước là thẻ có tên; không ghi tổng số bước; ẩn % khi N chưa chốt", () => {
    renderWithIntl(<StepProgressBar steps={steps} progress={progress()} selectedStepId={null} onSelectStep={vi.fn()} />);
    expect(screen.getByRole("button", { name: /^S-3\.1/ })).toHaveTextContent(stepLabel("S-3.1"));
    expect(screen.queryByText(/17\/56/)).not.toBeInTheDocument();
    expect(screen.queryByTestId("step-percent")).not.toBeInTheDocument();
  });

  it("`phase` ⇒ chỉ hiện bước của phase đó", () => {
    renderWithIntl(<StepProgressBar phase="S-3" steps={steps} progress={progress()} selectedStepId={null} onSelectStep={vi.fn()} />);
    expect(screen.queryByRole("button", { name: /^S-2\.5/ })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^S-3\.2/ })).toBeInTheDocument();
  });

  it("hiện % sau khi S-4.1 chốt N", () => {
    renderWithIntl(<StepProgressBar steps={steps} progress={progress({ show_percent: true, done: 28 })} selectedStepId={null} onSelectStep={vi.fn()} />);
    expect(screen.getByTestId("step-percent")).toHaveTextContent("50%");
  });

  it("bấm step đã accepted hoặc step hiện tại; step chưa tới bị khoá", () => {
    const onSelectStep = vi.fn();
    renderWithIntl(<StepProgressBar steps={steps} progress={progress()} selectedStepId={null} onSelectStep={onSelectStep} />);

    fireEvent.click(screen.getByRole("button", { name: /^S-2\.5/ }));
    expect(onSelectStep).toHaveBeenCalledWith("S-2.5");

    const current = screen.getByRole("button", { name: /^S-3\.1/ });
    expect(current).toHaveAttribute("aria-current", "step");
    fireEvent.click(current);
    expect(onSelectStep).toHaveBeenCalledWith("S-3.1");

    expect(screen.getByRole("button", { name: /^S-3\.2/ })).toBeDisabled();
  });

  it("mode 1 v2 (FLF-185): step của đầu mục FPT thiếu ⇒ chấm đỏ + nhãn Thiếu; hết khi step đã chốt", () => {
    const list = [step("S-2.5", "accepted"), step("S-3.1", "pending"), step("S-7.1", "pending")];
    const { rerender } = renderWithIntl(
      <StepProgressBar steps={list} progress={progress()} selectedStepId={null} onSelectStep={vi.fn()} missingStepIds={new Set(["S-7.1", "S-2.5"])} />
    );
    expect(screen.getByTestId("step-missing")).toHaveTextContent("Thiếu 1");
    expect(screen.getByRole("button", { name: /^S-7\.1 .*\(Thiếu\)$/ })).toHaveAttribute("data-missing", "true");
    // S-2.5 thuộc kế hoạch "thiếu" nhưng đã accepted ⇒ không còn đỏ
    expect(screen.getByRole("button", { name: /^S-2\.5/ })).not.toHaveAttribute("data-missing");
    rerender(<StepProgressBar steps={list} progress={progress()} selectedStepId={null} onSelectStep={vi.fn()} />);
    expect(screen.queryByTestId("step-missing")).not.toBeInTheDocument();
  });
});
