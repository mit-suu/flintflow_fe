import { act, fireEvent, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { tPhase, tStep } from "@/lib/i18n";
import { HOOK_ERROR } from "@/lib/hook-errors";
import { renderWithIntl, vietnameseLeftovers } from "@/test/intl";
import AddendumTriagePanel from "../AddendumTriagePanel";
import AssumptionSweepPanel from "../AssumptionSweepPanel";
import BriefSummaryCard from "../BriefSummaryCard";
import ChatPane from "../ChatPane";
import ChatSessionSidebar from "../ChatSessionSidebar";
import DiffPreviewModal from "../DiffPreviewModal";
import DocumentPane from "../DocumentPane";
import ExportPanel from "../ExportPanel";
import GateCard from "../GateCard";
import NamesGlossaryPanel from "../NamesGlossaryPanel";
import PhaseHeader from "../PhaseHeader";
import PhaseNavBar from "../PhaseNavBar";
import QuestionStepperInput from "../QuestionStepperInput";
import ScreenQueuePanel from "../ScreenQueuePanel";
import StepEventLog from "../StepEventLog";
import StepProgressBar from "../StepProgressBar";
import TraceabilityMap from "../TraceabilityMap";
import VerificationPane from "../VerificationPane";
import WorkspaceHeader from "../WorkspaceHeader";

/*
 * Workspace song ngữ (T25 · P4). Mỗi component render ở `en` với dữ liệu giả và khẳng định không còn chữ
 * tiếng Việt — kể cả aria-label, title, placeholder. Dữ liệu tài liệu / Spine trong fixture là tiếng Anh
 * (đúng như SRS thật); nội dung người dùng gõ thì hiện nguyên văn, không thuộc phạm vi dịch.
 */

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));
vi.mock("@/lib/api/chat", () => ({ estimateActionCost: vi.fn(async () => ({ data: { cost: 2 }, error: null })) }));
const api = vi.hoisted(() => ({ getDocument: vi.fn(), listBaselines: vi.fn(), getTraceability: vi.fn() }));
vi.mock("@/lib/api/export", () => ({
  getDocument: api.getDocument,
  assembleDocument: vi.fn(),
  listBaselines: api.listBaselines,
  downloadWordExport: vi.fn(),
}));
vi.mock("@/lib/api/spine", () => ({ getTraceability: api.getTraceability, fetchDiagramPng: vi.fn() }));

const noop = () => {};
const clean = () => expect(vietnameseLeftovers(document.body)).toEqual([]);

const step = (id: string, status: string) => ({ id, phase: id.split(".")[0], status }) as never;

const FLAG = (id: string, rule: string, extra: object = {}) =>
  ({
    id,
    level: "red",
    rule_id: rule,
    section_id: "fixed:2.1",
    target_id: "A01",
    message: "Actor list is empty",
    remediation_step: "S-3.1",
    ...extra,
  }) as never;

// jsdom không có scrollIntoView (ChatPane cuộn xuống tin cuối).
Element.prototype.scrollIntoView = vi.fn();

beforeEach(() => {
  api.getDocument.mockReset();
  api.listBaselines.mockReset().mockResolvedValue({ data: [], error: null });
  api.getTraceability.mockReset().mockResolvedValue({ data: { nodes: [], edges: [] }, error: null });
});

