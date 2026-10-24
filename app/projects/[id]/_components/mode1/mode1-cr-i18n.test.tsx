import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderWithIntl, vietnameseLeftovers } from "@/test/intl";
import type { CrGroup, CrLocation } from "@/types/change-request";
import type { CrChat } from "../../hooks/mode1/useCrChat";
import BlockDiffList, { DiffSummary } from "./BlockDiffList";
import ChangeGroupPanel from "./ChangeGroupPanel";
import ChangeRequestForm from "./ChangeRequestForm";
import { AssumptionsNote, MaterialAdder, MaterialList } from "./CrMaterials";
import CrPrefillCard from "./CrPrefillCard";
import CrTimeline from "./CrTimeline";
import ImpactList from "./ImpactList";
import Mode1CrThread from "./Mode1CrThread";
import OriginalDiagramChange from "./OriginalDiagramChange";
import RecordOfChangesCard from "./RecordOfChangesCard";
import ReasonDialog from "./ReasonDialog";
import VerifyResult from "./VerifyResult";

/**
 * Nhóm change request (mode 1) song ngữ: bản `en` không còn chữ tiếng Việt của giao diện. Dữ liệu (mã, tên mục, nội dung
 * đề xuất) đặt không dấu để phép thử chỉ đo chữ UI.
 */
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }));

const location = (id: string, over: Partial<CrLocation> = {}): CrLocation => ({
  location_id: id,
  path: "project.name",
  section_id: "custom:x",
  section_title: "Overview",
  current_text: JSON.stringify({ name: "Old" }),
  found_by: ["keyword"],
  entity_paths: [],
  owner_step: null,
  conclusion: "edit",
  reason: null,
  proposal: { old_text: JSON.stringify({ name: "Old" }), new_text: JSON.stringify({ name: "New" }), comment_text: null, spine_ops: [], assumptions: ["Deadline is Friday"] },
  manual: true,
  redo_count: 1,
  verify: { code_ok: false, violations: [{ rule: "x_unknown", message: "Bad value" }], ai_flags: [], at: "2026-10-01T00:00:00Z" },
  group_id: null,
  ...over,
});

const group: CrGroup = { group_id: "G1", title: "Group one", location_ids: ["L1"], decision: "pending", reason: null, decided_by: null, decided_at: null };

const diagramLoc = location("L9", {
  found_by: ["diagram"],
  proposal: {
    old_text: JSON.stringify({ blocks: [{ kind: "image", text: "Figure 1", image_ref: "img1", diagram: { kind: "usecase" } }] }),
    new_text: JSON.stringify({ blocks: [] }),
    comment_text: null,
    spine_ops: [],
    assumptions: [],
  },
});

const idleChat = (over: Partial<CrChat> = {}): CrChat =>
  ({ detail: null, busy: null, error: null, sent: null, pending: null, loading: false, clearError: vi.fn(), ...over }) as unknown as CrChat;

const renderAll = (locale: "vi" | "en") =>
  renderWithIntl(
    <div>
      <CrTimeline status="proposing" />
      <ImpactList locations={[location("L1"), location("L2", { conclusion: null, verify: null })]} editable onPatch={vi.fn()} onOwnerDraft={vi.fn()} />
      <ChangeGroupPanel groups={[group]} locations={[location("L1")]} canDecide onDecide={vi.fn()} />
      <VerifyResult location={location("L3")} />
      <OriginalDiagramChange loc={diagramLoc} />
      <RecordOfChangesCard rows={[{ date: "2026-09-01", version: "1.0", change_type: "A", in_charge: "Lan", description: "Init" }]} fromFile={1} onChange={vi.fn()} />
      <BlockDiffList entries={[{ block_id: "b1", change: "modified", before: "a", after: "b" }]} />
      <p>
        <DiffSummary summary={{ added: 1, removed: 0, modified: 2, moved: 0 }} />
      </p>
      <BlockDiffList entries={[]} />
      <MaterialList items={[{ key: "m1", name: "Email PM", kind: "text", text: "Hello", truncated: true, round: 1 }]} onRemove={vi.fn()} />
      <MaterialAdder onAddText={vi.fn()} onAddFile={vi.fn()} />
      <AssumptionsNote assumptions={["Deadline is Friday"]} />
      <CrPrefillCard projectId="p1" prefill={{ title: "Rename", description: "Rename actor" }} onDismiss={vi.fn()} />
      <ChangeRequestForm projectId="p1" prefill={{ title: "Rename", description: "Rename actor", preview_id: "pv1", comment_id: "c1" }} onCreated={vi.fn()} onCancel={vi.fn()} />
      <Mode1CrThread projectId="p1" chat={idleChat()} me="Lan" />
      <Mode1CrThread projectId="p1" chat={idleChat({ pending: "Rename actor" })} me="Lan" />
      <Mode1CrThread projectId="p1" chat={idleChat({ sent: "CR-001" })} me="Lan" />
    </div>,
    locale
  );

describe("Change request mode 1 — song ngữ", () => {
  it("vi giữ nguyên chữ cũ", () => {
    renderAll("vi");
    expect(screen.getByRole("heading", { name: "Vị trí ảnh hưởng (2)" })).toBeInTheDocument();
    expect(screen.getAllByText("Kiểm tra tự động: chưa đạt").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Ghi Track Changes").length).toBeGreaterThan(0);
    expect(screen.getByText("1 thêm · 0 xoá · 2 sửa · 0 di chuyển")).toBeInTheDocument();
    expect(screen.getByText("Sơ đồ use case (“Figure 1”)")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tạo change request" })).toBeInTheDocument();
  });

  it("en không còn chữ tiếng Việt của giao diện", () => {
    const { container } = renderAll("en");
    expect(screen.getByRole("heading", { name: "Affected locations (2)" })).toBeInTheDocument();
    expect(screen.getByText("1 added · 0 removed · 2 modified · 0 moved")).toBeInTheDocument();
    expect(screen.getByText("Use case diagram (“Figure 1”)")).toBeInTheDocument();
    expect(vietnameseLeftovers(container)).toEqual([]);
  });

  it("hộp thoại lý do dịch theo ngôn ngữ", () => {
    renderWithIntl(<ReasonDialog open title="Close" description="Closing" confirmLabel="Close CR" onConfirm={vi.fn()} onClose={vi.fn()} />, "en");
    expect(screen.getByPlaceholderText("Reason (at least 10 characters)")).toBeInTheDocument();
    expect(vietnameseLeftovers(document.body)).toEqual([]);
  });
});
