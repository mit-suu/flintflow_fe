import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderWithIntl, vietnameseLeftovers } from "@/test/intl";
import type { Project } from "@/types/project";
import type { StepSummary } from "@/types/pipeline";
import { initialRunnerState, runnerDetail, type RunnerState } from "../../hooks/useStepRunner";
import WorkspaceHeader from "../WorkspaceHeader";
import WorkspaceProgressRail from "../WorkspaceProgressRail";
import StepProgress from "../StepProgress";
import RunPill from "../RunPill";
import AiSettingsMenu from "../AiSettingsMenu";
import DocumentLanguageChip from "../DocumentLanguageChip";
import ResizeHandle from "../ResizeHandle";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

// Tên dự án / tiêu đề thay đổi là dữ liệu (không dịch) — đặt không dấu để phép thử chỉ đo chữ giao diện.
const PROJECT = { _id: "p1", name: "FlintFlow", domain: "SaaS", status: "active" } as Project;

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

const STEPS = [step("B-2.1", "accepted"), step("S-3.1", "accepted"), step("S-3.2", "in_progress"), step("S-4.1", "pending")];
const PROGRESS = { done: 2, total: 4, current_phase: "S-3", current_step: "S-3.2", show_percent: true };

const RUNNING: RunnerState = {
  ...initialRunnerState,
  status: "drafting",
  stepId: "S-3.2",
  busy: true,
  stage: "draft",
  detail: runnerDetail("readingAnswers"),
  startedAt: Date.now(),
  lastEventAt: Date.now(),
  events: [
    { type: "draft", step_id: "S-3.2", attempt: 1 },
    {
      type: "ops_applied",
      step_id: "S-3.2",
      txn: "t1",
      spine_version: 3,
      changes: [],
      summary: [{ kind: "add", collection: "actors", id: "A01", title_vi: "Receptionist" }],
    },
    { type: "flags", step_id: "S-3.2", red_open: 1, yellow_open: 0, red_delta: 1 },
  ],
};

const renderAll = (locale: "vi" | "en") =>
  renderWithIntl(
    <div>
      <WorkspaceHeader
        project={PROJECT}
        user={null}
        progressHidden
        onShowProgress={() => {}}
        currentStep="S-3.2"
        onBackToCurrent={() => {}}
        onVerifyClick={() => {}}
        verifyCount={2}
        onToolsClick={() => {}}
        toolsCount={1}
        onEnterFocus={() => {}}
        onLogout={() => {}}
      />
      <WorkspaceProgressRail
        onHide={() => {}}
        currentPhase="S-3"
        steps={STEPS}
        progress={PROGRESS}
        selectedStepId="S-3.2"
        onSelectStep={() => {}}
        readinessPercent={40}
      />
      <StepProgress state={RUNNING} onCancel={() => {}} onBackground={() => {}} />
      <RunPill state={RUNNING} onOpen={() => {}} onCancel={() => {}} />
      <AiSettingsMenu reviewMode="fast" onChangeReviewMode={() => {}} />
      <DocumentLanguageChip language="en" />
      <ResizeHandle active={false} onStart={() => {}} onReset={() => {}} label="x" />
    </div>,
    locale
  );

describe("ws-core i18n", () => {
  it("en: header, rail tiến độ, tiến trình bước, pill, cài đặt AI không còn chữ tiếng Việt", () => {
    const { container } = renderAll("en");
    fireEvent.click(screen.getByRole("button", { name: /How the AI works with you/ }));
    expect(vietnameseLeftovers(container)).toEqual([]);
    expect(screen.getByText("Check & sign-off")).toBeInTheDocument();
    expect(screen.getByText("Write +1 actor")).toBeInTheDocument();
    expect(screen.getByText(/Reading your answers…/)).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "End of phase" })).toHaveAttribute("aria-checked", "true");
  });

  it("vi: giữ nguyên câu chữ hiện tại", () => {
    renderAll("vi");
    expect(screen.getByText("Kiểm & chốt")).toBeInTheDocument();
    expect(screen.getByText("Ghi +1 actor")).toBeInTheDocument();
    expect(screen.getByText(/Đang đọc câu trả lời của bạn…/)).toBeInTheDocument();
    expect(screen.getByText("Tài liệu đã chốt")).toBeInTheDocument();
  });
});