describe("Khung workspace (en)", () => {
  it("PhaseHeader / PhaseNavBar / StepProgressBar / WorkspaceHeader", () => {
    renderWithIntl(
      <>
        <WorkspaceHeader project={null} user={null} onLogout={noop} />
        <PhaseNavBar currentPhase="S-3" steps={[]} sidebarOpen onToggleSidebar={noop} onExportClick={noop} onVerificationClick={noop} readinessPercent={40} />
        <PhaseHeader currentPhase="S-3" currentStep="S-3.1" workingMode="fast" onChangeWorkingMode={noop} onRunCurrentStep={noop} />
        <StepProgressBar
          steps={[step("S-2.5", "accepted"), step("S-3.1", "pending")]}
          progress={{ done: 1, total: 51, current_phase: "S-3", current_step: "S-3.1", show_percent: false } as never}
          selectedStepId={null}
          onSelectStep={noop}
        />
      </>,
      "en"
    );
    expect(screen.getByRole("button", { name: "▶ Run this step" })).toBeInTheDocument();
    expect(screen.getByText(`S-3 · ${tPhase("S-3", "en")}`)).toBeInTheDocument();
    expect(screen.getByText(`S-3.1 · ${tStep("S-3.1", "en")}`)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: `S-3.1 ${tStep("S-3.1", "en")}` })).toBeInTheDocument();
    expect(screen.getByText("SRS project")).toBeInTheDocument();
    clean();
  });

  it("PhaseHeader khi đã xong mọi phase", () => {
    renderWithIntl(<PhaseHeader currentPhase={null} currentStep={null} workingMode={null} onChangeWorkingMode={noop} />, "en");
    expect(screen.getByText("Complete")).toBeInTheDocument();
  });
});

describe("Chat & pipeline (en)", () => {
  it("ChatPane trống + phiên không phải pipeline + đang phản hồi", async () => {
    await act(async () => {
      renderWithIntl(
        <ChatPane
          session={{ _id: "s1", messages: [], is_pipeline: false } as never}
          stepLabel="S-3.1 · Actors"
          inputMessage=""
          setInputMessage={noop}
          onSendMessage={noop}
          sending={false}
          pendingAttachments={[]}
          onSelectAttachment={noop}
          onRemoveAttachment={noop}
          streamingMessage="Drafting…"
          isStreaming
          onEditInstruction={noop}
        />,
        "en"
      );
    });
    expect(screen.getByText("Conversation & step review")).toBeInTheDocument();
    expect(screen.getByText("Responding...")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Type an edit command — sent to the Change panel…")).toBeInTheDocument();
    clean();
  });

  it("ChatSessionSidebar: menu + hộp xác nhận xoá", () => {
    renderWithIntl(
      <ChatSessionSidebar
        sessions={[{ _id: "abcd1234", messages: [] } as never]}
        activeSessionId="abcd1234"
        onSelectSession={noop}
        onCreateSession={noop}
        onDeleteSession={noop}
      />,
      "en"
    );
    expect(screen.getByText("Session #1234")).toBeInTheDocument();
    fireEvent.click(screen.getByTitle("Options"));
    fireEvent.click(screen.getByRole("button", { name: "Delete chat session" }));
    expect(screen.getByText("Delete this chat session?")).toBeInTheDocument();
    clean();
  });

  it("GateCard: chế độ yêu cầu sửa", () => {
    renderWithIntl(<GateCard stepId="S-3.1" actions={["accept", "revision", "regenerate"]} regenerateUsed={3} onAction={noop} />, "en");
    fireEvent.click(screen.getByRole("button", { name: /Request revision/ }));
    expect(screen.getByText("What needs to change?")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Regenerate/ })).toHaveAttribute("title", "No Regenerate attempts left");
    clean();
  });

  it("StepEventLog: mọi loại sự kiện", () => {
    renderWithIntl(
      <StepEventLog
        events={
          [
            { type: "intake", step_id: "S-3.1", empty_fields: ["actors"] },
            { type: "answer_needed", step_id: "S-3.1", questions: [{ id: "q1", text: "Who?" }, { id: "q2", text: "What?" }] },
            { type: "draft", step_id: "S-3.1", attempt: 1 },
            { type: "ops_applied", step_id: "S-3.1", changes: [{}], spine_version: 7 },
            { type: "render", step_id: "S-3.1", diagram_id: "D01", render_status: "error", error: "timeout" },
            { type: "flags", step_id: "S-3.1", red_open: 0, yellow_open: 1 },
            { type: "gate_ready", step_id: "S-3.1", actions: ["accept"], regenerate_used: 0, calls_used: 1 },
          ] as never
        }
      />,
      "en"
    );
    expect(screen.getByText("Waiting for you to answer 2 questions")).toBeInTheDocument();
    expect(screen.getByText("Wrote 1 change (version 7)")).toBeInTheDocument();
    expect(screen.getByText("Check: 0 red flags, 1 yellow flag")).toBeInTheDocument();
    clean();
  });

  it("ScreenQueuePanel + QuestionStepperInput", () => {
    renderWithIntl(
      <>
        <ScreenQueuePanel
          spine={{ screens: [{ id: "S01", name: "Login", detail_status: "pending", queue_order: 1 }], progress: { screen_cursor: null } } as never}
          onMarkPlaceholder={noop}
        />
        <QuestionStepperInput
          questions={[{ question: "Which channels?", suggestedAnswers: ["Web", "Mobile"], multiple: true }]}
          onSendAnswers={noop}
          onDismiss={noop}
        />
      </>,
      "en"
    );
    expect(screen.getByRole("button", { name: "Leave for later (placeholder)" })).toBeInTheDocument();
    expect(screen.getByText("Question 1 / 1")).toBeInTheDocument();
    clean();
  });
});

