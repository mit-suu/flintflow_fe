import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { useState } from "react";
import { renderWithIntl } from "@/test/intl";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockServer } from "@/mocks/server";
import { resetMockState } from "@/mocks/state";
import { MODE1_PROJECT_ID, resetMode1MockState } from "@/mocks/mode1/state";
import * as mode1State from "@/mocks/mode1/state";
import { importToGapReview } from "@/mocks/mode1/flows";
import { useCrChat } from "../../hooks/mode1/useCrChat";
import Mode1CrThread from "./Mode1CrThread";

/** Mode 1 v3 phase 8 — change request chạy trong khung chat: mở CR, làm rõ, phần liên quan, đề xuất, gửi Lead. */
const P = MODE1_PROJECT_ID;
const S = () => mode1State.mode1State;

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

/** Khung chat tối giản: luồng CR + ô nhập gửi qua `chat.send` như workspace. */
function Harness({ myUserId = null }: { myUserId?: string | null }) {
  const chat = useCrChat(P);
  const [text, setText] = useState("");
  return (
    <>
      <Mode1CrThread projectId={P} chat={chat} me="Lan" myUserId={myUserId} />
      <input aria-label="Ô chat" placeholder={chat.inputHint} value={text} onChange={(e) => setText(e.target.value)} />
      <button
        type="button"
        onClick={() => {
          void chat.send(text);
          setText("");
        }}
      >
        Gửi chat
      </button>
      {/* Như trang: lệnh thêm / xoá use case đi vòng hỏi đáp riêng (không qua `chat.send`) nhưng vẫn là một lệnh sửa mới */}
      <button type="button" onClick={() => chat.clearSent()}>
        Lệnh use case
      </button>
    </>
  );
}

const say = async (text: string) => {
  fireEvent.change(screen.getByLabelText("Ô chat"), { target: { value: text } });
  fireEvent.click(screen.getByRole("button", { name: "Gửi chat" }));
};
const click = async (name: string | RegExp) => fireEvent.click(await screen.findByRole("button", { name }));
const cr = () => S().crs.get("CR-001")!.change_request;

