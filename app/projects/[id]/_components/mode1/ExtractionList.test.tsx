import { fireEvent, screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { renderWithIntl } from "@/test/intl";
import { API_BASE_URL } from "@/lib/api/client";
import { mockServer } from "@/mocks/server";
import type { Extraction } from "@/types/extraction";
import ExtractionList from "./ExtractionList";

const P = "650000000000000000000002";
const D = "6700000000000000000000d1";

beforeAll(() => mockServer.listen({ onUnhandledRequest: "error" }));
afterEach(() => mockServer.resetHandlers());
afterAll(() => mockServer.close());

const extraction = (over: Partial<Extraction> = {}): Extraction => ({
  document_id: D,
  document_name: "minutes.txt",
  doc_code: 1,
  status: "extracted",
  credits: 3,
  approved_at: null,
  created_at: "2026-10-27T01:00:00.000Z",
  updated_at: "2026-10-27T01:00:00.000Z",
  items: [
    { id: "R1", text: "Every report must be exportable to CSV.", label: "new", para_id: "D1-P02", quote: "every report can be exported to CSV", group: "G1", entity_paths: [], question: null, suggested_answers: [], include: null, drop_reason: null, answer: null, cr_id: null },
    { id: "R2", text: "Login keeps email and password.", label: "duplicate", para_id: "D1-P03", quote: "Login stays with email and password", group: "G2", entity_paths: ["use_cases[id=UC-01]"], question: null, suggested_answers: [], include: null, drop_reason: null, answer: null, cr_id: null },
    { id: "R3", text: "The dashboard should feel fast.", label: "ambiguous", para_id: "D1-P04", quote: "The dashboard should feel fast.", group: "G3", entity_paths: [], question: "Fast means what?", suggested_answers: ["Under 2 seconds", "Under 5 seconds"], include: null, drop_reason: null, answer: null, cr_id: null },
  ],
  ...over,
});

const serveApprove = () => {
  const calls: unknown[] = [];
  mockServer.use(
    http.post(`${API_BASE_URL}/projects/:projectId/documents/:documentId/extract/approve`, async ({ request }) => {
      const body = (await request.json()) as { requester: string; decisions: { id: string; include: boolean; answer?: string | null; drop_reason?: string | null }[] };
      calls.push(body);
      const unanswered = body.decisions.filter((d) => d.id === "R3" && d.include && !d.answer).map((d) => d.id);
      if (unanswered.length) return HttpResponse.json({ data: null, error: { code: "EXTRACTION_DECISION_INVALID", message: "Mục mơ hồ cần câu trả lời." }, meta: { item_ids: unanswered } }, { status: 400 });
      const approved = extraction({ status: "approved", approved_at: "2026-10-27T02:00:00.000Z" });
      approved.items[0].cr_id = "CR-001";
      approved.items[2].cr_id = "CR-002";
      return HttpResponse.json({ data: approved, error: null });
    })
  );
  return calls;
};

describe("ExtractionList (FLF-338 §3.6.1 — BA duyệt danh sách rút yêu cầu)", () => {
  it("hiện nhãn, trích dẫn + mã đoạn, thẻ câu hỏi gom; nút tạo khoá tới khi có người yêu cầu và câu trả lời; mục trùng không tính vào số CR", async () => {
    renderWithIntl(<ExtractionList projectId={P} extraction={extraction()} onApproved={vi.fn()} />);
    expect(screen.getByText("Mới")).toBeInTheDocument();
    expect(screen.getByText("Trùng")).toBeInTheDocument();
    expect(screen.getByText("Mơ hồ")).toBeInTheDocument();
    expect(screen.getByText(/every report can be exported to CSV/)).toHaveTextContent("minutes.txt · D1-P02");
    expect(screen.getByRole("group", { name: "Câu hỏi của AI" })).toHaveTextContent("Fast means what?");

    const create = screen.getByRole("button", { name: "Tạo 2 change request" });
    expect(create).toBeDisabled();
    fireEvent.change(screen.getByPlaceholderText(/Ai đưa ra yêu cầu/), { target: { value: "PM Lan" } });
    expect(create).toBeDisabled();
    expect(screen.getByText(/Còn 1 mục thiếu lý do bỏ hoặc câu trả lời/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Under 2 seconds" }));
    expect(screen.getByRole("button", { name: "Tạo 2 change request" })).toBeEnabled();
  });

  it("bỏ mục phải ghi lý do; đổi nhóm để tách ⇒ số CR tăng; duyệt gửi đúng quyết định và gọi onApproved", async () => {
    const calls = serveApprove();
    const onApproved = vi.fn();
    renderWithIntl(<ExtractionList projectId={P} extraction={extraction()} onApproved={onApproved} />);
    fireEvent.change(screen.getByPlaceholderText(/Ai đưa ra yêu cầu/), { target: { value: "PM Lan" } });
    fireEvent.click(screen.getByRole("checkbox", { name: "Đưa R3 vào" }));
    expect(screen.getByRole("button", { name: "Tạo 1 change request" })).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Lý do bỏ R3"), { target: { value: "Không đo được" } });
    fireEvent.change(screen.getByLabelText("Nhóm của R1"), { target: { value: "G9" } });
    const create = screen.getByRole("button", { name: "Tạo 1 change request" });
    expect(create).toBeEnabled();
    fireEvent.click(create);

    await waitFor(() => expect(onApproved).toHaveBeenCalledTimes(1));
    expect(calls[0]).toEqual({
      requester: "PM Lan",
      decisions: [
        { id: "R1", include: true, drop_reason: null, answer: null, group: "G9" },
        { id: "R2", include: true, drop_reason: null, answer: null, group: "G2" },
        { id: "R3", include: false, drop_reason: "Không đo được", answer: null, group: "G3" },
      ],
    });
  });

  it("đã duyệt ⇒ chỉ đọc: hiện mã CR, lý do bỏ, không còn nút tạo", () => {
    const approved = extraction({ status: "approved", approved_at: "2026-10-27T02:00:00.000Z" });
    approved.items[0].cr_id = "CR-001";
    approved.items[0].include = true;
    approved.items[2].include = false;
    approved.items[2].drop_reason = "Không đo được";
    renderWithIntl(<ExtractionList projectId={P} extraction={approved} onApproved={vi.fn()} />);
    expect(screen.getByRole("link", { name: "CR-001" })).toBeInTheDocument();
    expect(screen.getByText("Đã bỏ: Không đo được")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Tạo .* change request/ })).toBeNull();
    expect(screen.queryByRole("group", { name: "Câu hỏi của AI" })).toBeNull();
  });
});
