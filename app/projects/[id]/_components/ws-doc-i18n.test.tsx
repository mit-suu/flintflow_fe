import { screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderWithIntl, vietnameseLeftovers } from "@/test/intl";
import * as exportApi from "@/lib/api/export";
import type { Locale } from "@/lib/i18n";
import type { SrsComment } from "@/types/comment";
import type { RenderedDocument } from "@/types/document";
import type { Flag } from "@/types/flags";
import type { PreviewResult } from "@/types/pipeline";
import type { Spine } from "@/types/spine";
import BriefPanel from "./BriefPanel";
import CommentsPanel from "./CommentsPanel";
import DiffPreviewModal from "./DiffPreviewModal";
import DocumentPane from "./DocumentPane";
import ProjectRecordPanel from "./ProjectRecordPanel";
import RejectBaselineModal from "./RejectBaselineModal";
import VerificationPane from "./VerificationPane";
import AssumptionSweepPanel from "./AssumptionSweepPanel";
import AddendumTriagePanel from "./AddendumTriagePanel";

vi.mock("@/lib/api/export", () => ({ getDocument: vi.fn() }));
vi.mock("../hooks/useSources", () => ({ useSources: () => ({ sources: [], loading: false, error: null }) }));

/**
 * Nhóm tài liệu / kiểm tra / hồ sơ dự án ở locale `en`: không còn chữ tiếng Việt nào của UI. Dữ liệu (tên mục, câu cờ,
 * nội dung góp ý) để tiếng Anh không dấu — phép thử chỉ đo chữ giao diện.
 */
const flag = (over: Partial<Flag> & Pick<Flag, "id" | "rule_id">): Flag => ({
  level: "red",
  section_id: "fixed:4.2.2",
  target_id: null,
  message: "No reliability NFR yet",
  remediation_step: "S-6.2",
  opened_at_version: 1,
  resolved_at: null,
  waived_by_user: false,
  waive_reason: null,
  waived_at_version: null,
  ...over,
});

const FLAGS: Flag[] = [
  flag({ id: "F1", rule_id: "nfr_missing_number" }),
  flag({ id: "F2", rule_id: "unconfirmed_assumption", target_id: "AS01", message: "Assumes web only" }),
  flag({ id: "F3", rule_id: "section_empty", section_id: "fixed:5.5", remediation_step: "S-7.1" }),
  flag({ id: "F4", rule_id: "diagram_stale", level: "yellow", message: "ERD outdated" }),
];

const comment = (over: Partial<SrsComment> = {}): SrsComment =>
  ({
    comment_id: "CM-001",
    anchor: { section_id: "fixed:1", block_index: null, label: "§1 Product Overview", excerpt: "Vision" },
    version: { kind: "draft", label: "v0.5" },
    text: "Please clarify",
    status: "open",
    author: { name: "Lan", email: "lan@example.com" },
    author_role: "lead",
    replies: [],
    created_at: "2026-10-08T03:00:00.000Z",
    ...over,
  }) as SrsComment;

const spine = {
  spine_version: 3,
  progress: { current_phase: "S-2" },
  project: { system_name: "Clinic Hub", form_factor: ["web_app", "embedded"], stakes: "regulated", vision: "Book visits", goals: ["Fewer calls"] },
  addendum: [{ id: "AD01", topic: "users", content: "Nurses book", target_section: "fixed:2.1" }],
  assumptions: [{ id: "AS01", path: "project.goals", statement: "Patients use phones", statement_vi: "Bệnh nhân dùng điện thoại", status: "unconfirmed" }],
  other_requirements: [{ id: "OR01", kind: "risk", statement: "Gateway may be down", statement_vi: "Cổng có thể sập" }],
  decisions: [{ id: "DC01", topic_key: "uptime", question: "Uptime?", answer: "99%", step_id: "S-1.4", at: "2026-09-22T10:00:00.000Z", superseded_by: null }],
  actors: [{ id: "A01", name: "Nurse" }],
  entities: [],
  screens: [],
  glossary: [],
} as unknown as Spine;

const doc: RenderedDocument = {
  projectId: "p1",
  projectName: "Clinic",
  version: "v0.5",
  source: "draft",
  watermark: "DRAFT",
  generatedAt: "2026-09-15T00:00:00.000Z",
  sections: [
    { id: "fixed:1", number: "1", heading: "Product Overview", level: 1, status: "accepted", blocks: [{ type: "paragraph", runs: [{ text: "Vision statement" }] }] },
    { id: "fixed:3.1.2", number: "3.1.2", heading: "Screen Descriptions", level: 2, status: "stale", awaiting_reaccept: true, blocks: [] },
    { id: "custom:x", number: "6", heading: "Extra", level: 1, status: "derived", blocks: [] },
  ],
  recordOfChanges: [],
  flagsAppendix: { redOpen: [], staleCount: 0, waived: [] },
};

