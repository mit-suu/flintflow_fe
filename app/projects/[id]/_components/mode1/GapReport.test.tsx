import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { renderWithIntl } from "@/test/intl";
import { http, HttpResponse } from "msw";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { API_BASE_URL } from "@/lib/api/client";
import { saveBlob } from "@/lib/api/files";
import { mockServer } from "@/mocks/server";
import { resetMockState } from "@/mocks/state";
import { MODE1_PROJECT_ID, resetMode1MockState } from "@/mocks/mode1/state";
import type { GapReport } from "@/types/import";
import type { Flag } from "@/types/spine";
import GapReportView, { gapReportPrefill } from "./GapReportView";
import { readCrPrefill } from "./prefill";

const P = MODE1_PROJECT_ID;

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useParams: () => ({ id: MODE1_PROJECT_ID }),
}));
// Chỉ thay saveBlob (jsdom không tải file); fetchFile giữ nguyên để đi qua msw
vi.mock("@/lib/api/files", async (importOriginal) => ({ ...(await importOriginal<object>()), saveBlob: vi.fn() }));

beforeAll(() => mockServer.listen({ onUnhandledRequest: "error" }));
beforeEach(() => {
  resetMockState();
  resetMode1MockState();
  vi.mocked(saveBlob).mockClear();
});
afterEach(() => mockServer.resetHandlers());
afterAll(() => mockServer.close());

const flag = (id: string, level: Flag["level"], section_id: string, message: string, rule_id = "R-01"): Flag => ({
  id,
  level,
  rule_id,
  section_id,
  message,
  remediation_step: "S-3.1",
  opened_at_version: 1,
  resolved_at: null,
  waived_by_user: false,
  waive_reason: null,
  waived_at_version: null,
});

const REPORT: GapReport = {
  project_id: P,
  doc_version: "0.0",
  generated_at: "2026-09-19T00:00:00.000Z",
  totals: { red: 1, yellow: 2, missing_sections: 1, unmapped_headings: 1, low_confidence_fields: 1, missing_fpt_sections: 1, unrendered_diagrams: 1 },
  missing_fpt_sections: [{ section_id: "fixed:5.1", title: "Business Rules", step_id: "S-7.1", in_layout: false }],
  unrendered_diagrams: [{ diagram_id: "", kind: "usecase", section_id: "", title: "Sơ đồ use case", reason: "not_rendered" }],
  layout: [],
  sections: [
    { section_id: "fixed:4.2.3", title: "fixed:4.2.3", flags: [flag("F1", "red", "fixed:4.2.3", "NFR-P02 thiếu ngưỡng đo được", "NFR-MEASURABLE")] },
    { section_id: "fixed:2.1", title: "Actors (tên riêng BE)", flags: [flag("F2", "yellow", "fixed:2.1", "Actor A03 không có use case")] },
    { section_id: "fixed:1", title: "fixed:1", flags: [flag("F3", "yellow", "fixed:1", "Mô tả sản phẩm quá ngắn")] },
  ],
  missing_sections: [
    { section_id: "fixed:5.3", title: "Application Messages List" },
    { section_id: "custom:x", title: "Mục riêng khách hàng" },
  ],
  unmapped_headings: [{ block_id: "B0011", text: "Phụ lục B — Biên bản họp" }],
  low_confidence_fields: [
    { section_id: "fixed:2.1", path: "actors[id=A02].kind", value: "human", confidence: 0.55, source_block_ids: ["B0005"], origin: "ai", confirmed: true },
  ],
};

/** JSON trả `report`; `?format=docx` trả `docx` (mặc định: file có Content-Disposition). */
const serveReport = (report: GapReport = REPORT, docx: () => Response = () => docxFile("Lumen_v0.0_gap-report.docx")) =>
  mockServer.use(
    http.get(`${API_BASE_URL}/projects/:projectId/gap-report`, ({ request }) =>
      new URL(request.url).searchParams.get("format") === "docx" ? docx() : HttpResponse.json({ data: report, error: null })
    )
  );

