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
    { id: "R2", text: "Login keeps email and password.", label: "duplicate", para_id: "D1-P03", quote: "Login stays with email and password", group: "G2", entity_paths: ["use_cases[id=UC-01]"], entity_names: ["Đăng nhập"], question: null, suggested_answers: [], include: null, drop_reason: null, answer: null, cr_id: null },
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

describe("ExtractionList (FLF-338 §3.6.1 - BA duyệt danh sách rút yêu cầu)", () => {
  it("hiện nhãn, trích dẫn + mã đoạn, thẻ câu hỏi gom; nút tạo khoá tới khi có người yêu cầu và câu trả lời; mục trùng không tính vào số CR", async () => {
    renderWithIntl(<ExtractionList projectId={P} extraction={extraction()} onApproved={vi.fn()} />);
    expect(screen.getByText("Mới")).toBeInTheDocument();
    expect(screen.getByText("Trùng")).toBeInTheDocument();
    expect(screen.getByText("Mơ hồ")).toBeInTheDocument();
    // FLF-449 L6 / AC-B3.11: nguồn ghi tên tài liệu + số đoạn, phần tử ghi bằng tên — không lộ `D1-P02`, `use_cases[id=…]`
    expect(screen.getByText(/every report can be exported to CSV/)).toHaveTextContent("minutes.txt · đoạn 2");
    expect(screen.getByText(/Chạm:/)).toHaveTextContent("Use case UC-01 “Đăng nhập”");
    expect(document.body.textContent).not.toMatch(/D1-P\d+|use_cases\[id=/);
    expect(screen.getByRole("group", { name: "Câu hỏi của AI" })).toHaveTextContent("Fast means what?");

    const create = screen.getByRole("button", { name: "Tạo 2 change request" });
    expect(create).toBeDisabled();
    fireEvent.change(screen.getByPlaceholderText(/Ai đưa ra yêu cầu/), { target: { value: "PM Lan" } });
    expect(create).toBeDisabled();
    expect(screen.getByText(/Còn 1 mục thiếu lý do bỏ, câu trả lời hoặc phương án/)).toBeInTheDocument();
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

  it("FLF-449: mục Suy ra không tích sẵn (mục khác vẫn tích sẵn); tích mà chưa chọn phương án thì không duyệt được; chọn phương án gửi chosen_option", async () => {
    const calls: unknown[] = [];
    mockServer.use(
      http.post(`${API_BASE_URL}/projects/:projectId/documents/:documentId/extract/approve`, async ({ request }) => {
        calls.push(await request.json());
        return HttpResponse.json({ data: extraction({ status: "approved", approved_at: "2026-10-27T02:00:00.000Z" }), error: null });
      })
    );
    const inferred = extraction({
      situation: {
        current: [{ text: "CS tra đơn bằng Excel.", para_id: "D1-P05", quote: "tra file Excel" }],
        desired: [{ text: "Trả lời khách ngay.", para_id: "D1-P06", quote: "trả lời ngay khi khách gọi" }],
      },
      items: [
        { id: "R1", text: "Every report must be exportable to CSV.", label: "new", para_id: "D1-P02", quote: "every report can be exported to CSV", group: "G1", entity_paths: [], speaker: "Chị Lan", question: null, suggested_answers: [], include: null, drop_reason: null, answer: null, cr_id: null },
        {
          id: "R2",
          text: "Thời hạn duyệt hoàn tiền.",
          label: "contradiction",
          para_id: "D1-P03",
          quote: "duyệt trong 1 ngày",
          group: "G2",
          entity_paths: [],
          sides: [
            { speaker: "Anh A", para_id: "D1-P03", quote: "duyệt trong 1 ngày" },
            { speaker: "Chị B", para_id: "D1-P04", quote: "duyệt trong 3 ngày" },
          ],
          question: "1 ngày hay 3 ngày?",
          suggested_answers: ["1 ngày", "3 ngày"],
          include: null,
          drop_reason: null,
          answer: null,
          cr_id: null,
        },
        {
          id: "R3",
          text: "CS tra được trạng thái đơn theo mã đơn.",
          label: "inferred",
          para_id: "D1-P05",
          quote: "CS mất cả buổi sáng tra file Excel",
          group: "G3",
          entity_paths: [],
          inference: {
            symptom: "CS mất cả buổi tra Excel.",
            symptom_quote: "CS mất cả buổi sáng tra file Excel",
            symptom_para_id: "D1-P05",
            root_cause: "Trạng thái đơn chỉ nằm trong Excel.",
            rationale: "Có màn tra cứu thì không phải tìm tay.",
            options: [
              { label: "Màn tra cứu đơn", description: null, pros: ["Trả lời khách trong vài giây"], cons: ["Thêm một màn"], risks: ["Giả định dữ liệu đơn đã có trong hệ thống"] },
              { label: "Nhập Excel mỗi đêm", description: null, pros: ["Ít thay đổi"], cons: ["Trạng thái trễ một ngày"], risks: ["File Excel đổi cột"] },
            ],
            recommended: 0,
            recommendation_reason: "Biên bản nói khách cần câu trả lời ngay.",
            serves_goal: "Giảm thời gian trả lời khách",
          },
          question: null,
          suggested_answers: [],
          include: null,
          drop_reason: null,
          answer: null,
          cr_id: null,
        },
      ],
    });
    renderWithIntl(<ExtractionList projectId={P} extraction={inferred} onApproved={vi.fn()} />);
    // Đầu danh sách: hiện trạng / mong muốn kèm câu trích
    const situation = screen.getByRole("group", { name: "Hiện trạng và mong muốn" });
    expect(situation).toHaveTextContent("CS tra đơn bằng Excel.");
    expect(situation).toHaveTextContent("minutes.txt · đoạn 6");
    // Người nói, hai bên của mâu thuẫn
    expect(screen.getByText("Người nói: Chị Lan")).toBeInTheDocument();
    expect(screen.getByText("Mỗi bên nói gì")).toBeInTheDocument();
    expect(screen.getByText("Chị B")).toBeInTheDocument();
    // L7: mục chưa quyết định tích sẵn, trừ Suy ra
    expect(screen.getByRole("checkbox", { name: "Đưa R1 vào" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Đưa R2 vào" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Đưa R3 vào" })).not.toBeChecked();
    // Thẻ Suy ra: triệu chứng + trích, gốc rễ, hai phương án ưu / nhược / rủi ro, khuyến nghị kèm lý do, mục tiêu
    expect(screen.getByText("Suy ra")).toBeInTheDocument();
    expect(screen.getByText(/CS mất cả buổi sáng tra file Excel/)).toHaveTextContent("minutes.txt · đoạn 5");
    expect(screen.getByText(/Trạng thái đơn chỉ nằm trong Excel/)).toBeInTheDocument();
    expect(screen.getByText("Giả định dữ liệu đơn đã có trong hệ thống")).toBeInTheDocument();
    expect(screen.getByText("Khuyến nghị")).toBeInTheDocument();
    expect(screen.getByText("Vì sao khuyến nghị: Biên bản nói khách cần câu trả lời ngay.")).toBeInTheDocument();
    expect(screen.getByText("Phục vụ mục tiêu: Giảm thời gian trả lời khách")).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText(/Ai đưa ra yêu cầu/), { target: { value: "PM Lan" } });
    fireEvent.click(screen.getByRole("button", { name: "3 ngày" }));
    // Tích Suy ra mà chưa chọn phương án ⇒ chưa duyệt được
    fireEvent.click(screen.getByRole("checkbox", { name: "Đưa R3 vào" }));
    expect(screen.getByText("Muốn đưa mục này vào thì chọn một phương án.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tạo 3 change request" })).toBeDisabled();
    fireEvent.click(screen.getByRole("radio", { name: "Nhập Excel mỗi đêm" }));
    const create = screen.getByRole("button", { name: "Tạo 3 change request" });
    expect(create).toBeEnabled();
    fireEvent.click(create);
    await waitFor(() => expect(calls).toHaveLength(1));
    expect((calls[0] as { decisions: unknown[] }).decisions).toEqual([
      { id: "R1", include: true, drop_reason: null, answer: null, group: "G1" },
      { id: "R2", include: true, drop_reason: null, answer: "3 ngày", group: "G2" },
      { id: "R3", include: true, drop_reason: null, answer: null, group: "G3", chosen_option: 1 },
    ]);
  });

  it("FLF-449: chọn phương án của mục Suy ra chưa tích thì tự tích; không khuyến nghị thì nói rõ hai phương án ngang nhau", () => {
    const ex = extraction({
      items: [
        {
          id: "R1",
          text: "Quản lý nhiều chi nhánh.",
          label: "inferred",
          para_id: "D1-P02",
          quote: "tháng sau mở chi nhánh Đà Nẵng",
          group: "G1",
          entity_paths: [],
          inference: {
            symptom: "Sắp mở chi nhánh mới.",
            symptom_quote: "tháng sau mở chi nhánh Đà Nẵng",
            symptom_para_id: "D1-P02",
            root_cause: "Hệ thống chỉ có một kho.",
            rationale: "Chi nhánh mới cần tồn kho riêng.",
            options: [
              { label: "Kho theo chi nhánh", description: null, pros: [], cons: [], risks: [] },
              { label: "Một kho chung", description: null, pros: [], cons: [], risks: [] },
            ],
            recommended: null,
            recommendation_reason: null,
            serves_goal: null,
          },
          question: null,
          suggested_answers: [],
          include: null,
          drop_reason: null,
          answer: null,
          cr_id: null,
        },
      ],
    });
    renderWithIntl(<ExtractionList projectId={P} extraction={ex} onApproved={vi.fn()} />);
    expect(screen.getByText("Chưa đủ căn cứ để khuyến nghị - hai phương án ngang nhau, bạn chọn.")).toBeInTheDocument();
    expect(screen.queryByText("Khuyến nghị")).toBeNull();
    expect(screen.getByRole("checkbox", { name: "Đưa R1 vào" })).not.toBeChecked();
    fireEvent.click(screen.getByRole("radio", { name: "Kho theo chi nhánh" }));
    expect(screen.getByRole("checkbox", { name: "Đưa R1 vào" })).toBeChecked();
  });
});