const preview: PreviewResult = {
  ok: true,
  preview_id: "pv1",
  branch: "dependent",
  violations: [],
  changes: [{ op: "set", path: "use_cases[id=UC01].function_ids", before: ["F1"], value: [] }],
  impact: { sections: [{ id: "fixed:2.2.2", relation: "owner" }], diagrams: ["D1"], referrers: [] },
} as unknown as PreviewResult;

describe.each<Locale>(["en"])("ws-doc i18n (%s)", (locale) => {
  it("panel kiểm tra tài liệu + chốt baseline: không còn chữ tiếng Việt", () => {
    const { container } = renderWithIntl(
      <VerificationPane
        projectId="p1"
        readiness={{ score: 0 } as never}
        flags={FLAGS}
        flagsLoading={false}
        flagsError="@flagsLoadFailed"
        flagsBusy={false}
        onClose={vi.fn()}
        onSelectStep={vi.fn()}
        onWaive={vi.fn()}
        onRecompute={vi.fn()}
        onRedraw={vi.fn()}
        onAssumptionDecision={vi.fn()}
        baseline={{
          role: "lead",
          submission: { status: "pending", submitted_at: "2026-10-08T03:00:00.000Z" } as never,
          blocking: 2,
          blockingFlags: [{ id: "B1", message: "Missing actors", remediation_step: "S-3.1" } as never],
          comments: [comment()],
          busy: false,
          error: null,
          onSubmit: vi.fn(),
          onApprove: vi.fn(),
          onReject: vi.fn(),
          onOpenComments: vi.fn(),
        }}
        issues={{ sectionLabelOf: (id) => (id === "fixed:4.2.2" ? "§4.2.2 Reliability" : "§5.5 Glossary"), outdatedCount: 1, onRewriteOutdated: vi.fn(), onEditSection: vi.fn() }}
      />,
      locale
    );
    expect(screen.getByText("Document check")).toBeInTheDocument();
    expect(vietnameseLeftovers(container)).toEqual([]);
  });

  it("tài liệu (read-only), góp ý, từ chối baseline, xem trước thay đổi", async () => {
    vi.mocked(exportApi.getDocument).mockResolvedValue({ data: doc, error: null, meta: { assembled_at_version: 5, spine_version: 5, stale: false } } as never);
    const { container } = renderWithIntl(
      <>
        <DocumentPane
          projectId="p1"
          issues={{ blocking: 3, suggestions: 1 }}
          onOpenIssues={vi.fn()}
          flags={FLAGS}
          onEditSection={vi.fn()}
          onCommentSection={vi.fn()}
          commentCountOf={() => 2}
          onOpenSectionComments={vi.fn()}
          rewriteError="boom"
        />
        <CommentsPanel
          comments={[comment(), comment({ comment_id: "CM-002", status: "resolved", resolution: { kind: "kept", reason: "Contract" } } as never)]}
          loading={false}
          error={null}
          busy={false}
          canResolve
          pendingAnchor={{ sectionId: "fixed:1", label: "§1 Product Overview", blockIndex: 0 } as never}
          onCancelPending={vi.fn()}
          onSubmit={vi.fn()}
          onResolve={vi.fn()}
          onClose={vi.fn()}
        />
        <RejectBaselineModal open onClose={vi.fn()} openComments={[comment()]} busy={false} onReject={vi.fn()} onOpenComments={vi.fn()} />
        <DiffPreviewModal preview={preview} onCancel={vi.fn()} onConfirm={vi.fn()} />
      </>,
      locale
    );
    await waitFor(() => expect(screen.getByText("Vision statement")).toBeInTheDocument());
    expect(screen.getByText("SRS — Project")).toBeInTheDocument();
    expect(vietnameseLeftovers(container)).toEqual([]);
    // Modal render qua portal ⇒ đo cả document
    expect(vietnameseLeftovers(document.body)).toEqual([]);
  });

  it("Brief + hồ sơ dự án: nhãn theo ngôn ngữ giao diện, giả định lấy bản EN", () => {
    const { container } = renderWithIntl(
      <>
        <BriefPanel spine={spine} updating />
        <ProjectRecordPanel
          projectId="p1"
          spine={spine}
          onSubmitOps={vi.fn()}
          onMarkPlaceholder={vi.fn()}
          inBriefPhase={false}
          history={[]}
          historyLoading={false}
          onLoadHistory={vi.fn()}
        />
        <AssumptionSweepPanel spine={spine} onSubmitOps={vi.fn()} />
        <AddendumTriagePanel spine={spine} onSubmitOps={vi.fn()} />
      </>,
      locale
    );
    expect(screen.getAllByText("Patients use phones").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Web · Embedded").length).toBeGreaterThan(0);
    expect(vietnameseLeftovers(container)).toEqual([]);
  });
});
