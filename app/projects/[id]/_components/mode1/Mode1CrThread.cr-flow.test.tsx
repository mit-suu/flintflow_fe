import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithIntl } from "@/test/intl";
import { API_BASE_URL } from "@/lib/api/client";
import { mockServer } from "@/mocks/server";
import { resetMockState } from "@/mocks/state";
import { MODE1_PROJECT_ID, MODE1_USER_ID, resetMode1MockState } from "@/mocks/mode1/state";
import { importToGapReview } from "@/mocks/mode1/flows";
import type { CrDetail, CrLocation, CrStatus } from "@/types/change-request";
import { useCrChat } from "../../hooks/mode1/useCrChat";
import Mode1CrThread from "./Mode1CrThread";

/**
 * Change request trong chat theo BE mới: cảnh báo C-4 ("Vẫn làm"), giữ theo ý mình C-5, ước tính credit, CR_OWN_OPEN,
 * Hoàn tác, và `submit` trả CR về `manual_fix`. BE giả lập từng ca bằng handler riêng để kiểm đúng body gửi đi.
 */
const P = MODE1_PROJECT_ID;
const base = `${API_BASE_URL}/projects/${P}/change-requests`;

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useParams: () => ({ id: MODE1_PROJECT_ID }),
}));

beforeAll(() => mockServer.listen({ onUnhandledRequest: "error" }));
beforeEach(async () => {
  resetMockState();
  resetMode1MockState();
  window.localStorage.clear();
  await importToGapReview();
});
afterEach(() => mockServer.resetHandlers());
afterAll(() => mockServer.close());

function Harness() {
  const chat = useCrChat(P, true, undefined, MODE1_USER_ID);
  return <Mode1CrThread projectId={P} chat={chat} me="Lan" myUserId={MODE1_USER_ID} />;
}

const loc = (over: Partial<CrLocation> = {}): CrLocation => ({
  location_id: "L001",
  path: "nfrs[id=NFR-01]",
  section_id: "fixed:2.2",
  section_title: "Yêu cầu phi chức năng",
  current_text: "Hệ thống phản hồi dưới 2 giây",
  found_by: ["keyword"],
  entity_paths: [],
  owner_step: null,
  conclusion: "edit",
  reason: null,
  proposal: { old_text: "Hệ thống phản hồi dưới 2 giây", new_text: "Hệ thống phản hồi dưới 1 giây", comment_text: null, spine_ops: [{ op: "replace" }], assumptions: [] },
  manual: false,
  redo_count: 0,
  verify: null,
  group_id: null,
  warning: null,
  kept_intent: false,
  kept_violations: [],
  ...over,
});

const detail = (status: CrStatus, locations: CrLocation[], extra: Partial<CrDetail> = {}, crId = "CR-001"): CrDetail =>
  ({
    change_request: {
      cr_id: crId,
      project_id: P,
      title: "Đổi thời gian phản hồi",
      description: "Giảm thời gian phản hồi xuống 1 giây",
      source: { kind: "verbal", ref: null, note: null },
      requester: "Lan",
      status,
      paused: null,
      clarifications: [],
      base_doc_version: "v0.1",
      result_doc_version: null,
      created_by: MODE1_USER_ID,
      created_by_name: "Lan",
      submitted_at: null,
      decided_by: null,
      closed_reason: null,
      flag_ids: [],
      seed: null,
      materials: [],
      missing_info: [],
      amendments: [],
      created_at: "2026-11-24T00:00:00.000Z",
      updated_at: "2026-11-24T00:00:00.000Z",
    },
    locations,
    groups: [],
    pending_questions: [],
    propose_estimate: null,
    ...extra,
  }) as unknown as CrDetail;

const envelope = (data: unknown, status = 200) => HttpResponse.json({ data, error: null }, { status });
const failure = (code: string, message: string, meta: Record<string, unknown>, status = 409) => HttpResponse.json({ data: null, meta, error: { code, message } }, { status });

/** GET danh sách + GET một CR của `current`; trả về hàm đổi `current` để handler khác cập nhật. */
function serve(initial: CrDetail | null) {
  let current = initial;
  mockServer.use(
    http.get(base, () => envelope(current ? [current.change_request] : [])),
    http.get(`${base}/:crId`, ({ params }) => (current && current.change_request.cr_id === params.crId ? envelope(current) : failure("CR_NOT_FOUND", "Không thấy", {}, 404)))
  );
  return (next: CrDetail | null) => {
    current = next;
  };
}

