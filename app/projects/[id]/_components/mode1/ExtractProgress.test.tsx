import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { renderWithIntl } from "@/test/intl";
import { http, HttpResponse } from "msw";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { API_BASE_URL } from "@/lib/api/client";
import { mockServer } from "@/mocks/server";
import { resetMockState } from "@/mocks/state";
import { MODE1_PROJECT_ID, resetMode1MockState } from "@/mocks/mode1/state";
import type { ExtractionSection, GetImportResponse, ImportedDocument } from "@/types/import";
import ExtractProgress from "./ExtractProgress";
import ImportWizard from "./ImportWizard";

const P = MODE1_PROJECT_ID;

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

const doc = (over: Partial<ImportedDocument> = {}): ImportedDocument => ({
  id: "66f000000000000000000001",
  project_id: P,
  original_name: "SRS_Lumen.docx",
  size: 10,
  sha256: "a".repeat(64),
  status: "extracting",
  preflight: { status: "accepted", issues: [] },
  stamp: null,
  confirmed_latest_at: "2026-09-19T00:00:00.000Z",
  paused: null,
  extract_cursor: null,
  created_at: "2026-09-19T00:00:00.000Z",
  updated_at: "2026-09-19T00:00:00.000Z",
  ...over,
});

const section = (section_id: string, status: ExtractionSection["status"], over: Partial<ExtractionSection> = {}): ExtractionSection => ({
  section_id,
  status,
  fields_total: status === "done" ? 4 : 0,
  fields_needing_review: 0,
  error: null,
  ...over,
});

const SECTIONS = [
  section("fixed:1", "done", { fields_total: 3 }),
  section("fixed:2.1", "done", { fields_total: 6, fields_needing_review: 2 }),
  section("fixed:3.1.2", "pending"),
  section("fixed:4.2.3", "failed", { error: "AI trả sai schema" }),
];

const props = (over: Partial<Parameters<typeof ExtractProgress>[0]> = {}) => ({
  doc: doc(),
  sections: SECTIONS,
  running: false,
  credits: 42,
  onStart: vi.fn(),
  onResume: vi.fn(),
  ...over,
});

