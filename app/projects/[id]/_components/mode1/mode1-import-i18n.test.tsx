/**
 * Song ngữ nhóm import mode 1: chọn `en` thì không còn chữ tiếng Việt do FE sinh (nhãn, nút, aria, tooltip, nhãn mục /
 * field / luật). Dữ liệu giả dùng tiếng Anh không dấu — nội dung tài liệu / câu BE không thuộc phạm vi dịch.
 */
import { screen, waitFor } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockServer } from "@/mocks/server";
import { resetMockState } from "@/mocks/state";
import { MODE1_PROJECT_ID, resetMode1MockState } from "@/mocks/mode1/state";
import { renderWithIntl, vietnameseLeftovers } from "@/test/intl";
import type { DocVersion } from "@/types/doc-version";
import type { ImportedDocument, ReviewField, TemplateProfile } from "@/types/import";
import type { Flag } from "@/types/spine";
import ConfirmLatestModal from "./ConfirmLatestModal";
import CreditEstimateNote from "./CreditEstimateNote";
import ExtractProgress from "./ExtractProgress";
import FieldsReview from "./FieldsReview";
import ImportWizard from "./ImportWizard";
import MappingReviewTable from "./MappingReviewTable";
import Mode1FlagsPanel from "./Mode1FlagsPanel";
import PausedBanner from "./PausedBanner";
import PreflightIssues from "./PreflightIssues";
import UploadStep from "./UploadStep";
import ValueEditor from "./ValueEditor";
import VersionsPanel from "./VersionsPanel";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useParams: () => ({ id: MODE1_PROJECT_ID }),
}));

beforeAll(() => mockServer.listen({ onUnhandledRequest: "error" }));
beforeEach(() => {
  resetMockState();
  resetMode1MockState();
});
afterEach(() => mockServer.resetHandlers());
afterAll(() => mockServer.close());

const PROFILE: TemplateProfile = {
  doc_version: "0.1",
  template_family: "ieee830",
  heading_map: [
    { block_id: "B0001", heading_text: "1 Product Overview", section_id: "fixed:1", confidence: 0.97, detected_by: "style", confirmed: false },
    { block_id: "B0007", heading_text: "3.2.4 Log out", section_id: "feature:@B0007", confidence: 0.62, detected_by: "numbering_pattern", confirmed: false },
    { block_id: "B0011", heading_text: "Appendix B", section_id: "unmapped", confidence: 0.4, detected_by: "user", confirmed: false, template_section: true },
  ],
  table_map: [
    { block_id: "B0005", column_index: 0, header: "Actor", field_path: "actors[].name", confidence: 0.9, confirmed: false, samples: ["Learner"], role: "name" },
    { block_id: "B0005", column_index: 1, header: "", field_path: "glossary[].term", confidence: 0.5, confirmed: false },
  ],
  language: "vi",
  layout: [],
} as TemplateProfile;

const FIELDS: ReviewField[] = [
  { section_id: "fixed:2.1", path: "actors[id=A02].kind", value: "human", confidence: 0.55, source_block_ids: ["B0005"], origin: "vision", confirmed: false },
  { section_id: "feature:@B0007", path: "project.code", value: "123", confidence: 0.5, source_block_ids: [], origin: "ai", confirmed: false },
] as ReviewField[];

const DOC: ImportedDocument = {
  id: "66f000000000000000000001",
  project_id: MODE1_PROJECT_ID,
  original_name: "SRS_Lumen.docx",
  size: 10,
  sha256: "a".repeat(64),
  status: "extracting",
  preflight: { status: "accepted", issues: [] },
  stamp: null,
  confirmed_latest_at: "2026-09-19T00:00:00.000Z",
  paused: { reason: "credits", at: "2026-09-19T00:00:00.000Z" },
  extract_cursor: "fixed:2.1",
  created_at: "2026-09-19T00:00:00.000Z",
  updated_at: "2026-09-19T00:00:00.000Z",
} as ImportedDocument;

const FLAG: Flag = {
  id: "F1",
  level: "red",
  rule_id: "section_empty",
  section_id: "custom:CS07",
  target_id: null,
  message: "section_empty at actors[id=A01].name",
  remediation_step: null,
  opened_at_version: 1,
  resolved_at: null,
  waived_by_user: false,
  waive_reason: null,
  waived_at_version: null,
} as unknown as Flag;