describe("Mode1CrThread — CR trong khung chat", () => {
  it("lệnh sửa ⇒ chọn người yêu cầu ⇒ AI hỏi (chip gợi ý) ⇒ phần liên quan ⇒ đồng ý đề xuất ⇒ tự kiểm ⇒ gửi Lead", async () => {
    renderWithIntl(<Harness />);
    expect(await screen.findByLabelText("Hướng dẫn sửa tài liệu")).toBeInTheDocument();

    await say("Đăng xuất mọi thiết bị — yêu cầu còn mơ hồ");
    expect(screen.getByText("Đăng xuất mọi thiết bị — yêu cầu còn mơ hồ")).toBeInTheDocument();
    await click("Lan · yêu cầu miệng");

    // 3.1 xong ⇒ CR mở, 3.2 tự chạy ⇒ AI hỏi kèm gợi ý
    const q = await screen.findByRole("region", { name: "Trả lời câu hỏi làm rõ" });
    expect(cr()).toMatchObject({ source: { kind: "verbal" }, requester: "Lan", description: "Đăng xuất mọi thiết bị — yêu cầu còn mơ hồ", status: "awaiting_answers" });
    expect(screen.getByPlaceholderText("Trả lời câu hỏi của AI…")).toBeInTheDocument();
    fireEvent.click(within(q).getByRole("radio", { name: "Có, áp cho mọi thiết bị" }));
    fireEvent.click(within(q).getByRole("radio", { name: "Không cần thông báo" }));
    fireEvent.click(within(q).getByRole("button", { name: "Gửi câu trả lời" }));

    // 3.4 tự chạy ⇒ dừng ở danh sách phần liên quan
    const related = await screen.findByLabelText("Phần liên quan");
    expect(within(related).getAllByRole("listitem").length).toBeGreaterThan(0);
    await click("Tiếp tục — AI đề xuất sửa");

    // 3.6 ⇒ đồng ý đề xuất sửa (FLF-375: một nút cho cả danh sách) ⇒ 3.7 tự chạy ⇒ sẵn sàng
    const proposals = await screen.findByLabelText("Đề xuất sửa");
    fireEvent.click(within(proposals).getByRole("button", { name: /^Đồng ý tất cả/ }));
    await click("Xác nhận & ghi vào bản nháp");

    // FLF-330 C-6: xác nhận là ghi ngay vào bản nháp, không còn chờ Lead duyệt từng CR
    expect(await screen.findByLabelText("Đã ghi vào bản nháp")).toHaveTextContent("CR-001 đã ghi vào bản nháp chung");
    expect(cr().status).toBe("written");
    expect(cr().result_doc_version).toBe("0.2");
    expect(screen.getByPlaceholderText(/Gõ yêu cầu sửa tài liệu/)).toBeInTheDocument();
  });

  it("CR đã ghi xong ⇒ lệnh sửa mới (sửa thường hay thêm use case) ẩn thẻ “đã ghi vào bản nháp” của CR trước", async () => {
    renderWithIntl(<Harness />);
    await say("Đăng xuất mọi thiết bị — yêu cầu còn mơ hồ");
    await click("Lan · yêu cầu miệng");
    const q = await screen.findByRole("region", { name: "Trả lời câu hỏi làm rõ" });
    fireEvent.click(within(q).getByRole("radio", { name: "Có, áp cho mọi thiết bị" }));
    fireEvent.click(within(q).getByRole("radio", { name: "Không cần thông báo" }));
    fireEvent.click(within(q).getByRole("button", { name: "Gửi câu trả lời" }));
    await click("Tiếp tục — AI đề xuất sửa");
    fireEvent.click(within(await screen.findByLabelText("Đề xuất sửa")).getByRole("button", { name: /^Đồng ý tất cả/ }));
    await click("Xác nhận & ghi vào bản nháp");
    expect(await screen.findByLabelText("Đã ghi vào bản nháp")).toBeInTheDocument();

    // Lệnh thêm use case (vòng hỏi đáp riêng) ⇒ thẻ cũ ẩn
    fireEvent.click(screen.getByRole("button", { name: "Lệnh use case" }));
    await waitFor(() => expect(screen.queryByLabelText("Đã ghi vào bản nháp")).not.toBeInTheDocument());

    // Lệnh sửa thường cũng ẩn (đường `send` sẵn có)
    expect(screen.queryByText(/CR-001 đã ghi vào bản nháp chung/)).not.toBeInTheDocument();
    await say("Đổi tên màn hình đăng nhập");
    expect(screen.queryByLabelText("Đã ghi vào bản nháp")).not.toBeInTheDocument();
    expect(screen.getByText("Đổi tên màn hình đăng nhập")).toBeInTheDocument();
  });

  it("gõ thêm khi CR đang mở ⇒ gộp vào cùng CR, chạy lại làm rõ + tìm vị trí", async () => {
    renderWithIntl(<Harness />);
    await say("Đổi ngưỡng phản hồi thành 1 giây");
    await click("Lan · yêu cầu miệng");
    await screen.findByLabelText("Phần liên quan");
    expect(screen.getByPlaceholderText("Gõ thêm lệnh sửa để gộp vào CR-001…")).toBeInTheDocument();

    await say("Áp dụng cho cả màn tra cứu");
    await waitFor(() => expect(cr().amendments.map((a) => a.text)).toEqual(["Áp dụng cho cả màn tra cứu"]));
    expect(await screen.findByText("Áp dụng cho cả màn tra cứu")).toBeInTheDocument();
    expect(cr().status).toBe("impact_review");
    expect(S().crs.size).toBe(1);
  });

  it("Sửa lại ⇒ gõ hướng ⇒ AI soạn lại đúng vị trí đó, phải đồng ý lại; Bỏ ⇒ không liên quan", async () => {
    renderWithIntl(<Harness />);
    await say("Đổi ngưỡng phản hồi thành 1 giây");
    await click("Lan · yêu cầu miệng");
    await click("Tiếp tục — AI đề xuất sửa");
    const proposals = await screen.findByLabelText("Đề xuất sửa");
    // FLF-375: Sửa lại / Bỏ của từng phần nằm trong chi tiết của dòng — bấm ▸ để mở
    fireEvent.click(within(proposals).getAllByRole("button", { name: /^Mở chi tiết/ })[0]);
    fireEvent.click(within(proposals).getAllByRole("button", { name: "Sửa lại" })[0]);
    expect(await screen.findByPlaceholderText("Gõ hướng sửa lại cho đề xuất đang chọn…")).toBeInTheDocument();
    await say("Giữ nguyên tên, chỉ đổi ngưỡng");
    await waitFor(() => expect(S().crs.get("CR-001")!.locations.some((l) => l.manual && l.reason?.includes("Giữ nguyên tên"))).toBe(true));
    // đề xuất đã đổi ⇒ vẫn còn nút Đồng ý tất cả (chưa ai đồng ý bản mới)
    expect(within(await screen.findByLabelText("Đề xuất sửa")).getByRole("button", { name: /^Đồng ý tất cả/ })).toBeInTheDocument();

    fireEvent.click(within(screen.getByLabelText("Đề xuất sửa")).getAllByRole("button", { name: "Bỏ" })[0]);
    await waitFor(() => expect(S().crs.get("CR-001")!.locations.every((l) => l.conclusion === "not_related")).toBe(true));
  });

  it("kiểm tra cần xử lý: chỉ rõ phần chưa đạt (lý do) + phần AI bỏ sót; sửa lại / bỏ ngay trong thẻ ⇒ đồng ý ⇒ tự kiểm lại", async () => {
    const first = renderWithIntl(<Harness />);
    await say("Đổi ngưỡng phản hồi thành 1 giây");
    await click("Lan · yêu cầu miệng");
    await click("Tiếp tục — AI đề xuất sửa");
    await screen.findByLabelText("Đề xuất sửa");
    first.unmount();

    // BE: AI làm lại 2 lần vẫn trượt ở L001, và bỏ sót L002 ⇒ manual_fix
    const d = S().crs.get("CR-001")!;
    const failing = d.locations[0];
    if (d.locations.length < 2) {
      const path = "business_rules[id=BR-99]";
      d.locations.push({ ...failing, location_id: "L099", path, manual: false, verify: null, group_id: null });
      S().locks.set(path, "CR-001");
    }
    const skipped = d.locations[1];
    failing.conclusion = "edit";
    failing.verify = { code_ok: false, violations: [{ rule: "edit_no_change", message: "Đề xuất không thay đổi gì ở phần tử này" }], ai_flags: [], at: new Date().toISOString() };
    skipped.conclusion = null;
    skipped.proposal = null;
    d.change_request.status = "manual_fix";

    renderWithIntl(<Harness />);
    const todo = await screen.findByLabelText("Cần sửa");
    expect(todo).toHaveTextContent("2 phần vẫn chưa đạt");
    expect(within(todo).getAllByRole("button").map((b) => b.textContent)).toContain("Kiểm lại ngay");

    const bad = screen.getByRole("article", { name: `Đề xuất ${failing.location_id}` });
    expect(within(bad).getByText("Chưa đạt")).toBeInTheDocument();
    // FLF-375: không in thông báo luật nội bộ — một câu nhắc gõ hướng sửa hoặc bỏ
    expect(within(bad).getByLabelText("Lý do chưa đạt")).toHaveTextContent("Mình chưa sửa tự động được chỗ này sau 2 lần thử.");
    expect(within(bad).queryByText(/Đề xuất không thay đổi gì ở phần tử này/)).not.toBeInTheDocument();
    const missing = screen.getByRole("article", { name: `Đề xuất ${skipped.location_id}` });
    expect(within(missing).getByText("Chưa có đề xuất")).toBeInTheDocument();

    // phần trượt: gõ hướng sửa ngay trong thẻ ⇒ AI soạn lại
    fireEvent.change(within(bad).getByRole("textbox"), { target: { value: "Đổi ngưỡng thành 1 giây" } });
    fireEvent.click(within(bad).getByRole("button", { name: "AI soạn lại" }));
    await waitFor(() => expect(S().crs.get("CR-001")!.locations[0].verify).toBeNull());
    // phần bỏ sót: bỏ qua
    fireEvent.click(within(screen.getByRole("article", { name: `Đề xuất ${skipped.location_id}` })).getByRole("button", { name: "Bỏ qua phần này (không cần đổi)" }));
    await waitFor(() => expect(S().crs.get("CR-001")!.locations[1].conclusion).toBe("not_related"));

    // bản soạn lại hết trượt ⇒ về danh sách gọn ⇒ đồng ý ⇒ tự kiểm lại ⇒ sẵn sàng gửi
    await waitFor(() => expect(screen.queryByRole("article", { name: `Đề xuất ${failing.location_id}` })).not.toBeInTheDocument());
    fireEvent.click(await screen.findByRole("button", { name: /^Đồng ý tất cả/ }));
    expect(await screen.findByRole("button", { name: "Xác nhận & ghi vào bản nháp" })).toBeInTheDocument();
    expect(cr().status).toBe("ready_to_submit");
  });

  it("phần chưa đạt: chỉ có ô gõ hướng cho AI soạn lại — không còn tab “✎ Tự sửa” / sửa tay nội dung (FLF-375)", async () => {
    const first = renderWithIntl(<Harness />);
    await say("Ghi rõ lịch họp nhóm");
    await click("Lan · yêu cầu miệng");
    await click("Tiếp tục — AI đề xuất sửa");
    await screen.findByLabelText("Đề xuất sửa");
    first.unmount();

    const d = S().crs.get("CR-001")!;
    d.locations.splice(1);
    const loc = d.locations[0];
    loc.conclusion = "edit";
    loc.verify = { code_ok: false, violations: [{ rule: "value_changed", message: "Giá trị hiện tại khác old_text" }], ai_flags: [], at: new Date().toISOString() };
    d.change_request.status = "manual_fix";

    renderWithIntl(<Harness />);
    const card = await screen.findByRole("article", { name: `Đề xuất ${loc.location_id}` });
    expect(within(card).queryByRole("tab")).not.toBeInTheDocument();
    expect(within(card).queryByRole("button", { name: /Lưu bản tự sửa|Tự sửa/ })).not.toBeInTheDocument();
    expect(within(card).getByRole("button", { name: "AI soạn lại" })).toBeInTheDocument();
    // vi phạm value_changed ⇒ báo chỗ này vừa được sửa ở nơi khác
    expect(within(card).getByLabelText("Lý do chưa đạt")).toHaveTextContent("Chỗ này vừa được sửa ở nơi khác");
  });

  it("hỏi giữa chừng (câu hỏi) ⇒ AI trả lời trong khung chat, KHÔNG gộp thành yêu cầu bổ sung", async () => {
    renderWithIntl(<Harness />);
    await say("Đổi ngưỡng phản hồi thành 1 giây");
    await click("Lan · yêu cầu miệng");
    await screen.findByLabelText("Phần liên quan");
    const status = cr().status;

    await say("Có cần vẽ lại hình không?");
    expect(await screen.findByText("Trả lời (mock): Có cần vẽ lại hình không?")).toBeInTheDocument();
    expect(screen.getByText("Có cần vẽ lại hình không?")).toBeInTheDocument();
    expect(cr().amendments).toEqual([]);
    expect(cr().status).toBe(status);
  });
});

