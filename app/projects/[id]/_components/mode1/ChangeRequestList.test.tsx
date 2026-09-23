/**
 * Danh sách change request (UC-48) — V6: file này trước đây 0% coverage. Kiểm ba thứ dễ hỏng âm thầm:
 * bộ lọc mở/đóng theo `CR_TERMINAL_STATUSES`, form mở sẵn khi có prefill, và lỗi tải không làm trắng trang.
 */
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
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
  base_doc_version: "0.0",
  result_doc_version: null,
  created_by: "u1",
  submitted_at: null,
  decided_by: null,
  closed_reason: null,
  seed: null,
  created_at: "2026-09-20T03:00:00.000Z",
  updated_at: "2026-09-20T03:00:00.000Z",
  ...over,
});

const serveList = (list: Cr[]) =>
  mockServer.use(http.get(`${API_BASE_URL}/projects/:projectId/change-requests`, () => HttpResponse.json({ data: list, error: null })));

const LIST = [
  cr("CR-001", "in_review"),
  cr("CR-002", "written", { result_doc_version: "0.1" }),
  cr("CR-003", "cancelled"),
  cr("CR-004", "proposing", { paused: { reason: "credits", at: "2026-09-20T03:00:00.000Z" } }),
];

const rows = () => within(screen.getByRole("list")).getAllByRole("listitem");

describe("ChangeRequestList", () => {
  it("mặc định chỉ hiện CR đang mở; chuyển bộ lọc ra CR đã đóng rồi tất cả", async () => {
    serveList(LIST);
    render(<ChangeRequestList projectId={P} prefill={null} />);

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
    render(<ChangeRequestList projectId={P} prefill={null} />);
    await waitFor(() => expect(screen.getByText("CR-004")).toBeInTheDocument());
    expect(screen.getByText("Tạm dừng")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Tất cả" }));
    await waitFor(() => expect(screen.getByText(/ghi vào bản 0\.1/)).toBeInTheDocument());
  });

  it("danh sách rỗng ⇒ câu giải thích, không phải bảng trống", async () => {
    serveList([]);
    render(<ChangeRequestList projectId={P} prefill={null} />);
    expect(await screen.findByText("Chưa có change request nào ở mục này.")).toBeInTheDocument();
  });

  it("lỗi tải ⇒ báo lỗi mà vẫn dùng được nút tạo mới", async () => {
    mockServer.use(
      http.get(`${API_BASE_URL}/projects/:projectId/change-requests`, () =>
        HttpResponse.json({ data: null, error: { code: "PROJECT_NOT_FOUND", message: "Không tìm thấy dự án" } }, { status: 404 })
      )
    );
    render(<ChangeRequestList projectId={P} prefill={null} />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Không tìm thấy dự án");
    expect(screen.getByRole("button", { name: "+ Tạo change request" })).toBeInTheDocument();
  });

  it("có prefill (từ gap report / chat) ⇒ form mở sẵn, không phải bấm thêm", async () => {
    serveList([]);
    render(<ChangeRequestList projectId={P} prefill={{ title: "Đổi tên actor", description: "Learner ⇒ Student", source: "gap_report" }} />);
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
