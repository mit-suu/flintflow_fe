import { screen } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { renderWithIntl } from "@/test/intl";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { API_BASE_URL } from "@/lib/api/client";
import { mockServer } from "@/mocks/server";
import { resetMockState } from "@/mocks/state";
import { MODE1_PROJECT_ID, resetMode1MockState } from "@/mocks/mode1/state";
import type { CreditEstimate, GetImportResponse, ImportedDocument, TemplateProfile } from "@/types/import";
import CreditEstimateNote from "./CreditEstimateNote";
import ImportWizard from "./ImportWizard";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useParams: () => ({ id: MODE1_PROJECT_ID }),
}));

const EST: CreditEstimate = { text_batches: 8, diagram_images: 1, ai_calls: 9, credits: 18, available_credits: 300 };

describe("CreditEstimateNote — ước tính lượt AI / credit trước khi trích", () => {
  it("đủ số dư ⇒ “Ước tính: ~N lượt AI, ~M credit (số dư: B)”, tách lô chữ / ảnh, không cảnh báo", () => {
    renderWithIntl(<CreditEstimateNote estimate={EST} />);
    const note = screen.getByRole("status");
    expect(note).toHaveTextContent("Ước tính: ~9 lượt AI, ~18 credit (số dư: 300)");
    expect(note).toHaveTextContent("8 lô chữ + 1 ảnh sơ đồ");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("số dư < credit ước tính ⇒ cảnh báo sẽ tạm dừng khi hết credit", () => {
    renderWithIntl(<CreditEstimateNote estimate={{ ...EST, available_credits: 10 }} />);
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("(số dư: 10)");
    expect(alert).toHaveTextContent("Số dư chưa đủ");
  });

  it("BE không trả số dư (Viewer) ⇒ dùng số dư header; không biết số dư ⇒ không hiện, không cảnh báo", () => {
    const { unmount } = renderWithIntl(<CreditEstimateNote estimate={{ ...EST, available_credits: null }} fallbackBalance={5} />);
    expect(screen.getByRole("alert")).toHaveTextContent("(số dư: 5)");
    unmount();
    renderWithIntl(<CreditEstimateNote estimate={{ ...EST, available_credits: null, diagram_images: 0 }} remaining />);
    const note = screen.getByRole("status");
    expect(note).toHaveTextContent("Ước tính phần còn lại: ~9 lượt AI, ~18 credit");
    expect(note).not.toHaveTextContent("số dư");
    expect(note).not.toHaveTextContent("ảnh sơ đồ");
  });

  it("không còn lượt AI ⇒ báo không tốn credit", () => {
    renderWithIntl(<CreditEstimateNote estimate={{ ...EST, text_batches: 0, diagram_images: 0, ai_calls: 0, credits: 0 }} />);
    expect(screen.getByText(/không cần lượt AI nào/)).toBeInTheDocument();
  });
});

describe("CreditEstimateNote trong wizard", () => {
  beforeAll(() => mockServer.listen({ onUnhandledRequest: "error" }));
  beforeEach(() => {
    resetMockState();
    resetMode1MockState();
  });
  afterEach(() => mockServer.resetHandlers());
  afterAll(() => mockServer.close());

  const doc = (status: ImportedDocument["status"]): ImportedDocument => ({
    id: "66f000000000000000000001",
    project_id: MODE1_PROJECT_ID,
    original_name: "SRS_Lumen.docx",
    size: 10,
    sha256: "a".repeat(64),
    status,
    preflight: { status: "accepted", issues: [] },
    stamp: null,
    confirmed_latest_at: "2026-09-19T00:00:00.000Z",
    paused: null,
    extract_cursor: null,
    created_at: "2026-09-19T00:00:00.000Z",
    updated_at: "2026-09-19T00:00:00.000Z",
  });
  const profile: TemplateProfile = {
    doc_version: "0.0",
    heading_map: [{ block_id: "B0001", heading_text: "1 Product Overview", section_id: "fixed:1", confidence: 0.6, detected_by: "numbering_pattern", confirmed: false }],
    table_map: [],
    required_sections: [],
    language: "en",
    layout: [],
  };
  const serve = (view: GetImportResponse) =>
    mockServer.use(http.get(`${API_BASE_URL}/projects/:projectId/import`, () => HttpResponse.json({ data: view, error: null })));

  it("bước mapping: hiện ước tính + số dư ví org từ BE; số dư thấp ⇒ cảnh báo", async () => {
    serve({ import: doc("mapping_review"), profile, extraction: { sections: [], review_fields: [] }, blocks_count: 3, credit_estimate: { ...EST, available_credits: 6 } });
    renderWithIntl(<ImportWizard projectId={MODE1_PROJECT_ID} credits={100} pollMs={5} />);
    expect(await screen.findByText("Xác nhận mapping heading → section")).toBeInTheDocument();
    const note = screen.getByRole("alert");
    expect(note).toHaveTextContent("Ước tính: ~9 lượt AI, ~18 credit (số dư: 6)");
    expect(note).toHaveTextContent("Số dư chưa đủ");
  });

  it("bước bắt đầu trích: hiện ước tính cạnh nút bắt đầu; không có ước tính ⇒ không hiện", async () => {
    const sections = [{ section_id: "fixed:1", status: "pending" as const, fields_total: 0, fields_needing_review: 0, error: null }];
    serve({ import: doc("extracting"), profile, extraction: { sections, review_fields: [] }, blocks_count: 3, credit_estimate: EST });
    const { unmount } = renderWithIntl(<ImportWizard projectId={MODE1_PROJECT_ID} credits={100} pollMs={5} />);
    await screen.findByRole("button", { name: "Bắt đầu trích (AI)" });
    expect(screen.getByRole("status")).toHaveTextContent("Ước tính: ~9 lượt AI, ~18 credit (số dư: 300)");
    unmount();

    serve({ import: doc("extracting"), profile, extraction: { sections, review_fields: [] }, blocks_count: 3, credit_estimate: null });
    renderWithIntl(<ImportWizard projectId={MODE1_PROJECT_ID} credits={100} pollMs={5} />);
    await screen.findByRole("button", { name: "Bắt đầu trích (AI)" });
    expect(screen.queryByText(/Ước tính/)).not.toBeInTheDocument();
  });
});
