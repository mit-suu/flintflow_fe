/**
 * Danh sách change request (UC-48) — V6: file này trước đây 0% coverage. Kiểm ba thứ dễ hỏng âm thầm:
 * bộ lọc mở/đóng theo `CR_TERMINAL_STATUSES`, form mở sẵn khi có prefill, và lỗi tải không làm trắng trang.
 */
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { renderWithIntl } from "@/test/intl";
import { http, HttpResponse } from "msw";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { API_BASE_URL } from "@/lib/api/client";
import { mockServer } from "@/mocks/server";
import type { Cr, CrStatus } from "@/types/change-request";
import ChangeRequestList, { statusTone } from "./ChangeRequestList";

const P = "650000000000000000000001";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useParams: () => ({ id: "650000000000000000000001" }),
}));

beforeAll(() => mockServer.listen({ onUnhandledRequest: "error" }));
// FLF-338: panel tài liệu tham khảo gọi /documents — không có tài liệu ⇒ panel ẩn
beforeEach(() => mockServer.use(http.get(`${API_BASE_URL}/projects/:projectId/documents`, () => HttpResponse.json({ data: [], error: null }))));
afterEach(() => mockServer.resetHandlers());
afterAll(() => mockServer.close());

const cr = (cr_id: string, status: CrStatus, over: Partial<Cr> = {}): Cr => ({
  cr_id,
  project_id: P,
  title: `Tiêu đề ${cr_id}`,
  description: "mô tả",
  source: { kind: "verbal", ref: null, note: null },
  requester: "PM Lan",
  status,
  paused: null,
  clarifications: [],
  base_doc_version: "0.1",
  result_doc_version: null,
  created_by: "u1",
  submitted_at: null,
  decided_by: null,
  closed_reason: null,
  seed: null,
  materials: [],
  missing_info: [],
  amendments: [],
  created_at: "2026-09-20T03:00:00.000Z",
  updated_at: "2026-09-20T03:00:00.000Z",
  ...over,
});

const serveList = (list: Cr[]) =>
  mockServer.use(http.get(`${API_BASE_URL}/projects/:projectId/change-requests`, () => HttpResponse.json({ data: list, error: null })));

const LIST = [
  cr("CR-001", "in_review"),
  cr("CR-002", "written", { result_doc_version: "0.2" }),
  cr("CR-003", "cancelled"),
  cr("CR-004", "proposing", { paused: { reason: "credits", at: "2026-09-20T03:00:00.000Z" } }),
];

const rows = () => within(screen.getByRole("list")).getAllByRole("listitem");

