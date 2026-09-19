import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockServer } from "@/mocks/server";
import { resetMockState } from "@/mocks/state";
import { MODE1_PROJECT_ID, resetMode1MockState } from "@/mocks/mode1/state";
import * as mode1State from "@/mocks/mode1/state";
import { crToReview, importToGapReview } from "@/mocks/mode1/flows";
import { decideGroup } from "@/lib/api/change-requests";
import { listVersions } from "@/lib/api/versions";
import type { DocBlock } from "@/types/import";
import DocBlockView from "./DocBlockView";
import GapReportView, { gapReportPrefill } from "./GapReportView";
import ReuploadDiffView from "./ReuploadDiffView";
import VersionCompare from "./VersionCompare";
import VersionsPanel from "./VersionsPanel";
import { readCrPrefill } from "./prefill";

const P = MODE1_PROJECT_ID;

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useParams: () => ({ id: MODE1_PROJECT_ID }),
}));

beforeAll(() => mockServer.listen({ onUnhandledRequest: "error" }));
beforeEach(() => {
  resetMockState();
  resetMode1MockState();
  // jsdom không có URL.createObjectURL — tải file chỉ cần không ném lỗi
  URL.createObjectURL = vi.fn(() => "blob:mock");
  URL.revokeObjectURL = vi.fn();
});
afterEach(() => mockServer.resetHandlers());
afterAll(() => mockServer.close());

const block = (over: Partial<DocBlock>): DocBlock => ({
  block_id: "B0001",
  doc_version: "0.1",
  kind: "paragraph",
  level: null,
  heading_path: [],
  text: "",
  section_id: null,
  mentions: [],
  editable: true,
  locked_by_cr: null,
  ...over,
});

/** Import xong + một CR ghi vào tài liệu ⇒ có 0.0 và 0.1. */
const withRevision = async () => {
  await importToGapReview();
  const detail = await crToReview();
  await decideGroup(P, detail.change_request.cr_id, detail.groups[0].group_id, { decision: "approved", base_version: mode1State.mode1State.spineVersion });
  return (await listVersions(P)).data!;
};

describe("DocBlockView — tài liệu theo block (UC-54)", () => {
  it("heading/đoạn/danh sách, Track Changes kèm tác giả CR, huy hiệu khoá dẫn tới CR", () => {
    render(
      <DocBlockView
        projectId={P}
        blocks={[
          block({ block_id: "B0001", kind: "heading", level: 1, text: "1 Product Overview" }),
          block({
            block_id: "B0002",
            text: "Logout ends all sessions.",
            revisions: [
              { kind: "del", text: "Logout ends the current session.", author: "CR-001" },
              { kind: "ins", text: "Logout ends all sessions.", author: "CR-001" },
            ],
          }),
          block({ block_id: "B0003", kind: "list_item", text: "BR-01: …", locked_by_cr: "CR-002" }),
          block({ block_id: "B0004", kind: "unsupported", text: "[SmartArt]", editable: false }),
        ]}
      />
    );
    expect(screen.getByText("1 Product Overview")).toBeInTheDocument();
    const changes = screen.getByLabelText("Track Changes");
    expect(within(changes).getByText("Logout ends the current session.").tagName).toBe("DEL");
    expect(within(changes).getByText("Logout ends all sessions.").tagName).toBe("INS");
    expect(within(changes).getAllByText("CR-001")).toHaveLength(2);
    expect(screen.getByRole("link", { name: /CR-002/ })).toHaveAttribute("href", `/projects/${P}/change-requests/CR-002`);
    expect(screen.getByText(/không sửa qua CR/)).toBeInTheDocument();
  });

  it("bảng vẽ từ block table; ô bảng chỉ hiện riêng khi bị khoá", () => {
    render(
      <DocBlockView
        projectId={P}
        blocks={[
          block({ block_id: "B0010", kind: "table", text: "Actor | Description\nStudent | Learns", editable: false }),
          block({ block_id: "B0011", kind: "table_cell", text: "Actor" }),
          block({ block_id: "B0012", kind: "table_cell", text: "Learns", locked_by_cr: "CR-003" }),
        ]}
      />
    );
    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "Student" })).toBeInTheDocument();
    expect(screen.queryByText("Ô bảng: Actor")).not.toBeInTheDocument();
    expect(screen.getByText("Ô bảng: Learns")).toBeInTheDocument();
  });
});