describe("Mode1CrThread - cảnh báo của AI (C-4)", () => {
  const warned = loc({
    conclusion: "comment",
    proposal: { old_text: "", new_text: null, comment_text: "Yêu cầu này mâu thuẫn với NFR-02", spine_ops: [], assumptions: [] },
    warning: { text: "Yêu cầu này mâu thuẫn với NFR-02", reason: "NFR-02 đang cho phép tối đa 3 giây" },
  });

  it("chỗ có cảnh báo chưa quyết ⇒ hiện lý do + nút Vẫn làm (không có Đồng ý); bấm ⇒ PATCH action proceed", async () => {
    const set = serve(detail("proposing", [warned]));
    let body: unknown = null;
    mockServer.use(
      http.patch(`${base}/CR-001/locations/L001`, async ({ request }) => {
        body = await request.json();
        const next = detail("proposing", [loc({ warning: warned.warning, kept_intent: true })]);
        set(next);
        return envelope(next);
      })
    );
    renderWithIntl(<Harness />);

    const card = await screen.findByLabelText("Đề xuất L001");
    expect(within(card).getByText("AI thấy yêu cầu này có thể chưa hợp lý ở chỗ này")).toBeInTheDocument();
    expect(within(card).getByText("NFR-02 đang cho phép tối đa 3 giây")).toBeInTheDocument();
    expect(within(card).queryByRole("button", { name: "Đồng ý" })).not.toBeInTheDocument();
    expect(within(card).getByRole("button", { name: "Sửa lại" })).toBeInTheDocument();
    expect(within(card).getByRole("button", { name: "Bỏ" })).toBeInTheDocument();

    fireEvent.click(within(card).getByRole("button", { name: "Vẫn làm" }));
    await waitFor(() => expect(body).toEqual({ action: "proceed" }));
    // đã Vẫn làm ⇒ hết cảnh báo chờ: không còn nút Vẫn làm
    await waitFor(() => expect(screen.queryByRole("button", { name: "Vẫn làm" })).not.toBeInTheDocument());
  });
});

describe("Mode1CrThread - giữ theo ý mình (C-5)", () => {
  const redFlag = loc({
    location_id: "L001",
    verify: { code_ok: false, violations: [{ rule: "new_red_flag", message: "Đề xuất làm phát sinh lỗi đỏ mới" }], ai_flags: [], at: "2026-11-24T00:00:00.000Z" },
  });
  const stale = loc({
    location_id: "L002",
    path: "nfrs[id=NFR-02]",
    verify: { code_ok: false, violations: [{ rule: "value_changed", message: "vừa được sửa ở chỗ khác" }], ai_flags: [], at: "2026-11-24T00:00:00.000Z" },
  });

  it("chỉ lỗi luật (cờ đỏ mới) có Giữ theo ý mình + dòng giải thích chặn Gửi duyệt; chữ cũ không khớp thì không có", async () => {
    serve(detail("manual_fix", [redFlag, stale]));
    renderWithIntl(<Harness />);

    const ruleCard = await screen.findByLabelText("Đề xuất L001");
    const staleCard = await screen.findByLabelText("Đề xuất L002");
    expect(within(ruleCard).getByRole("button", { name: "Giữ theo ý mình" })).toBeInTheDocument();
    expect(within(ruleCard).getByText(/chặn Gửi duyệt/)).toBeInTheDocument();
    expect(within(staleCard).queryByRole("button", { name: "Giữ theo ý mình" })).not.toBeInTheDocument();
  });

  it("bấm Giữ theo ý mình ⇒ PATCH action keep, rồi tự gọi kiểm lại", async () => {
    const set = serve(detail("manual_fix", [redFlag]));
    let body: unknown = null;
    const verified = vi.fn();
    mockServer.use(
      http.patch(`${base}/CR-001/locations/L001`, async ({ request }) => {
        body = await request.json();
        const next = detail("manual_fix", [loc({ manual: true, kept_violations: ["new_red_flag"] })]);
        set(next);
        return envelope(next);
      }),
      http.post(`${base}/CR-001/verify`, () => {
        verified();
        const next = detail("ready_to_submit", [loc({ manual: true, kept_violations: ["new_red_flag"], verify: { code_ok: true, violations: [], ai_flags: [], at: "2026-11-24T00:00:00.000Z" } })]);
        set(next);
        return envelope(next);
      })
    );
    renderWithIntl(<Harness />);

    fireEvent.click(await screen.findByRole("button", { name: "Giữ theo ý mình" }));
    await waitFor(() => expect(body).toEqual({ action: "keep" }));
    await waitFor(() => expect(verified).toHaveBeenCalledTimes(1));
    expect(await screen.findByRole("button", { name: "Xác nhận & ghi vào bản nháp" })).toBeInTheDocument();
  });
});