describe("ChangeRequestList", () => {
  it("mặc định chỉ hiện CR đang mở; chuyển bộ lọc ra CR đã đóng rồi tất cả", async () => {
    serveList(LIST);
    renderWithIntl(<ChangeRequestList projectId={P} prefill={null} />);

    await waitFor(() => expect(rows()).toHaveLength(2));
    expect(screen.getByText("CR-001")).toBeInTheDocument();
    expect(screen.getByText("CR-004")).toBeInTheDocument();
    expect(screen.queryByText("CR-002"), "written là trạng thái kết thúc").not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Đã xong / đóng" }));
    await waitFor(() => expect(rows()).toHaveLength(2));
    expect(screen.getByText("CR-002")).toBeInTheDocument();
    expect(screen.getByText("CR-003")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Tất cả" }));
    await waitFor(() => expect(rows()).toHaveLength(4));
  });

  it("CR tạm dừng có nhãn riêng; CR đã ghi nói rõ vào bản nào", async () => {
    serveList(LIST);
    renderWithIntl(<ChangeRequestList projectId={P} prefill={null} />);
    await waitFor(() => expect(screen.getByText("CR-004")).toBeInTheDocument());
    expect(screen.getByText("Tạm dừng")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Tất cả" }));
    await waitFor(() => expect(screen.getByText(/ghi vào bản 0.2/)).toBeInTheDocument());
  });

  it("danh sách rỗng ⇒ câu giải thích, không phải bảng trống", async () => {
    serveList([]);
    renderWithIntl(<ChangeRequestList projectId={P} prefill={null} />);
    expect(await screen.findByText("Chưa có change request nào ở mục này.")).toBeInTheDocument();
  });

  it("lỗi tải ⇒ báo lỗi mà vẫn dùng được nút tạo mới", async () => {
    mockServer.use(
      http.get(`${API_BASE_URL}/projects/:projectId/change-requests`, () =>
        HttpResponse.json({ data: null, error: { code: "PROJECT_NOT_FOUND", message: "Không tìm thấy dự án" } }, { status: 404 })
      )
    );
    renderWithIntl(<ChangeRequestList projectId={P} prefill={null} />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Không tìm thấy dự án");
    expect(screen.getByRole("button", { name: "+ Tạo change request" })).toBeInTheDocument();
  });

  it("có prefill (từ gap report / chat) ⇒ form mở sẵn, không phải bấm thêm", async () => {
    serveList([]);
    renderWithIntl(<ChangeRequestList projectId={P} prefill={{ title: "Đổi tên actor", description: "Learner ⇒ Student", source: "gap_report" }} />);
    await waitFor(() => expect(screen.getByLabelText("Tiêu đề")).toHaveValue("Đổi tên actor"));
    expect(screen.queryByRole("button", { name: "+ Tạo change request" }), "form đang mở thì không mời mở lần nữa").not.toBeInTheDocument();
  });

  it("statusTone: bốn nhóm màu theo trạng thái, không trạng thái nào rơi ra ngoài", () => {
    expect(statusTone("written")).toContain("1F7A45");
    expect(statusTone("rejected")).toBe(statusTone("cancelled"));
    expect(statusTone("manual_fix")).toBe(statusTone("in_review"));
    expect(statusTone("draft")).toContain("554DB0");
  });
});

describe("ChangeRequestList — Viewer (readOnly)", () => {
  it("xem được danh sách; không có nút tạo, prefill cũng không mở form", async () => {
    serveList(LIST);
    renderWithIntl(<ChangeRequestList projectId={P} prefill={{ title: "Từ gap report", description: "x" }} readOnly />);
    await waitFor(() => expect(rows()).toHaveLength(2));
    expect(screen.queryByRole("button", { name: "+ Tạo change request" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Tạo change request" })).not.toBeInTheDocument();
  });
});

describe("ChangeRequestList — Cần xem (FLF-343)", () => {
  const flag = (id: string, rule_id: string, over: Record<string, unknown> = {}) => ({
    id,
    level: "yellow",
    rule_id,
    section_id: "fixed:2.1",
    target_id: "actors[id=A02].kind",
    message: `Cần xem: tác nhân ${id} — độ tin 55%`,
    remediation_step: null,
    opened_at_version: 3,
    resolved_at: null,
    waived_by_user: false,
    waive_reason: null,
    waived_at_version: null,
    ...over,
  });
  const serveFlags = (flags: unknown[]) =>
    mockServer.use(http.get(`${API_BASE_URL}/projects/:projectId/flags`, () => HttpResponse.json({ data: flags, error: null })));

  it("đếm + liệt kê mỗi cờ import_needs_review đang mở đúng một lần, link Tạo CR điền sẵn (không gán nguồn); cờ khác / đã đóng / đã waive không hiện", async () => {
    serveList([]);
    serveFlags([
      flag("FL1", "import_needs_review"),
      flag("FL2", "import_needs_review", { target_id: "B0007", section_id: "fixed:5.1" }),
      flag("FL3", "ambiguity"),
      flag("FL4", "import_needs_review", { resolved_at: "2026-10-30T00:00:00.000Z" }),
      flag("FL5", "import_needs_review", { waived_by_user: true, waive_reason: "ok" }),
    ]);
    renderWithIntl(<ChangeRequestList projectId={P} prefill={null} />);
    const section = await screen.findByRole("region", { name: "Cần xem (2)" });
    expect(within(section).getAllByRole("listitem")).toHaveLength(2);
    expect(within(section).getByText("Dữ liệu đọc chưa chắc: Tác nhân A02 — Loại")).toBeInTheDocument();
    expect(within(section).getByText("Khớp mục chưa chắc: 5.1 Business Rules")).toBeInTheDocument();
    const links = within(section).getAllByRole("link", { name: "Tạo CR" });
    const href = decodeURIComponent(links[0].getAttribute("href")!.replace(/\+/g, " "));
    expect(href).toContain("panel=cr");
    expect(href).toContain("new=1");
    expect(href).toContain("actors[id=A02].kind");
    expect(href).not.toContain("source=");
  });

  it("tiếng Anh: câu Cần xem dựng theo ngôn ngữ giao diện, không lòi câu tiếng Việt của BE", async () => {
    serveList([]);
    serveFlags([flag("FL1", "import_needs_review")]);
    renderWithIntl(<ChangeRequestList projectId={P} prefill={null} />, "en");
    const section = await screen.findByRole("region", { name: "Needs review (1)" });
    expect(within(section).getByText(/^Uncertain reading: /)).toBeInTheDocument();
    expect(within(section).queryByText(/Cần xem|độ tin/)).toBeNull();
  });

  it("không có cờ Cần xem ⇒ không có khối; viewer không có nút Tạo CR", async () => {
    serveList([]);
    serveFlags([]);
    renderWithIntl(<ChangeRequestList projectId={P} prefill={null} />);
    await screen.findByText("Chưa có change request nào ở mục này.");
    expect(screen.queryByRole("region", { name: /Cần xem/ })).toBeNull();

    serveFlags([flag("FL1", "import_needs_review")]);
    renderWithIntl(<ChangeRequestList projectId={P} prefill={null} readOnly />);
    expect(await screen.findByRole("region", { name: "Cần xem (1)" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Tạo CR" })).toBeNull();
  });
});