const version = (v: string, kind: DocVersion["kind"]): DocVersion => ({
  version: v,
  kind,
  based_on: null,
  cr_ids: kind === "cr_revision" ? ["CR-001"] : [],
  baseline_id: null,
  has_clean_file: kind === "release",
  has_tracked_file: kind === "cr_revision",
  has_original_file: kind === "imported",
  other_language_available: false,
  created_by: "u1",
  created_at: "2026-09-19T00:00:00.000Z",
});

describe("Nhóm import mode 1 — tiếng Anh", () => {
  it("các bước import (mapping, trích, xác nhận field, preflight, upload) không còn chữ tiếng Việt", () => {
    const { container } = renderWithIntl(
      <div>
        <UploadStep onUpload={vi.fn()} />
        <PreflightIssues
          fileName="SRS.docx"
          issues={[
            { code: "FOREIGN_TRACK_CHANGE", message: "2 tracked changes", location: { block_ord: 3, text: "Login" } },
            { code: "NOT_DOCX", message: "bad file", location: null },
          ] as never}
        />
        <MappingReviewTable profile={PROFILE} onSubmit={vi.fn()} />
        <ExtractProgress
          doc={DOC}
          sections={[
            { section_id: "fixed:1", status: "done", fields_total: 3, fields_needing_review: 1, error: null },
            { section_id: "fixed:2.1", status: "failed", fields_total: 0, fields_needing_review: 0, error: "section_empty" },
          ]}
          running={false}
          credits={5}
          estimate={{ ai_calls: 4, credits: 40, text_batches: 3, diagram_images: 1, available_credits: 5 }}
          onStart={vi.fn()}
          onResume={vi.fn()}
        />
        <CreditEstimateNote estimate={{ ai_calls: 0, credits: 0, text_batches: 0, diagram_images: 0, available_credits: null }} />
        <FieldsReview fields={FIELDS} onSubmit={vi.fn()} />
        <PausedBanner paused={{ reason: "resume_later", at: "2026-09-19T00:00:00.000Z" }} what="Checking" onResume={vi.fn()} />
      </div>,
      "en"
    );
    expect(vietnameseLeftovers(container)).toEqual([]);
    expect(screen.getByRole("button", { name: "Confirm mapping" })).toBeInTheDocument();
    expect(screen.getByText("Detected by section number")).toBeInTheDocument();
    expect(screen.getAllByText("Actor — Actor name").length).toBeGreaterThan(0);
  });

  it("cờ, version, sửa phần tử và hộp xác nhận bản mới nhất không còn chữ tiếng Việt", () => {
    const { container, baseElement } = renderWithIntl(
      <div>
        <Mode1FlagsPanel projectId={MODE1_PROJECT_ID} flags={[FLAG, { ...FLAG, id: "F2", level: "yellow" }]} />
        <VersionsPanel projectId={MODE1_PROJECT_ID} versions={[version("0.2", "cr_revision"), version("0.1", "imported")]} redOpen={1} onReleased={vi.fn()} onSelect={vi.fn()} />
        <ValueEditor
          oldText={JSON.stringify({ id: "A01", name: "Learner", is_popup: false, aliases: ["Student"], blocks: [{ kind: "table", text: "", rows: [["a"]], image_ref: null }] })}
          startText={JSON.stringify({ id: "A01", name: "Learner 2", is_popup: true, aliases: ["Student"], blocks: [{ kind: "table", text: "", rows: [["a"]], image_ref: null }] })}
          onSave={vi.fn()}
          onCancel={vi.fn()}
        />
        <ConfirmLatestModal open fileName="SRS.docx" onConfirm={vi.fn()} onPickAnother={vi.fn()} />
      </div>,
      "en"
    );
    expect(vietnameseLeftovers(container)).toEqual([]);
    expect(vietnameseLeftovers(baseElement)).toEqual([]);
    expect(screen.getByText("Section is empty at Actor A01 — Name")).toBeInTheDocument();
    expect(screen.getByText(/1 red flag remains/)).toBeInTheDocument();
  });

  it("wizard import (bước tải lên) bằng tiếng Anh", async () => {
    const { container } = renderWithIntl(<ImportWizard projectId={MODE1_PROJECT_ID} credits={10} />, "en");
    await waitFor(() => expect(screen.getByText("Upload an existing SRS (.docx)")).toBeInTheDocument());
    expect(vietnameseLeftovers(container)).toEqual([]);
  });
});