const docxFile = (name?: string) =>
  new HttpResponse("docx-bytes", { status: 200, headers: name ? { "Content-Disposition": `attachment; filename="${name}"` } : {} });

describe("GapReportView — gap report (UC-23, 1.13)", () => {
  it("ô tổng hợp đỏ/vàng/thiếu/không khớp/độ tin thấp; cờ theo section có tên section và mã luật", async () => {
    serveReport();
    renderWithIntl(<GapReportView projectId={P} />);

    expect(await screen.findByText("Gap report — bản 0.0")).toBeInTheDocument();
    const tile = (label: string) => screen.getByText(label, { selector: "span" }).parentElement!;
    expect(tile("Cờ đỏ")).toHaveTextContent("1");
    expect(tile("Cờ đỏ").className).toContain("text-[#B03030]");
    expect(tile("Cờ vàng")).toHaveTextContent("2");
    expect(tile("Section bắt buộc thiếu")).toHaveTextContent("1");
    expect(tile("Heading không khớp")).toHaveTextContent("1");
    expect(tile("Field độ tin thấp")).toHaveTextContent("1");

    // title trùng id ⇒ nhãn section chuẩn; title riêng ⇒ giữ title BE
    const perf = screen.getByRole("heading", { name: "4.2.3 Performance" }).closest("article")!;
    expect(within(perf).getByLabelText("Cờ đỏ")).toBeInTheDocument();
    expect(within(perf).getByText("NFR-P02 thiếu ngưỡng đo được")).toBeInTheDocument();
    expect(within(perf).getByText("NFR-MEASURABLE")).toBeInTheDocument();
    const actors = screen.getByRole("heading", { name: "Actors (tên riêng BE)" }).closest("article")!;
    expect(within(actors).getByLabelText("Cờ vàng")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "1 Product Overview" })).toBeInTheDocument();
  });

  it("section thiếu (nhãn chuẩn, id lạ dùng title BE), heading không khớp kèm block, field độ tin thấp kèm %", async () => {
    serveReport();
    renderWithIntl(<GapReportView projectId={P} />);
    await screen.findByText("Gap report — bản 0.0");

    expect(screen.getByText("5.3 Application Messages List")).toBeInTheDocument();
    expect(screen.getByText("Mục riêng khách hàng")).toBeInTheDocument();
    expect(screen.getByText("Phụ lục B — Biên bản họp").closest("li")).toHaveTextContent("B0011");
    expect(screen.getByText("actors[id=A02].kind").closest("li")).toHaveTextContent("— 55%");
    // nợ T4: hình chưa vẽ (import lúc thiếu PlantUML) chỉ là thông tin, không phải cờ
    expect(screen.getByText(/Sơ đồ use case/).closest("li")).toHaveTextContent("chưa vẽ");
  });

  it("gap report sạch ⇒ không hiện các mục rỗng; nút tạo CR vẫn điền sẵn nguồn gap_report + tham chiếu version", async () => {
    serveReport({
      ...REPORT,
      doc_version: "0.2",
      totals: { red: 0, yellow: 0, missing_sections: 0, unmapped_headings: 0, low_confidence_fields: 0, missing_fpt_sections: 0, unrendered_diagrams: 0 },
      missing_fpt_sections: [],
      unrendered_diagrams: [],
      sections: [],
      missing_sections: [],
      unmapped_headings: [],
      low_confidence_fields: [],
    });
    renderWithIntl(<GapReportView projectId={P} />);
    await screen.findByText("Gap report — bản 0.2");

    expect(screen.queryByText("Cờ theo section")).not.toBeInTheDocument();
    expect(screen.queryByText("Section bắt buộc không có trong tài liệu")).not.toBeInTheDocument();
    expect(screen.queryByText(/Heading không khớp template/)).not.toBeInTheDocument();
    expect(screen.queryByText("Field còn độ tin thấp")).not.toBeInTheDocument();
    expect(screen.queryByText("Hình chưa vẽ được")).not.toBeInTheDocument();
    expect(screen.getByText("Cờ đỏ", { selector: "span" }).parentElement!.className).toContain("bg-white");

    const href = screen.getByRole("link", { name: "Cần sửa → Tạo change request" }).getAttribute("href")!;
    expect(href.startsWith(`/projects/${P}/change-requests?`)).toBe(true);
    expect(readCrPrefill(new URL(href, "http://x").searchParams)).toEqual({
      title: "Sửa theo gap report",
      description: "Xử lý các vấn đề trong gap report của bản 0.2:",
      source: "gap_report",
      ref: "gap-report 0.2",
    });
  });

  it("tải .docx: lưu theo tên BE trả; báo onChanged (import sang delivered)", async () => {
    serveReport();
    const onChanged = vi.fn();
    renderWithIntl(<GapReportView projectId={P} projectName="Lumen" onChanged={onChanged} />);
    fireEvent.click(await screen.findByRole("button", { name: "Tải gap report (.docx)" }));

    await waitFor(() => expect(saveBlob).toHaveBeenCalledTimes(1));
    expect(vi.mocked(saveBlob).mock.calls[0][1]).toBe("Lumen_v0.0_gap-report.docx");
    expect(await vi.mocked(saveBlob).mock.calls[0][0].text()).toBe("docx-bytes");
    expect(onChanged).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Tải gap report (.docx)" })).toBeEnabled();
  });

  it("BE không gửi tên file ⇒ tên mặc định theo tên dự án", async () => {
    serveReport(REPORT, () => docxFile());
    renderWithIntl(<GapReportView projectId={P} projectName="Lumen" />);
    fireEvent.click(await screen.findByRole("button", { name: "Tải gap report (.docx)" }));
    await waitFor(() => expect(saveBlob).toHaveBeenCalled());
    expect(vi.mocked(saveBlob).mock.calls[0][1]).toBe("Lumen_gap-report.docx");
  });

  it("tải .docx lỗi ⇒ hiện lỗi, không báo onChanged", async () => {
    serveReport(REPORT, () => HttpResponse.json({ data: null, error: { code: "INTERNAL", message: "Không dựng được file" } }, { status: 500 }));
    const onChanged = vi.fn();
    renderWithIntl(<GapReportView projectId={P} onChanged={onChanged} />);
    fireEvent.click(await screen.findByRole("button", { name: "Tải gap report (.docx)" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Không dựng được file");
    expect(onChanged).not.toHaveBeenCalled();
    expect(saveBlob).not.toHaveBeenCalled();
  });

  it("chưa tới gap_review ⇒ lỗi tải báo cáo, không màn trắng", async () => {
    renderWithIntl(<GapReportView projectId={P} />);
    expect(screen.getByText("Đang tải gap report…")).toBeInTheDocument();
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(screen.queryByText(/Gap report — bản/)).not.toBeInTheDocument();
  });
});

describe("gapReportPrefill", () => {
  it("chỉ lấy cờ đỏ trên nội dung đã có (bỏ vàng, bỏ section_empty), không đưa mục thiếu vào CR", () => {
    const { title, description } = gapReportPrefill({
      ...REPORT,
      sections: [...REPORT.sections, { section_id: "fixed:3.1.1", title: "Screens Flow", flags: [flag("F9", "red", "fixed:3.1.1", "Mục trống", "section_empty")] }],
    });
    expect(title).toBe("Sửa theo gap report");
    // mục thiếu / mục trống đi đường step (D6) — CR chỉ sửa phần tử đang có, kẻo C-3 ra 0 vị trí
    expect(description.split("\n")).toEqual(["Xử lý các vấn đề trong gap report của bản 0.0:", "- 4.2.3 Performance: NFR-P02 thiếu ngưỡng đo được"]);
  });
});