/** FLF-375: dựng sẵn CR ở bước đề xuất với `n` phần đã đạt kiểm (chép từ đề xuất đầu tiên của mock, mỗi phần một phần tử). */
const proposalsOf = async (n: number) => {
  const first = renderWithIntl(<Harness />);
  await say("Đổi ngưỡng phản hồi thành 1 giây");
  await click("Lan · yêu cầu miệng");
  await click("Tiếp tục — AI đề xuất sửa");
  await screen.findByLabelText("Đề xuất sửa");
  first.unmount();
  const d = S().crs.get("CR-001")!;
  const base = d.locations[0];
  d.locations = Array.from({ length: n }, (_, i) => {
    const path = i === 0 ? base.path : `business_rules[id=BR-9${i}]`;
    S().locks.set(path, "CR-001");
    return { ...base, location_id: `L10${i}`, path, manual: false, verify: null, group_id: null };
  });
  return d;
};

describe("Mode1CrThread — bước đề xuất gom một danh sách (FLF-375)", () => {
  it("người khác vừa sửa cùng chỗ (conflict) ⇒ thẻ so sánh 3 cột, không nút ghi đè; Bỏ yêu cầu ⇒ không liên quan", async () => {
    const d = await proposalsOf(1);
    const loc = d.locations[0];
    loc.conflict = {
      at_proposal: "Ngưỡng 2 giây",
      current: "Ngưỡng 3 giây",
      proposal: "Ngưỡng 1 giây",
      changed_by: "Minh",
      changed_at: "2026-11-11T02:15:00.000Z",
      proposed_at: "2026-11-11T02:00:00.000Z"
    };
    d.change_request.status = "manual_fix";

    renderWithIntl(<Harness />);
    const conflict = await screen.findByLabelText("Chỗ bị người khác sửa trong lúc chờ");
    expect(conflict).toHaveTextContent("1 chỗ đã được người khác sửa");
    const card = within(conflict).getByRole("article");
    // BF §3.2: giờ người kia sửa và giờ AI soạn; ① so ② / ① so ③ tô màu như Track Changes
    expect(card).toHaveTextContent(/đã được Minh sửa lúc \d{2}:\d{2}, sau khi AI soạn đề xuất cho bạn \(\d{2}:\d{2}\)/);
    expect(within(card).getByText("Ngưỡng 2 giây")).toBeInTheDocument();
    expect(within(card).getAllByRole("deletion").map((e) => e.textContent)).toEqual(["2", "2"]);
    expect(within(card).getAllByRole("insertion").map((e) => e.textContent)).toEqual(["3", "1"]);
    expect(within(card).getByRole("button", { name: "AI soạn lại trên nội dung hiện tại" })).toBeInTheDocument();
    expect(within(card).queryByRole("button", { name: /ghi đè/i })).not.toBeInTheDocument();

    fireEvent.click(within(card).getByRole("button", { name: "Bỏ yêu cầu" }));
    await waitFor(() => expect(S().crs.get("CR-001")!.locations[0].conclusion).toBe("not_related"));
    expect(S().crs.get("CR-001")!.locations[0].reason).toBe("Bỏ vì mục đã được Minh sửa");
  });

  it("yêu cầu gốc đụng thẳng phần vừa sửa ⇒ AI hỏi lại trong chat với gợi ý; chọn gợi ý ⇒ AI soạn lại theo câu trả lời", async () => {
    const d = await proposalsOf(1);
    const loc = d.locations[0];
    loc.conflict = {
      at_proposal: "Khách đặt hàng",
      current: "Khách hàng đặt hàng",
      proposal: "Người mua đặt hàng",
      changed_by: "Minh",
      changed_at: null,
      question: { text: "Minh vừa đổi “Khách” thành “Khách hàng”, còn yêu cầu của bạn muốn đổi thành “Người mua”. Giữ bản nào?", suggestions: ["Dùng “Người mua” theo yêu cầu của tôi", "Giữ “Khách hàng” của Minh và soạn phần còn lại"] }
    };
    d.change_request.status = "manual_fix";

    renderWithIntl(<Harness />);
    const card = within(await screen.findByLabelText("Chỗ bị người khác sửa trong lúc chờ")).getByRole("article");
    expect(within(card).getByLabelText("AI hỏi lại")).toHaveTextContent("Giữ bản nào?");
    // Chưa trả lời thì không có nút soạn lại tự chọn
    expect(within(card).queryByRole("button", { name: "AI soạn lại trên nội dung hiện tại" })).not.toBeInTheDocument();
    fireEvent.click(within(card).getByRole("button", { name: "Dùng “Người mua” theo yêu cầu của tôi" }));
    await waitFor(() => expect(S().crs.get("CR-001")!.locations[0].reason).toBe("Soạn lại theo hướng: Dùng “Người mua” theo yêu cầu của tôi"));
    expect(S().crs.get("CR-001")!.locations[0].conflict).toBeNull();
  });

  it("BF §3.2: người khác mở CR đã sẵn sàng ⇒ thấy 'đang treo ở X', không có nút xác nhận", async () => {
    const d = await proposalsOf(1);
    d.change_request.status = "ready_to_submit";
    d.change_request.created_by = "user-lan";
    d.change_request.created_by_name = "Lan";
    renderWithIntl(<Harness myUserId="user-huy" />);
    expect(await screen.findByText(/đang treo ở Lan/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Xác nhận & ghi vào bản nháp" })).not.toBeInTheDocument();
  });

  it("5 phần đều đạt ⇒ danh sách gọn, bấm một lần Đồng ý tất cả ⇒ CR đi tiếp tới xác nhận", async () => {
    await proposalsOf(5);
    renderWithIntl(<Harness />);
    const proposals = await screen.findByLabelText("Đề xuất sửa");
    expect(within(proposals).getAllByRole("button", { name: /^Mở chi tiết/ })).toHaveLength(5);
    expect(within(proposals).queryByRole("article")).not.toBeInTheDocument();
    expect(within(proposals).queryByRole("button", { name: "Đồng ý" })).not.toBeInTheDocument();
    expect(screen.getByText(/đã chốt 0\/5/)).toBeInTheDocument();

    fireEvent.click(within(proposals).getByRole("button", { name: "Đồng ý tất cả (5)" }));
    expect(await screen.findByRole("button", { name: "Xác nhận & ghi vào bản nháp" })).toBeInTheDocument();
    expect(cr().status).toBe("ready_to_submit");
  });

  it("phần chưa đề xuất / sơ đồ gốc / có lưu ý AI vẫn là thẻ riêng — Đồng ý tất cả chỉ duyệt phần còn lại", async () => {
    const d = await proposalsOf(5);
    const [, missing, diagram, flagged] = d.locations;
    Object.assign(missing, { conclusion: null, proposal: null });
    diagram.found_by = ["diagram"];
    flagged.verify = { code_ok: true, violations: [], ai_flags: [{ rule: "ai_review", message: "Kiểm lại số liệu" }], at: new Date().toISOString() };
    // BE: AI làm lại vẫn bỏ sót một phần ⇒ manual_fix (không gọi AI đề xuất lại)
    d.change_request.status = "manual_fix";

    renderWithIntl(<Harness />);
    const own = await screen.findByLabelText("Cần bạn xem riêng");
    expect(own).toHaveTextContent("⚠ Cần bạn xem riêng (3)");
    for (const l of [missing, diagram, flagged]) expect(within(own).getByRole("article", { name: `Đề xuất ${l.location_id}` })).toBeInTheDocument();
    expect(within(screen.getByLabelText("Danh sách đề xuất")).getAllByRole("listitem")).toHaveLength(2);

    fireEvent.click(screen.getByRole("button", { name: "Đồng ý tất cả (2)" }));
    await waitFor(() => expect(screen.queryByRole("button", { name: /^Đồng ý tất cả/ })).not.toBeInTheDocument());
    expect(screen.getByText(/đã chốt 2\/5/)).toBeInTheDocument();
    expect(within(screen.getByRole("article", { name: `Đề xuất ${flagged.location_id}` })).getByRole("button", { name: "Đồng ý" })).toBeInTheDocument();
    expect(within(screen.getByRole("article", { name: `Đề xuất ${diagram.location_id}` })).getByRole("button", { name: "Giữ hình gốc" })).toBeInTheDocument();
    expect(cr().status).not.toBe("ready_to_submit");
  });

  it("Bỏ một phần từ chi tiết của dòng ⇒ chỉ phần đó thành không liên quan", async () => {
    await proposalsOf(3);
    renderWithIntl(<Harness />);
    const proposals = await screen.findByLabelText("Đề xuất sửa");
    fireEvent.click(within(proposals).getAllByRole("button", { name: /^Mở chi tiết/ })[1]);
    fireEvent.click(within(screen.getByLabelText("Chi tiết đề xuất L101")).getByRole("button", { name: "Bỏ" }));
    await waitFor(() => expect(S().crs.get("CR-001")!.locations.map((l) => l.conclusion)).toEqual(["edit", "not_related", "edit"]));
    expect(await screen.findByRole("button", { name: "Đồng ý tất cả (2)" })).toBeInTheDocument();
  });
});

const PREVIEW_DESCRIPTION = ["thêm UC phúc khảo điểm", "", "Trả lời làm rõ:", "- Màn hình riêng"].join("\n");

/** FLF-318: lệnh thêm / xoá use case đi vòng hỏi đáp + bản xem trước như trước baseline rồi mới tạo CR kèm bản xem trước. */
function PreviewHarness({ onWritten }: { onWritten?: (crId: string) => void }) {
  const chat = useCrChat(P, true, onWritten);
  return (
    <>
      <Mode1CrThread projectId={P} chat={chat} me="Lan" />
      <button
        type="button"
        onClick={() => chat.startFromPreview("thêm UC phúc khảo điểm", PREVIEW_DESCRIPTION, "pv-1")}
      >
        Tạo CR từ bản xem trước
      </button>
    </>
  );
}

describe("Mode1CrThread — CR từ bản xem trước (FLF-318)", () => {
  it("Tạo change request từ bản xem trước ⇒ thẻ nói rõ CR mang đúng thay đổi đã xem; chọn người yêu cầu ⇒ CR kèm preview_id + đoạn hỏi đáp", async () => {
    renderWithIntl(<PreviewHarness />);
    await click("Tạo CR từ bản xem trước");
    expect(await screen.findByLabelText("Tạo change request từ bản xem trước")).toBeInTheDocument();
    expect(screen.getByText("thêm UC phúc khảo điểm")).toBeInTheDocument();

    await click("Lan · yêu cầu miệng");
    await waitFor(() => expect(S().crs.get("CR-001")).toBeDefined());
    const created = cr();
    expect(created.title).toBe("thêm UC phúc khảo điểm");
    expect(created.description).toBe(PREVIEW_DESCRIPTION);
    expect(created.seed).not.toBeNull();
    expect(created.source.note).toBe("Tạo từ bản xem trước trong khung chat");
  });

  it("lô đã duyệt ở bản xem trước ⇒ không dừng ở phần liên quan, không bắt Đồng ý từng phần: một khung tóm tắt rồi tới nút xác nhận", async () => {
    const onWritten = vi.fn();
    renderWithIntl(<PreviewHarness onWritten={onWritten} />);
    await click("Tạo CR từ bản xem trước");
    await click("Lan · yêu cầu miệng");

    expect(await screen.findByRole("button", { name: "Xác nhận & ghi vào bản nháp" })).toBeInTheDocument();
    expect(cr().status).toBe("ready_to_submit");
    const summary = screen.getByLabelText("Thay đổi đã duyệt ở bản xem trước");
    expect(within(summary).getByText(/Đúng các thay đổi bạn đã duyệt ở bản xem trước/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Tiếp tục — AI đề xuất sửa" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Đồng ý" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Phần liên quan")).not.toBeInTheDocument();

    expect(onWritten).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Xác nhận & ghi vào bản nháp" }));
    await waitFor(() => expect(cr().status).toBe("written"));
    // Trang tải lại tài liệu / version ở khung phải khi CR vừa ghi bản nháp
    await waitFor(() => expect(onWritten).toHaveBeenCalledWith("CR-001"));
  });
});

