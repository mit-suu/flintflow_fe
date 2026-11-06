import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithIntl } from "@/test/intl";
import { API_BASE_URL } from "@/lib/api/client";
import { mockServer } from "@/mocks/server";
import { resetMockState } from "@/mocks/state";
import { MODE1_PROJECT_ID, resetMode1MockState } from "@/mocks/mode1/state";
import * as mode1State from "@/mocks/mode1/state";
import { importToGapReview, newCr } from "@/mocks/mode1/flows";
import type { CrDetail } from "@/types/change-request";
import type { GapReport } from "@/types/import";
import CrWorkspace from "./CrWorkspace";
import GapReportView from "./GapReportView";

const P = MODE1_PROJECT_ID;
const S = () => mode1State.mode1State;
const push = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: vi.fn() }),
  useParams: () => ({ id: MODE1_PROJECT_ID }),
}));

beforeAll(() => mockServer.listen({ onUnhandledRequest: "error" }));
beforeEach(async () => {
  resetMockState();
  resetMode1MockState();
  push.mockClear();
  await importToGapReview();
});
afterEach(() => mockServer.resetHandlers());
afterAll(() => mockServer.close());

/** CR mock đổi thành CR bổ sung (`kind: gap_fill`) với các mục còn trống theo tiêu đề của file. */
const gapFillCr = async (gap_sections = [
  { section_id: "fixed:2.3", title: "2.3 User Characteristics" },
  { section_id: "custom:CS04", title: "3.3 Performance Requirements" },
]): Promise<CrDetail> => {
  const detail = await newCr("Soạn các mục còn trống", "Soạn các mục còn trống của tài liệu: 2.3 User Characteristics, 3.3 Performance Requirements");
  const stored = S().crs.get(detail.change_request.cr_id)!;
  Object.assign(stored.change_request, { kind: "gap_fill", gap_sections });
  return stored;
};

describe("CrWorkspace — CR bổ sung mục còn thiếu (FLF-382)", () => {
  it("kind gap_fill ⇒ tiêu đề 'Bổ sung mục còn thiếu' + danh sách mục sẽ soạn (tiêu đề của file, không mã nội bộ); các bước CR như cũ", async () => {
    const { change_request } = await gapFillCr();
    renderWithIntl(<CrWorkspace projectId={P} crId={change_request.cr_id} />);
    expect(await screen.findByRole("heading", { name: "Bổ sung mục còn thiếu" })).toBeInTheDocument();
    const list = screen.getByRole("region", { name: "Mục sẽ soạn" });
    expect(within(list).getByText(/soạn 2 mục còn trống/)).toBeInTheDocument();
    expect(within(list).getAllByRole("listitem").map((li) => li.textContent)).toEqual(["2.3 User Characteristics", "3.3 Performance Requirements"]);
    expect(document.body.textContent).not.toMatch(/fixed:2\.3|custom:CS04/);
    // Phần còn lại của luồng CR giữ nguyên: bước làm rõ của C-2
    expect(screen.getByRole("button", { name: "Bắt đầu làm rõ (AI)" })).toBeInTheDocument();
  });

  it("CR thường (không có kind) ⇒ giữ tiêu đề và mô tả của CR, không có danh sách mục", async () => {
    const { change_request } = await newCr("Đăng xuất mọi thiết bị");
    renderWithIntl(<CrWorkspace projectId={P} crId={change_request.cr_id} />);
    expect(await screen.findByRole("heading", { name: "Đăng xuất mọi thiết bị" })).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Mục sẽ soạn" })).toBeNull();
    expect(screen.queryByText("Bổ sung mục còn thiếu")).toBeNull();
  });
});

const REPORT: GapReport = {
  project_id: P,
  doc_version: "0.1",
  generated_at: "2026-11-06T00:00:00.000Z",
  totals: { red: 0, yellow: 0, low_confidence_fields: 0, unrendered_diagrams: 0 },
  unrendered_diagrams: [],
  layout: [],
  sections: [],
  low_confidence_fields: [],
};

describe("GapReportView — Soạn mục còn trống (FLF-382)", () => {
  const serve = (gapFill: () => Response) => {
    let calls = 0;
    mockServer.use(
      http.get(`${API_BASE_URL}/projects/:projectId/gap-report`, () => HttpResponse.json({ data: REPORT, error: null })),
      http.post(`${API_BASE_URL}/projects/:projectId/change-requests/gap-fill`, async ({ request }) => {
        calls += 1;
        expect(await request.json()).toEqual({});
        return gapFill();
      })
    );
    return () => calls;
  };

  it("bấm ⇒ POST /change-requests/gap-fill ⇒ chuyển tới trang CR trả về", async () => {
    const detail = await gapFillCr();
    const calls = serve(() => HttpResponse.json({ data: { ...detail, change_request: { ...detail.change_request, cr_id: "CR-042" } }, error: null }));
    renderWithIntl(<GapReportView projectId={P} gapFill />);
    fireEvent.click(await screen.findByRole("button", { name: "Soạn mục còn trống" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith(`/projects/${P}?panel=cr&cr=CR-042`));
    expect(calls()).toBe(1);
  });

  it("409 NO_MISSING_SECTIONS ⇒ câu thân thiện, không chuyển trang", async () => {
    serve(() => HttpResponse.json({ data: null, error: { code: "NO_MISSING_SECTIONS", message: "No missing sections" } }, { status: 409 }));
    renderWithIntl(<GapReportView projectId={P} gapFill />);
    fireEvent.click(await screen.findByRole("button", { name: "Soạn mục còn trống" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Tài liệu không còn mục trống nào cần soạn.");
    expect(push).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Soạn mục còn trống" })).toBeEnabled();
  });

  it("không bật gapFill (luồng A / C) hoặc Viewer ⇒ không có nút", async () => {
    serve(() => HttpResponse.json({ data: null, error: null }));
    const { unmount } = renderWithIntl(<GapReportView projectId={P} />);
    await screen.findByText("Gap report — bản 0.1");
    expect(screen.queryByRole("button", { name: "Soạn mục còn trống" })).toBeNull();
    unmount();
    renderWithIntl(<GapReportView projectId={P} gapFill readOnly />);
    await screen.findByText("Gap report — bản 0.1");
    expect(screen.queryByRole("button", { name: "Soạn mục còn trống" })).toBeNull();
  });
});