describe("Tài liệu, kiểm chứng, thay đổi (en)", () => {
  it("DocumentPane: badge trạng thái, nút xem step, câu dự phòng khi lỗi", async () => {
    api.getDocument.mockResolvedValue({
      data: {
        projectId: "p1",
        projectName: "Ride App",
        version: "v0.2",
        source: "draft",
        generatedAt: "2026-09-15T00:00:00.000Z",
        sections: [
          { id: "fixed:2.1", number: "2.1", heading: "Actors", level: 2, status: "stale", awaiting_reaccept: true, blocks: [] },
          { id: "fixed:5.5", number: "5.5", heading: "Glossary", level: 2, status: "derived", blocks: [] },
        ],
        recordOfChanges: [],
      },
      error: null,
      meta: { assembled_at_version: 4, spine_version: 6, stale: true },
    });
    await act(async () => {
      renderWithIntl(<DocumentPane projectId="p1" flags={[FLAG("F1", "array_empty")]} onSelectStep={noop} getBaseVersion={() => 6} />, "en");
    });
    expect(await screen.findByText("Stale")).toBeInTheDocument();
    expect(screen.getByText("Awaiting re-approval")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: `see S-3.1 · ${tStep("S-3.1", "en")}` })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reassemble" })).toBeInTheDocument();
    clean();
  });

  it("DocumentPane: lỗi không kèm message ⇒ mã hook được dịch", async () => {
    api.getDocument.mockRejectedValue("boom");
    await act(async () => {
      renderWithIntl(<DocumentPane projectId="p1" />, "en");
    });
    expect(await screen.findByText("Could not load the document: Could not load the document")).toBeInTheDocument();
    expect(screen.queryByText(HOOK_ERROR.docLoadFailed, { exact: false })).not.toBeInTheDocument();
  });

  it("ExportPanel", async () => {
    api.getDocument.mockResolvedValue({
      data: { projectId: "p1", projectName: "Ride App", version: "v0.3", source: "draft", generatedAt: "", sections: [], recordOfChanges: [], flagsAppendix: { redOpen: [], staleCount: 0, waived: [] } },
      error: null,
      meta: { assembled_at_version: 5, spine_version: 5, stale: false },
    });
    await act(async () => {
      renderWithIntl(<ExportPanel projectId="p1" onClose={noop} />, "en");
    });
    expect(await screen.findByText("Assembled at Spine v5")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Download draft (.docx)" })).toBeInTheDocument();
    clean();
  });

  it("VerificationPane + FlagsPanel + hộp waive", () => {
    renderWithIntl(
      <VerificationPane
        readiness={{ accepted_pct: 50, awaiting_reaccept: 1, red_open: 1, stale: 2 } as never}
        flags={[FLAG("F1", "missing_nfr"), FLAG("F2", "array_empty"), FLAG("F3", "missing_nfr", { waived_by_user: "u1", waive_reason: "Accepted by client" })]}
        flagsLoading={false}
        flagsError={HOOK_ERROR.flagsLoadFailed}
        flagsBusy={false}
        onClose={noop}
        onSelectStep={noop}
        onWaive={async () => {}}
        onRecompute={async () => {}}
      />,
      "en"
    );
    expect(screen.getByText("1 red flag")).toBeInTheDocument();
    expect(screen.getByText("2 stale items")).toBeInTheDocument();
    expect(screen.getByText("Could not load the flag list")).toBeInTheDocument();
    expect(screen.getByText("Can't be waived")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Waive" }));
    expect(screen.getByText("Reason (at least 20 characters)")).toBeInTheDocument();
    clean();
  });

  it("DiffPreviewModal: phạm vi ảnh hưởng + giá trị bị xoá", () => {
    renderWithIntl(
      <DiffPreviewModal
        preview={
          {
            ok: true,
            txn: "t",
            base_version: 4,
            ops: [],
            changes: [{ op: "remove", path: "actors[id=A03]", before: "Admin", value: { _absent: true } }],
            violations: [],
            referrers: [],
            preview_id: "pv1",
            impact: { sections: [{ id: "fixed:2.1", relation: "direct" }], diagrams: ["D01"], referrers: [{ path: "use_cases", id: "UC01" }] },
          } as never
        }
        onCancel={noop}
        onConfirm={noop}
      />,
      "en"
    );
    expect(screen.getByText("(deleted)")).toBeInTheDocument();
    expect(screen.getByText("Diagrams to re-render: D01")).toBeInTheDocument();
    clean();
  });

  it("TraceabilityMap: tra không có liên kết", async () => {
    renderWithIntl(<TraceabilityMap projectId="p1" />, "en");
    fireEvent.change(screen.getByPlaceholderText("ID (e.g. A01)"), { target: { value: "A01" } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Look up" }));
    });
    expect(await screen.findByText("No links.")).toBeInTheDocument();
    clean();
  });
});

describe("Panel Brief & tên riêng (en)", () => {
  const SPINE = {
    project: { form_factor: "web_app", stakes: "regulated", working_mode: "coaching", vision: null, goals: [] },
    addendum: [
      { id: "AD01", topic: "Uptime", content: "99.9% uptime", content_en: "99.9% uptime", target_section: "fixed:4.2.2", captured_at: "" },
      { id: "AD02", topic: "Later", content: "Dark mode", content_en: "Dark mode", target_section: "fixed:5.4", captured_at: "" },
    ],
    assumptions: [
      { id: "AS01", status: "unconfirmed", path: "nfrs[id=N01].threshold", statement: "Response under 2s" },
      { id: "AS02", status: "unconfirmed", path: "project.goals", statement: "Launch in Q4" },
    ],
    other_requirements: [{ id: "O1", kind: "open_question", statement: "Which payment gateway?" }],
    actors: [{ id: "A01", name: "Founder" }],
    entities: [],
    screens: [],
    glossary: [],
  } as never;

  it("BriefSummaryCard + AddendumTriagePanel + AssumptionSweepPanel + NamesGlossaryPanel", () => {
    renderWithIntl(
      <>
        <BriefSummaryCard spine={SPINE} />
        <AddendumTriagePanel spine={SPINE} onSubmitOps={noop} />
        <AssumptionSweepPanel spine={SPINE} onSubmitOps={noop} />
        <NamesGlossaryPanel spine={SPINE} onSubmitOps={noop} />
      </>,
      "en"
    );
    expect(screen.getByText("Regulated industry")).toBeInTheDocument();
    expect(screen.getByText("2 assumptions awaiting confirmation")).toBeInTheDocument();
    expect(screen.getByText("No vision (B-1.1) yet — go back to the matching step to add it.")).toBeInTheDocument();
    expect(screen.getAllByRole("option", { name: "§4.2.2 Reliability" }).length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Confirm the remaining 1 assumption" })).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: "Drop this entry" })[0]);
    expect(screen.getByText("Drop it because the content is wrong?")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "Glossary" }));
    expect(screen.getByPlaceholderText("New term")).toBeInTheDocument();
    clean();
  });

  it("bản vi: nhãn section và số giả định giữ chữ cũ", () => {
    renderWithIntl(<AddendumTriagePanel spine={SPINE} onSubmitOps={noop} />, "vi");
    expect(screen.getAllByRole("option", { name: "§4.2.2 Độ tin cậy" }).length).toBeGreaterThan(0);
    expect(screen.getByText(/^2 ghi chú\. Đổi đích/)).toBeInTheDocument();
  });
});
