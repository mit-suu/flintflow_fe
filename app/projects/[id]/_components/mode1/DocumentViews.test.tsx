import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { renderWithIntl } from "@/test/intl";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockServer } from "@/mocks/server";
import { resetMockState } from "@/mocks/state";
import { MODE1_PROJECT_ID, resetMode1MockState } from "@/mocks/mode1/state";
import * as mode1State from "@/mocks/mode1/state";
import { crToReview, importToGapReview } from "@/mocks/mode1/flows";
import { listVersions } from "@/lib/api/versions";
import GapReportView, { gapReportPrefill } from "./GapReportView";
import ReuploadDiffView from "./ReuploadDiffView";
import VersionCompare from "./VersionCompare";
import VersionsPanel from "./VersionsPanel";
import { readCrPrefill } from "./prefill";
import { labelsFor } from "./test-labels";

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

/** Import xong + một CR ghi vào tài liệu ⇒ có 0.1 và 0.2 (FLF-330: BA xác nhận là ghi ngay). */
const withRevision = async () => {
  await importToGapReview();
  await crToReview();
  return (await listVersions(P)).data!;
};

describe("GapReportView (UC-23)", () => {
  it("tổng hợp cờ (không còn mục FPT thiếu — FLF-312); nút tạo CR điền sẵn nguồn gap_report; tải docx", async () => {
    await importToGapReview();
    const onChanged = vi.fn();
    renderWithIntl(<GapReportView projectId={P} projectName="Lumen" onChanged={onChanged} />);

    expect(await screen.findByText("Gap report — bản 0.1")).toBeInTheDocument();
    expect(screen.getByText("NFR-02 trỏ tới UC-99 không tồn tại")).toBeInTheDocument();
    expect(screen.queryByText(/mẫu FPT còn thiếu|Tiêu đề mục ngoài mẫu FPT|Mục bắt buộc/)).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Tạo CR bổ sung mục thiếu" })).not.toBeInTheDocument();

    const link = screen.getByRole("link", { name: "Cần sửa → Tạo change request" });
    const prefill = readCrPrefill(new URL(link.getAttribute("href")!, "http://x").searchParams);
    expect(prefill).toMatchObject({ source: "gap_report", title: "Sửa theo gap report" });
    expect(prefill?.description).toContain("NFR-02 trỏ tới UC-99 không tồn tại");

    fireEvent.click(screen.getByRole("button", { name: "Tải gap report (.docx)" }));
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
  });

  it("gapReportPrefill chỉ liệt kê cờ đỏ trên nội dung đã có — bỏ section_empty", () => {
    const text = gapReportPrefill({
      project_id: P,
      doc_version: "0.1",
      generated_at: "",
      totals: { red: 2, yellow: 0, low_confidence_fields: 0, unrendered_diagrams: 0 },
      unrendered_diagrams: [],
      layout: [],
      sections: [
        { section_id: "fixed:4.2.3", title: "Performance", flags: [{ id: "F1", level: "red", rule_id: "nfr_missing_number", message: "Thiếu ngưỡng" } as never] },
        { section_id: "fixed:3.1.1", title: "Screens Flow", flags: [{ id: "F2", level: "red", rule_id: "section_empty", message: "Mục trống" } as never] },
      ],
      low_confidence_fields: [],
    }, labelsFor()).description;
    expect(text).toContain("4.2.3 Performance: Thiếu ngưỡng");
    expect(text).not.toContain("Mục trống");
  });
});

describe("VersionsPanel — version & release (Flow 6, UC-57)", () => {
  it("còn cờ đỏ ⇒ Release bị khoá kèm lý do", async () => {
    await importToGapReview();
    const versions = (await listVersions(P)).data!;
    renderWithIntl(<VersionsPanel projectId={P} versions={versions} redOpen={1} selected="0.1" onSelect={vi.fn()} onReleased={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Release" })).toBeDisabled();
    expect(screen.getByText(/Còn 1 cờ đỏ/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tải bản render (DRAFT)" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Tải file gốc" })).toBeEnabled();
  });

  it("đỏ = 0 ⇒ xác nhận release gọi API, báo onReleased; version draft tải bản Track Changes", async () => {
    const versions = await withRevision();
    mode1State.mode1State.redFlags = 0;
    const onReleased = vi.fn();
    renderWithIntl(<VersionsPanel projectId={P} versions={versions} redOpen={0} selected="0.2" onSelect={vi.fn()} onReleased={onReleased} />);

    expect(screen.getByRole("button", { name: "Tải bản nháp (DRAFT)" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tải bản có đánh dấu" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Release" }));
    fireEvent.click(screen.getByRole("button", { name: "Xác nhận release" }));
    await waitFor(() => expect(onReleased).toHaveBeenCalled());
    expect(mode1State.mode1State.versions.map((v) => v.version)).toContain("1.0");
  });

  it("BE vẫn chặn (422 RELEASE_RED_FLAGS_OPEN) ⇒ hiện danh sách cờ chặn", async () => {
    const versions = await withRevision();
    renderWithIntl(<VersionsPanel projectId={P} versions={versions} redOpen={0} selected="0.2" onSelect={vi.fn()} onReleased={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Release" }));
    fireEvent.click(screen.getByRole("button", { name: "Xác nhận release" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/NFR-02 trỏ tới UC-99 không tồn tại/);
  });
});

describe("VersionCompare (UC-55) và ReuploadDiffView (UC-24)", () => {
  it("so sánh 0.1 → 0.2 liệt kê block sửa", async () => {
    const versions = await withRevision();
    renderWithIntl(<VersionCompare projectId={P} versions={versions} />);
    fireEvent.click(screen.getByRole("button", { name: "So sánh" }));
    expect(await screen.findByText(/0.1 → 0.2: 0 thêm · 0 xoá · 1 sửa/)).toBeInTheDocument();
  });

  it("tải lại file ⇒ diff, không tạo version, nút tạo CR nguồn reupload", async () => {
    await importToGapReview();
    renderWithIntl(<ReuploadDiffView projectId={P} />);
    fireEvent.change(screen.getByTestId("docx-input"), { target: { files: [new File(["PK"], "SRS_sua.docx")] } });
    expect(await screen.findByText(/1 thêm · 0 xoá · 1 sửa · 0 di chuyển/)).toBeInTheDocument();
    expect(mode1State.mode1State.versions).toHaveLength(1);
    const href = screen.getByRole("link", { name: "Tạo CR từ khác biệt" }).getAttribute("href")!;
    expect(readCrPrefill(new URL(href, "http://x").searchParams)).toMatchObject({ source: "reupload" });
  });
});