describe("Mode1CrThread - ước tính credit trước khi AI đề xuất", () => {
  it("propose_estimate có ⇒ hiện số chỗ, lô và credit cạnh nút Tiếp tục", async () => {
    serve(detail("impact_review", [loc({ conclusion: null, proposal: null })], { propose_estimate: { locations: 120, batches: 30, credits: 90 } }));
    window.localStorage.setItem(`ff-cr-chat:${P}:CR-001:impact`, "0");
    renderWithIntl(<Harness />);

    expect(await screen.findByText(/120 chỗ.*30 lô.*90 credit/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tiếp tục - AI đề xuất sửa" })).toBeInTheDocument();
  });
});

describe("Mode1CrThread - còn CR dở (CR_OWN_OPEN)", () => {
  it("tạo CR bị 409 ⇒ câu báo + nút Mở CR đó; bấm ⇒ mở đúng CR đang dở, không tạo mới", async () => {
    const open = detail("proposing", [loc()], {}, "CR-009");
    // Danh sách lúc mở trang trống (CR dở nằm ở phiên khác); CR-009 đọc được theo mã BE báo
    mockServer.use(
      http.get(base, () => envelope([])),
      http.get(`${base}/CR-009`, () => envelope(open)),
      http.post(base, () => failure("CR_OWN_OPEN", "Bạn còn một CR mở", { cr_id: "CR-009", title: "Đổi thời gian phản hồi" }))
    );
    function Typing() {
      const chat = useCrChat(P, true, undefined, MODE1_USER_ID);
      return (
        <>
          <button type="button" onClick={() => void chat.send("Giảm thời gian phản hồi")}>
            Gửi chat
          </button>
          <Mode1CrThread projectId={P} chat={chat} me="Lan" myUserId={MODE1_USER_ID} />
        </>
      );
    }
    renderWithIntl(<Typing />);

    fireEvent.click(await screen.findByRole("button", { name: "Gửi chat" }));
    fireEvent.click(await screen.findByRole("button", { name: "Lan · yêu cầu miệng" }));

    const alert = await screen.findByRole("alert");
    expect(within(alert).getByText(/Bạn còn một change request đang dở/)).toBeInTheDocument();
    fireEvent.click(within(alert).getByRole("button", { name: "Mở CR-009" }));

    expect(await screen.findByLabelText("Change request CR-009 trong chat")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});

describe("Mode1CrThread - Hoàn tác và gửi lại", () => {
  it("submit trả manual_fix ⇒ không báo đã ghi, báo kiểm lại thấy lỗi mới", async () => {
    serve(detail("ready_to_submit", [loc()]));
    mockServer.use(
      http.post(`${base}/CR-001/submit`, () =>
        envelope(detail("manual_fix", [loc({ verify: { code_ok: false, violations: [{ rule: "new_red_flag", message: "lỗi đỏ mới" }], ai_flags: [], at: "2026-11-24T00:00:00.000Z" } })]))
      )
    );
    renderWithIntl(<Harness />);

    fireEvent.click(await screen.findByRole("button", { name: "Xác nhận & ghi vào bản nháp" }));
    expect(await screen.findByText(/kiểm lại thấy lỗi mới nên chưa ghi được/)).toBeInTheDocument();
    expect(screen.queryByLabelText("Đã ghi vào bản nháp")).not.toBeInTheDocument();
  });

  it("CR đã ghi ⇒ thẻ có Hoàn tác; bấm ⇒ POST revert kèm người yêu cầu và mở CR mới trong chat", async () => {
    serve(detail("ready_to_submit", [loc()]));
    let revertBody: unknown = null;
    mockServer.use(
      http.post(`${base}/CR-001/submit`, () => envelope(detail("written", [loc()]))),
      http.post(`${base}/CR-001/revert`, async ({ request }) => {
        revertBody = await request.json();
        return envelope(detail("ready_to_submit", [loc()], {}, "CR-002"), 201);
      })
    );
    renderWithIntl(<Harness />);

    fireEvent.click(await screen.findByRole("button", { name: "Xác nhận & ghi vào bản nháp" }));
    const sent = await screen.findByLabelText("Đã ghi vào bản nháp");
    fireEvent.click(within(sent).getByRole("button", { name: "Hoàn tác" }));

    await waitFor(() => expect(revertBody).toEqual({ requester: "Lan" }));
    expect(await screen.findByLabelText("Change request CR-002 trong chat")).toBeInTheDocument();
    expect(screen.queryByLabelText("Đã ghi vào bản nháp")).not.toBeInTheDocument();
  });

  it("Hoàn tác bị 409 CR_REVERT_NOTHING ⇒ hiện câu báo, thẻ đã ghi vẫn còn", async () => {
    serve(detail("ready_to_submit", [loc()]));
    mockServer.use(
      http.post(`${base}/CR-001/submit`, () => envelope(detail("written", [loc()]))),
      http.post(`${base}/CR-001/revert`, () => failure("CR_REVERT_NOTHING", "Nothing to revert", { skipped: [] }))
    );
    renderWithIntl(<Harness />);

    fireEvent.click(await screen.findByRole("button", { name: "Xác nhận & ghi vào bản nháp" }));
    fireEvent.click(within(await screen.findByLabelText("Đã ghi vào bản nháp")).getByRole("button", { name: "Hoàn tác" }));

    expect(await screen.findByText(/Không còn gì để hoàn tác/)).toBeInTheDocument();
    expect(screen.getByLabelText("Đã ghi vào bản nháp")).toBeInTheDocument();
  });
});