describe("ExtractProgress — trích field theo section (1.8)", () => {
  it("cursor null, chưa chạy, chưa section nào xong ⇒ nút “Bắt đầu trích (AI)” (không tự tiêu credit)", () => {
    const p = props({ sections: SECTIONS.map((s) => ({ ...s, status: "pending" as const, error: null })) });
    renderWithIntl(<ExtractProgress {...p} />);
    expect(screen.getByText(/Mapping đã chốt — 4 section sẵn sàng để trích/)).toBeInTheDocument();
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
    expect(p.onStart).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Bắt đầu trích (AI)" }));
    expect(p.onStart).toHaveBeenCalledTimes(1);
  });

  it("chưa có danh sách section ⇒ vẫn cho bắt đầu; đang bắt đầu ⇒ nút khoá; credit chưa tải hiện “…”", () => {
    renderWithIntl(<ExtractProgress {...props({ sections: [], busy: true, credits: null })} />);
    expect(screen.getByText(/các section sẵn sàng để trích/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Đang bắt đầu…" })).toBeDisabled();
    expect(screen.getByText("Credit khả dụng: …")).toBeInTheDocument();
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });

  it("đang chạy ⇒ thanh tiến độ theo số section xong, tên section đang trích, số field cần xem, lỗi section", () => {
    renderWithIntl(<ExtractProgress {...props({ running: true, doc: doc({ extract_cursor: "fixed:3.1.2" }) })} />);
    expect(screen.queryByRole("button", { name: "Bắt đầu trích (AI)" })).not.toBeInTheDocument();
    expect(screen.getByText("Đang trích 3.1.2 Screen Descriptions…")).toBeInTheDocument();
    expect(screen.getByText("2/4 section")).toBeInTheDocument();
    const bar = screen.getByRole("progressbar");
    expect(bar).toHaveAttribute("aria-valuenow", "2");
    expect(bar).toHaveAttribute("aria-valuemax", "4");
    expect((bar.firstElementChild as HTMLElement).style.width).toBe("50%");
    expect(screen.getByText("Credit khả dụng: 42")).toBeInTheDocument();

    const items = within(screen.getByRole("list")).getAllByRole("listitem");
    expect(items).toHaveLength(4);
    expect(items[0]).toHaveTextContent("1 Product Overview");
    expect(items[0]).toHaveTextContent("3 field");
    expect(items[1]).toHaveTextContent("6 field · 2 cần xem");
    expect(items[2].className).toContain("bg-[#F2F1FB]"); // section đang trích được làm nổi
    expect(within(items[2]).getByLabelText("Chờ")).toBeInTheDocument();
    expect(within(items[3]).getByLabelText("Lỗi")).toBeInTheDocument();
    expect(items[3]).toHaveTextContent("AI trả sai schema");
  });

  it("đã dừng (không chạy, đã có section xong) ⇒ “Đã dừng”, không hiện nút bắt đầu", () => {
    renderWithIntl(<ExtractProgress {...props({ doc: doc({ extract_cursor: null }) })} />);
    expect(screen.getByText("Đã dừng")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Bắt đầu trích (AI)" })).not.toBeInTheDocument();
  });

  it("paused (kể cả cursor null) ⇒ banner paused thay nút bắt đầu; Tiếp tục gọi onResume", () => {
    const p = props({ doc: doc({ paused: { reason: "credits", at: "2026-09-19T00:00:00.000Z" } }), sections: [section("fixed:1", "pending")] });
    renderWithIntl(<ExtractProgress {...p} />);
    expect(screen.getByText(/Trích field đang tạm dừng — hết credit/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Bắt đầu trích (AI)" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Tiếp tục" }));
    expect(p.onResume).toHaveBeenCalledTimes(1);
    expect(p.onStart).not.toHaveBeenCalled();
  });
});

describe("ExtractProgress trong wizard — poll GET /import khi job nền chạy", () => {
  /** Mỗi lần GET /import trả bản kế tiếp trong `frames` (bản cuối lặp lại). */
  const serveFrames = (frames: GetImportResponse[]) => {
    let calls = 0;
    mockServer.use(
      http.get(`${API_BASE_URL}/projects/:projectId/import`, () => {
        const frame = frames[Math.min(calls, frames.length - 1)];
        calls += 1;
        return HttpResponse.json({ data: frame, error: null });
      })
    );
    return () => calls;
  };

  const frame = (d: ImportedDocument, sections: ExtractionSection[]): GetImportResponse => ({
    import: d,
    profile: null,
    extraction: { sections, review_fields: [] },
    blocks_count: 12,
  });

  it("mở lại trang giữa lúc đang trích (cursor ≠ null) ⇒ tự poll, tiến độ tăng tới khi sang xác nhận field", async () => {
    const calls = serveFrames([
      frame(doc({ extract_cursor: "fixed:2.1" }), [section("fixed:1", "done"), section("fixed:2.1", "pending"), section("fixed:3.1.2", "pending")]),
      frame(doc({ extract_cursor: "fixed:3.1.2" }), [section("fixed:1", "done"), section("fixed:2.1", "done"), section("fixed:3.1.2", "pending")]),
      frame(doc({ status: "fields_review", extract_cursor: null }), [section("fixed:1", "done"), section("fixed:2.1", "done"), section("fixed:3.1.2", "done")]),
    ]);
    renderWithIntl(<ImportWizard projectId={P} credits={100} pollMs={5} />);

    expect(await screen.findByText("Đang trích 2.1 Actors…")).toBeInTheDocument();
    expect(screen.getByText("1/3 section")).toBeInTheDocument();
    expect(await screen.findByText("Xem lại field độ tin thấp")).toBeInTheDocument();
    const settled = calls();
    expect(settled).toBe(3);
    // rời `extracting` ⇒ ngừng poll
    await new Promise((r) => setTimeout(r, 40));
    expect(calls()).toBe(settled);
  });

  it("cursor null và chưa bấm ⇒ không poll, không tự gọi trích; bấm “Bắt đầu trích” thì mới chạy nền", async () => {
    const calls = serveFrames([frame(doc(), [section("fixed:1", "pending")])]);
    let started = 0;
    mockServer.use(
      http.post(`${API_BASE_URL}/projects/:projectId/import/extract`, () => {
        started += 1;
        return HttpResponse.json({ data: { import: doc(), sections: [section("fixed:1", "pending")] }, error: null });
      })
    );
    renderWithIntl(<ImportWizard projectId={P} credits={100} pollMs={5} />);

    const start = await screen.findByRole("button", { name: "Bắt đầu trích (AI)" });
    await new Promise((r) => setTimeout(r, 40));
    expect(calls()).toBe(1);
    expect(started).toBe(0);

    fireEvent.click(start);
    await waitFor(() => expect(started).toBe(1));
    // job đã bật trong phiên ⇒ poll dù BE chưa kịp ghi cursor
    await waitFor(() => expect(calls()).toBeGreaterThan(3));
    expect(screen.getByText("Đang trích…")).toBeInTheDocument();
  });

  it("bị paused giữa chừng ⇒ ngừng poll và hiện banner", async () => {
    const calls = serveFrames([
      frame(doc({ extract_cursor: "fixed:2.1" }), [section("fixed:1", "done"), section("fixed:2.1", "pending")]),
      frame(doc({ extract_cursor: "fixed:2.1", paused: { reason: "resume_later", at: "2026-09-19T00:00:00.000Z" } }), [section("fixed:1", "done"), section("fixed:2.1", "pending")]),
    ]);
    renderWithIntl(<ImportWizard projectId={P} credits={100} pollMs={5} />);

    expect(await screen.findByText(/Trích field đang tạm dừng — AI lỗi, đã thử lại 2 lần/)).toBeInTheDocument();
    const settled = calls();
    await new Promise((r) => setTimeout(r, 40));
    expect(calls()).toBe(settled);
    expect(screen.getByText("Đã dừng")).toBeInTheDocument();
  });
});