describe("GapReportView (UC-23)", () => {
  it("tổng hợp cờ, section thiếu, heading không khớp; nút tạo CR điền sẵn nguồn gap_report; tải docx", async () => {
    await importToGapReview();
    const onChanged = vi.fn();
    render(<GapReportView projectId={P} projectName="Lumen" onChanged={onChanged} />);

    expect(await screen.findByText("Gap report — bản 0.0")).toBeInTheDocument();
    expect(screen.getByText(/Mục 5.3 Application Messages List bắt buộc/)).toBeInTheDocument();
    expect(screen.getByText("Phụ lục B — Biên bản họp")).toBeInTheDocument();

    const link = screen.getByRole("link", { name: "Cần sửa → Tạo change request" });
    const prefill = readCrPrefill(new URL(link.getAttribute("href")!, "http://x").searchParams);
    expect(prefill).toMatchObject({ source: "gap_report", title: "Sửa theo gap report" });
    expect(prefill?.description).toContain("Application Messages List");

    fireEvent.click(screen.getByRole("button", { name: "Tải gap report (.docx)" }));
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
  });

  it("gapReportPrefill liệt kê cờ đỏ và section thiếu", () => {
    const text = gapReportPrefill({
      project_id: P,
      doc_version: "0.0",
      generated_at: "",
      totals: { red: 1, yellow: 0, missing_sections: 1, unmapped_headings: 0, low_confidence_fields: 0 },
      sections: [{ section_id: "fixed:4.2.3", title: "Performance", flags: [{ id: "F1", level: "red", message: "Thiếu ngưỡng" } as never] }],
      missing_sections: [{ section_id: "fixed:5.3", title: "Application Messages List" }],
      unmapped_headings: [],
      low_confidence_fields: [],
    }).description;
    expect(text).toContain("4.2.3 Performance: Thiếu ngưỡng");
    expect(text).toContain("Thiếu mục 5.3 Application Messages List");
  });
});

describe("VersionsPanel — version & release (Flow 6, UC-57)", () => {
  it("còn cờ đỏ ⇒ Release bị khoá kèm lý do", async () => {
    await importToGapReview();
    const versions = (await listVersions(P)).data!;
    render(<VersionsPanel projectId={P} versions={versions} redOpen={1} selected="0.0" onSelect={vi.fn()} onReleased={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Release" })).toBeDisabled();
    expect(screen.getByText(/Còn 1 cờ đỏ/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tải bản gốc" })).toBeEnabled();
  });

  it("đỏ = 0 ⇒ xác nhận release gọi API, báo onReleased; version draft tải bản Track Changes", async () => {
    const versions = await withRevision();
    mode1State.mode1State.redFlags = 0;
    const onReleased = vi.fn();
    render(<VersionsPanel projectId={P} versions={versions} redOpen={0} selected="0.1" onSelect={vi.fn()} onReleased={onReleased} />);

    expect(screen.getByRole("button", { name: "Tải bản draft (Track Changes)" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Release" }));
    fireEvent.click(screen.getByRole("button", { name: "Xác nhận release" }));
    await waitFor(() => expect(onReleased).toHaveBeenCalled());
    expect(mode1State.mode1State.versions.map((v) => v.version)).toContain("1.0");
  });

  it("BE vẫn chặn (422 RELEASE_RED_FLAGS_OPEN) ⇒ hiện danh sách cờ chặn", async () => {
    const versions = await withRevision();
    render(<VersionsPanel projectId={P} versions={versions} redOpen={0} selected="0.1" onSelect={vi.fn()} onReleased={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Release" }));
    fireEvent.click(screen.getByRole("button", { name: "Xác nhận release" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/Mục 5.3 Application Messages List/);
  });
});

describe("VersionCompare (UC-55) và ReuploadDiffView (UC-24)", () => {
  it("so sánh 0.0 → 0.1 liệt kê block sửa", async () => {
    const versions = await withRevision();
    render(<VersionCompare projectId={P} versions={versions} />);
    fireEvent.click(screen.getByRole("button", { name: "So sánh" }));
    expect(await screen.findByText(/0.0 → 0.1: 0 thêm · 0 xoá · 1 sửa/)).toBeInTheDocument();
  });

  it("tải lại file ⇒ diff, không tạo version, nút tạo CR nguồn reupload", async () => {
    await importToGapReview();
    render(<ReuploadDiffView projectId={P} />);
    fireEvent.change(screen.getByTestId("docx-input"), { target: { files: [new File(["PK"], "SRS_sua.docx")] } });
    expect(await screen.findByText(/1 thêm · 0 xoá · 1 sửa · 0 di chuyển/)).toBeInTheDocument();
    expect(mode1State.mode1State.versions).toHaveLength(1);
    const href = screen.getByRole("link", { name: "Tạo CR từ khác biệt" }).getAttribute("href")!;
    expect(readCrPrefill(new URL(href, "http://x").searchParams)).toMatchObject({ source: "reupload" });
  });
});
